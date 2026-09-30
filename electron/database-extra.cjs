const { validateMutation } = require("./database-mutations.cjs");
const { collector, pageOptions } = require("./database-paging.cjs");
function limited(columns, input, paging) {
  const page = collector(paging);
  for (const row of input) if (!page.accept(row)) break;
  return page.result(columns);
}
async function connectExtra(p, password) {
  const host = p.host.includes(":") ? `[${p.host}]` : p.host;
  if (p.type === "oracle") {
    const oracle = require("oracledb");
    const client = await oracle.getConnection({
      user: p.username,
      password,
      connectString: `${p.tls ? "tcps" : "tcp"}://${host}:${p.port}/${p.database}`,
    });
    client.callTimeout = 20000;
    const query = async (sql, params = [], paging) => {
      const r = await client.execute(sql.replace(/;\s*$/, ""), params, {
        resultSet: true,
        fetchTypeHandler: (meta) =>
          [
            oracle.DB_TYPE_NUMBER,
            oracle.DB_TYPE_CLOB,
            oracle.DB_TYPE_NCLOB,
          ].includes(meta.dbType)
            ? { type: oracle.STRING }
            : meta.dbType === oracle.DB_TYPE_BLOB
              ? { type: oracle.BUFFER }
              : undefined,
      });
      const page = collector(paging);
      try {
        while (true) {
          const row = await r.resultSet.getRow();
          if (!row) break;
          const values = row.map((v) =>
            v == null
              ? null
              : v instanceof Date
                ? v.toISOString()
                : Buffer.isBuffer(v)
                  ? "base64:" + v.toString("base64")
                  : typeof v === "object"
                    ? JSON.stringify(v)
                    : String(v),
          );
          if (!page.accept(values)) break;
        }
      } finally {
        await r.resultSet?.close();
      }
      return page.result(r.metaData.map((c) => c.name));
    };
    return {
      client,
      query,
      catalog: (paging) =>
        query(
          "SELECT owner, table_name, 'TABLE' FROM all_tables WHERE owner=USER ORDER BY table_name",
          [],
          paging,
        ),
      columns: (d) =>
        query(
          "SELECT column_name, data_type, nullable, data_default FROM all_tab_columns WHERE owner=:1 AND table_name=:2 ORDER BY column_id",
          [d.schema, d.table],
          d.paging,
        ),
    };
  }
  if (p.type === "mongodb") {
    if (password && !p.username)
      throw Error(
        "MongoDB password authentication requires a username / MongoDB 密码认证需要填写用户名",
      );
    const { MongoClient, BSON } = require("mongodb");
    const client = new MongoClient(`mongodb://${host}:${p.port}`, {
      tls: p.tls,
      auth: p.username ? { username: p.username, password } : undefined,
      authSource: p.authSource || "admin",
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
    });
    await client.connect();
    const db = client.db(p.database || "test");
    await db.command({ ping: 1 });
    const encode = (v) =>
      JSON.stringify(BSON.EJSON.serialize(v, { relaxed: false }));
    const decode = (v) => BSON.EJSON.deserialize(v, { relaxed: false });
    return {
      client,
      catalog: async (paging) => {
        const page = collector(paging),
          cursor = db.listCollections({}, { nameOnly: true });
        try {
          for await (const c of cursor)
            if (!page.accept([db.databaseName, c.name, "COLLECTION"])) break;
        } finally {
          await cursor.close();
        }
        return page.result(["database", "collection", "type"]);
      },
      columns: async () =>
        limited(
          ["format"],
          [["MongoDB Extended JSON; document schema may vary"]],
        ),
      query: async (text, params = [], paging) => {
        const d = JSON.parse(text, (key, value) => {
          if (
            typeof value === "number" &&
            Number.isInteger(value) &&
            !Number.isSafeInteger(value)
          )
            throw Error(
              "Use Extended JSON for large integers / 大整数请使用 Extended JSON",
            );
          if (["$where", "$function", "$accumulator"].includes(key))
            throw Error(
              "Server-side JavaScript is disabled / 禁止服务端 JavaScript",
            );
          return value;
        });
        if (d.action !== "find" || typeof d.collection !== "string")
          throw Error('Use {"action":"find","collection":"name","filter":{}}');
        const cursor = db
          .collection(d.collection)
          .find(decode(d.filter || {}), { maxTimeMS: 20000 })
          .sort(decode(d.sort || { _id: 1 }));
        if (d.limit !== undefined) {
          if (!Number.isSafeInteger(d.limit) || d.limit < 1)
            throw Error("Invalid find limit");
          cursor.limit(d.limit);
        }
        const page = collector(paging);
        try {
          for await (const doc of cursor)
            if (!page.accept([encode(doc)])) break;
        } finally {
          await cursor.close();
        }
        return page.result(["document"]);
      },
      mutate: async (d) => {
        validateMutation(d);
        if (d.schema !== db.databaseName)
          throw Error(
            "Target database does not match active connection / 目标库与当前连接不一致",
          );
        const c = db.collection(d.table);
        // Bulk document imports are intentionally unsupported without a transaction-capable topology.
        if (d.action === "insert") {
          if (d.records.length !== 1)
            throw Error(
              "MongoDB inserts one document at a time / MongoDB 每次新增一条文档",
            );
          const r = await c.insertOne(decode(d.records[0]));
          return 1;
        }
        const filter = decode(d.where);
        if (Object.keys(filter).some((k) => k.startsWith("$")))
          throw Error("Use a field-based filter");
        const count = await c.countDocuments(filter, {
          limit: 2,
          maxTimeMS: 20000,
        });
        if (count > 1)
          throw Error(
            "Filter matches multiple documents; use _id / 匹配多条文档，请使用 _id",
          );
        return d.action === "delete"
          ? (await c.deleteOne(filter)).deletedCount
          : (await c.updateOne(filter, { $set: decode(d.values) }))
              .modifiedCount;
      },
    };
  }
  const { createClient } = require("redis");
  const client = createClient({
    socket: {
      host: p.host,
      port: p.port,
      tls: p.tls,
      connectTimeout: 10000,
      reconnectStrategy: false,
    },
    username: p.username || undefined,
    password: password || undefined,
    database: Number(p.database || 0),
  });
  client.on("error", () => {});
  await client.connect();
  await client.ping();
  return {
    client,
    catalog: async (paging) => {
      const page = collector(paging),
        seen = new Set();
      let cursor = "0",
        stop = false;
      do {
        const response = await client.sendCommand([
          "SCAN",
          cursor,
          "COUNT",
          "200",
        ]);
        cursor = response[0];
        for (const key of response[1]) {
          if (seen.has(key)) continue;
          seen.add(key);
          if (!page.accept([String(p.database || 0), key, "KEY"])) {
            stop = true;
            break;
          }
        }
      } while (cursor !== "0" && !stop);
      return page.result(["database", "key", "type"]);
    },
    columns: async (d) =>
      limited(["key", "type"], [[d.table, await client.type(d.table)]]),
    query: async (text, params = [], paging) => {
      const args = JSON.parse(text);
      const allowed = {
        GET: [2, 2],
        MGET: [2, 101],
        TYPE: [2, 2],
        TTL: [2, 2],
        EXISTS: [2, 101],
        HGET: [3, 3],
        LRANGE: [4, 4],
        SCAN: [2, 8],
      };
      if (!Array.isArray(args) || !args.every((x) => typeof x === "string"))
        throw Error("Redis requires a JSON array of strings");
      const name = args[0]?.toUpperCase();
      const limits = allowed[name];
      if (!limits || args.length < limits[0] || args.length > limits[1])
        throw Error(
          "Allowed: GET / MGET / TYPE / TTL / EXISTS / HGET / LRANGE / SCAN",
        );
      if (name === "LRANGE") {
        if (!/^-?\d+$/.test(args[2]) || !/^-?\d+$/.test(args[3]))
          throw Error("Invalid LRANGE range");
        const { offset, limit } = pageOptions(paging),
          length = await client.lLen(args[1]);
        const start = Math.max(
          0,
          Number(args[2]) < 0 ? length + Number(args[2]) : Number(args[2]),
        );
        const end = Math.min(
          length - 1,
          Number(args[3]) < 0 ? length + Number(args[3]) : Number(args[3]),
        );
        const values =
          start + offset > end
            ? []
            : await client.sendCommand([
                "LRANGE",
                args[1],
                String(start + offset),
                String(Math.min(end, start + offset + limit)),
              ]);
        const r = limited(
          ["value"],
          values.map((v) => [v]),
          paging ? { ...paging, offset: 0 } : undefined,
        );
        return { ...r, offset, nextOffset: offset + r.rows.length };
      }
      if (name === "SCAN") {
        if (!/^\d+$/.test(args[1])) throw Error("Invalid SCAN cursor");
        const scanOptions = [],
          optionNames = new Set();
        for (let i = 2; i < args.length; i += 2) {
          const option = args[i].toUpperCase(),
            value = args[i + 1];
          if (
            !["MATCH", "COUNT", "TYPE"].includes(option) ||
            value === undefined ||
            optionNames.has(option)
          )
            throw Error("Invalid or duplicate SCAN option");
          optionNames.add(option);
          if (option === "COUNT") {
            if (
              !/^\d+$/.test(value) ||
              !Number.isSafeInteger(Number(value)) ||
              Number(value) < 1
            )
              throw Error("Invalid SCAN COUNT");
          } else scanOptions.push(option, value);
        }
        const page = collector(paging),
          seen = new Set();
        let cursor = args[1],
          stop = false;
        do {
          const value = await client.sendCommand([
            "SCAN",
            cursor,
            ...scanOptions,
            "COUNT",
            "200",
          ]);
          cursor = value[0];
          for (const key of value[1]) {
            if (seen.has(key)) continue;
            seen.add(key);
            if (!page.accept([key])) {
              stop = true;
              break;
            }
          }
        } while (cursor !== "0" && !stop);
        return page.result(["key"]);
      }
      const value = await client.sendCommand(args);
      return limited(
        ["value"],
        (Array.isArray(value) ? value : [value]).map((v) => [
          v == null
            ? null
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v),
        ]),
        paging,
      );
    },
    mutate: async (d) => {
      validateMutation(d);
      if (d.schema !== String(p.database || 0))
        throw Error(
          "Target database does not match active connection / 目标库与当前连接不一致",
        );
      if (d.action === "delete") {
        if (d.where.key !== d.table)
          throw Error("Filter key must match selected key");
        return client.del(d.table);
      }
      const v = d.action === "insert" ? d.records[0] : d.values;
      if (d.action === "insert" && d.records.length !== 1)
        throw Error("Redis writes one key at a time");
      if (d.action === "update" && d.where.key !== d.table)
        throw Error("Filter key must match selected key");
      if (typeof v.value !== "string")
        throw Error('Redis requires {"value":"text"}');
      const args = [
        "SET",
        d.table,
        v.value,
        d.action === "insert" ? "NX" : "XX",
      ];
      if (d.action === "update") args.push("KEEPTTL");
      return (await client.sendCommand(args)) === "OK" ? 1 : 0;
    },
  };
}
module.exports = { connectExtra, limited };
