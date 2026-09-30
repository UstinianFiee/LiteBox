"use strict";
// A separate process lets cancellation stop synchronous SQLite work as well as network queries.
const parentPort = {
  postMessage: (message) => {
    if (process.connected) process.send(message);
  },
  on: (event, listener) => process.on(event, listener),
};
let workerData;
let p;
const { readQuery } = require("./database-validation.cjs");

let client, extra;
const { validateMutation, buildMutation } = require("./database-mutations.cjs");
const ROW_LIMIT = 1000,
  BYTE_LIMIT = 2 * 1024 * 1024;
function cell(value) {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array)
    return "base64:" + Buffer.from(value).toString("base64");
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
async function query(sql, params = [], paging) {
  if (extra) return extra.query(sql, params, paging);
  const page = require("./database-paging.cjs").collector(paging);
  let columns = [],
    stopped = false;
  const accept = (row) => {
    if (stopped) return false;
    const keep = page.accept(row.map(cell));
    if (!keep) stopped = true;
    return keep;
  };
  if (p.type === "sqlite") {
    const statement = client.prepare(sql);
    statement.setReadBigInts(true);
    statement.setReturnArrays(true);
    columns = statement.columns().map((c) => c.name);
    for (const row of statement.iterate(...params)) {
      if (!accept(row)) break;
    }
  } else if (p.type === "postgres") {
    const Cursor = require("pg-cursor");
    const cursor = client.query(
      new Cursor(sql, params, {
        rowMode: "array",
        types: { getTypeParser: () => (v) => v },
      }),
    );
    try {
      while (true) {
        const batch = await new Promise((resolve, reject) =>
          cursor.read(100, (err, rows, result) => {
            if (err) return reject(err);
            // Exhausted pg-cursor reads return (null, []) without metadata.
            if (result?.fields) columns = result.fields.map((f) => f.name);
            resolve(rows);
          }),
        );
        if (!batch.length) break;
        let stop = false;
        for (const row of batch)
          if (!accept(row)) {
            stop = true;
            break;
          }
        if (stop) break;
      }
    } finally {
      await cursor.close();
    }
  } else {
    await new Promise((resolve, reject) => {
      const q = client.query({ sql, values: params, rowsAsArray: true });
      q.on("fields", (fields) => {
        columns = fields.map((f) => f.name);
      });
      let failure;
      q.on("result", (row) => {
        if (!stopped && !failure)
          try {
            accept(row);
          } catch (e) {
            failure = e;
            stopped = true;
          }
      });
      q.on("error", reject);
      q.on("end", () => (failure ? reject(failure) : resolve()));
    });
  }
  return page.result(columns);
}
function command(sql) {
  return p.type === "mysql"
    ? new Promise((resolve, reject) =>
        client.query(sql, (e, r) => (e ? reject(e) : resolve(r))),
      )
    : client.query(sql);
}
function openSQLite(readOnly) {
  const fs = require("node:fs");
  if (!fs.statSync(p.path).isFile()) throw Error("SQLite file does not exist");
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(p.path, {
    readOnly,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
  });
  if (readOnly) db.exec("PRAGMA query_only = ON");
  return db;
}
async function connect() {
  if (["oracle", "mongodb", "redis"].includes(p.type)) {
    extra = await require("./database-extra.cjs").connectExtra(
      p,
      workerData.password,
    );
    client = extra.client;
  } else if (p.type === "sqlite") {
    client = openSQLite(true);
  } else if (p.type === "postgres") {
    const { Client } = require("pg");
    client = new Client({
      host: p.host,
      port: p.port,
      user: p.username,
      password: workerData.password,
      database: p.database || undefined,
      ssl: p.tls ? { rejectUnauthorized: true } : false,
      connectionTimeoutMillis: 10000,
      statement_timeout: 20000,
      application_name: "LiteBox",
    });
    client.on("error", () => {
      parentPort.postMessage({
        fatal: true,
        error: "Database disconnected / 数据库连接已断开",
      });
    });
    await client.connect();
    await command("SET default_transaction_read_only = on");
  } else {
    client = require("mysql2").createConnection({
      host: p.host,
      port: p.port,
      user: p.username,
      password: workerData.password,
      database: p.database || undefined,
      ssl: p.tls ? { rejectUnauthorized: true } : undefined,
      connectTimeout: 10000,
      multipleStatements: false,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      rowsAsArray: true,
      enableKeepAlive: true,
      infileStreamFactory: () => {
        throw Error("Local file loading disabled");
      },
    });
    await new Promise((resolve, reject) => {
      client.connect((e) => (e ? reject(e) : resolve()));
    });
    client.on("error", () =>
      parentPort.postMessage({
        fatal: true,
        error: "Database disconnected / 数据库连接已断开",
      }),
    );
  }
  workerData.password = "";
}
function identifier(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.length > 255 ||
    name.includes("\0")
  )
    throw Error("Invalid identifier");
  const quote = p.type === "mysql" ? "`" : '"';
  return quote + name.split(quote).join(quote + quote) + quote;
}
async function catalog(paging) {
  if (extra) return extra.catalog(paging);
  if (p.type === "sqlite")
    return query(
      "SELECT 'main' AS schema_name, name AS table_name, type AS table_type FROM sqlite_schema WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
      [],
      paging,
    );
  if (p.type === "postgres")
    return query(
      "SELECT table_schema AS schema_name, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name",
      [],
      paging,
    );
  return query(
    "SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name, TABLE_TYPE AS table_type FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
    [],
    paging,
  );
}
async function columns(data) {
  if (extra) return extra.columns(data);
  identifier(data.schema);
  identifier(data.table);
  if (p.type === "sqlite")
    return query(
      'SELECT name AS column_name, type AS data_type, "notnull" AS not_null, pk AS primary_key FROM pragma_table_info(?)',
      [data.table],
      data.paging,
    );
  const placeholders = p.type === "postgres" ? ["$1", "$2"] : ["?", "?"];
  return query(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema=${placeholders[0]} AND table_name=${placeholders[1]} ORDER BY ordinal_position`,
    [data.schema, data.table],
    data.paging,
  );
}
async function mutate(data) {
  validateMutation(data);
  let affected = 0;
  if (["mongodb", "redis"].includes(p.type))
    affected = await extra.mutate(data);
  else {
    let begun = false;
    try {
      if (p.type === "sqlite") {
        client.close();
        client = openSQLite(false);
        client.exec("BEGIN IMMEDIATE");
        begun = true;
      } else if (p.type === "oracle") {
        begun = true;
      } else {
        await command(
          p.type === "postgres"
            ? "BEGIN READ WRITE"
            : "START TRANSACTION READ WRITE",
        );
        begun = true;
      }
      // MySQL rollback is only reliable for transactional tables.
      if (p.type === "mysql") {
        const info = await query(
          "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?",
          [data.schema, data.table],
        );
        if (info.rows[0]?.[0]?.toUpperCase() !== "INNODB")
          throw Error("Writes require an InnoDB table / 写入仅支持 InnoDB 表");
      }
      for (const record of data.action === "insert" ? data.records : [null]) {
        const { sql, params } = buildMutation(p.type, data, record);
        let count;
        if (p.type === "sqlite")
          count = Number(client.prepare(sql).run(...params).changes);
        else if (p.type === "oracle")
          count = (await client.execute(sql, params, { autoCommit: false }))
            .rowsAffected;
        else if (p.type === "postgres")
          count = (await client.query(sql, params)).rowCount;
        else
          count = await new Promise((resolve, reject) =>
            client.query(sql, params, (e, r) =>
              e ? reject(e) : resolve(r.affectedRows),
            ),
          );
        affected += count || 0;
        if (affected > 500)
          throw Error(
            "More than 500 affected rows; rolled back / 超过 500 行，已回滚",
          );
      }
      if (p.type === "sqlite") client.exec("COMMIT");
      else if (p.type === "oracle") await client.commit();
      else await command("COMMIT");
      begun = false;
    } catch (e) {
      if (begun) {
        if (p.type === "sqlite") client.exec("ROLLBACK");
        else if (p.type === "oracle") await client.rollback();
        else await command("ROLLBACK");
      }
      throw e;
    } finally {
      if (p.type === "sqlite") {
        try {
          client.close();
        } catch {}
        client = openSQLite(true);
      }
    }
  }
  return {
    columns: ["affected_rows"],
    rows: [[String(affected)]],
    truncated: false,
  };
}
parentPort.on("message", async (msg) => {
  const start = Date.now();
  try {
    let result;
    if (msg.op === "connect") {
      workerData = msg.data;
      p = workerData.profile;
      await connect();
      result = { connected: true };
    } else if (msg.op === "catalog") result = await catalog(msg.data?.paging);
    else if (msg.op === "columns") result = await columns(msg.data);
    else if (msg.op === "query") {
      const sql = ["mongodb", "redis"].includes(p.type)
        ? msg.data.sql
        : readQuery(msg.data.sql);
      if (extra) {
        if (p.type === "oracle")
          await client.execute("SET TRANSACTION READ ONLY");
        try {
          result = await query(sql, [], msg.data?.paging);
        } finally {
          if (p.type === "oracle") await client.rollback();
        }
      } else if (p.type === "sqlite")
        result = await query(sql, [], msg.data?.paging);
      else {
        await command(
          p.type === "postgres"
            ? "BEGIN READ ONLY"
            : "START TRANSACTION READ ONLY",
        );
        try {
          result = await query(sql, [], msg.data?.paging);
        } finally {
          await command("ROLLBACK");
        }
      }
    } else if (msg.op === "mutate") {
      if (msg.data.confirmed !== true) throw Error("Write not confirmed");
      result = await mutate(msg.data);
    } else throw Error("Unsupported database action");
    parentPort.postMessage({
      id: msg.id,
      result: { ...result, elapsedMs: Date.now() - start },
    });
  } catch (e) {
    parentPort.postMessage({
      id: msg.id,
      error: String(e.message || e).slice(0, 1500),
    });
  }
});

process.on("disconnect", () => process.exit(0));
