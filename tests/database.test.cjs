const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { DatabaseSessions } = require("../electron/database.cjs");
const { profile, readQuery } = require("../electron/database-validation.cjs");
const p = {
  id: "test",
  name: "Fixture",
  type: "sqlite",
  host: "",
  port: 0,
  username: "",
  database: "",
  path: "",
  tls: false,
};
test("database profiles whitelist properties and validate network targets", () => {
  assert.equal(
    profile({ ...p, password: "secret", extra: "secret" }).password,
    undefined,
  );
  assert.throws(() => profile({ ...p, type: "oracle" }));
  assert.throws(() =>
    profile({
      ...p,
      type: "mysql",
      host: "-bad",
      port: 3306,
      username: "root",
    }),
  );
  assert.throws(() =>
    profile({
      ...p,
      type: "postgres",
      host: "localhost",
      port: 0,
      username: "me",
    }),
  );
  assert.equal(
    profile({
      ...p,
      type: "postgres",
      host: "::1",
      port: 5432,
      username: "me",
      tls: true,
    }).tls,
    true,
  );
});
test("single-read gate permits quoted identifiers and rejects writes / multi-statements", () => {
  for (const sql of [
    "SELECT 1;",
    "SELECT 'semi;colon' AS value",
    "-- note\nWITH x AS (SELECT 1) SELECT * FROM x",
    'SELECT "update", `create` FROM t',
    "SELECT 'it''s fine'",
  ])
    assert.equal(readQuery(sql), sql);
  for (const sql of [
    "DELETE FROM t",
    "SELECT 1; SELECT 2",
    "WITH a AS (DELETE FROM t RETURNING *) SELECT * FROM a",
    "SELECT * INTO OUTFILE '/tmp/a' FROM t",
    "SELECT 1 /*!50000 INTO OUTFILE x */",
    "SELECT 'unclosed",
    "ATTACH DATABASE 'x' AS other",
    "SELECT $$dollar$$",
    "SELECT 1 /* missing",
    "SELECT 1 /* /* */ UPDATE t SET x=1 */",
    "SELECT 'back\\slash'",
  ])
    assert.throws(() => readQuery(sql), sql);
});
test("SQLite real connections: catalog, structure, exact values, duplicate columns, limits, cancellation", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "litebox-db-test-"));
  const file = path.join(dir, "fixture.sqlite");
  const db = new DatabaseSync(file);
  db.exec(
    "CREATE TABLE orders(order_no TEXT, amount INTEGER, note TEXT); INSERT INTO orders VALUES ('00001234', 9007199254740993, NULL), ('DEMO-02', 4, '=1+1');",
  );
  db.close();
  const before = fs.readFileSync(file);
  const sessions = new DatabaseSessions();
  try {
    await sessions.connect({ ...p, path: file });
    assert.equal((await sessions.call("test", "catalog")).rows[0][1], "orders");
    assert.equal(
      (
        await sessions.call("test", "columns", {
          schema: "main",
          table: "orders",
        })
      ).rows[0][0],
      "order_no",
    );
    const q = await sessions.call("test", "query", {
      sql: "SELECT * FROM orders",
    });
    assert.deepEqual(q.rows[0], ["00001234", "9007199254740993", null]);
    assert.deepEqual(
      (
        await sessions.call("test", "query", {
          sql: "SELECT 1 AS same, 2 AS same",
        })
      ).rows,
      [["1", "2"]],
    );
    assert.throws(() =>
      sessions.call("test", "query", { sql: "DELETE FROM orders" }),
    );
    await assert.rejects(
      sessions.call("test", "query", { sql: "SELECT * FROM missing_table" }),
      /no such table/,
    );
    assert.equal(
      (await sessions.call("test", "query", { sql: "SELECT 1" })).rows[0][0],
      "1",
    );
    const many = await sessions.call("test", "query", {
      sql: "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1200) SELECT * FROM n",
    });
    assert.equal(many.rows.length, 1000);
    assert.equal(many.truncated, true);
    const large = await sessions.call("test", "query", {
      sql: "SELECT hex(zeroblob(1100000))",
    });
    assert.equal(large.truncated, false);
    assert.equal(large.rows.length, 1);
    assert.equal(large.rows[0][0].length, 2200000);
    const pending = sessions.call("test", "query", {
      sql: "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n",
    });
    sessions.close("test", "canceled");
    await assert.rejects(pending, /canceled/);
    await sessions.connect({ ...p, path: file });
    const timeout = sessions.call(
      "test",
      "query",
      {
        sql: "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n",
      },
      15,
    );
    await assert.rejects(timeout, /timed out/);
    assert.equal(sessions.sessions.size, 0);
    assert.deepEqual(fs.readFileSync(file), before);
  } finally {
    sessions.closeAll();
  }
  // Fixture retained in OS temp; do not recursively delete computed Windows paths.
});
test("failed database connection leaves no wedged session", async () => {
  const sessions = new DatabaseSessions();
  await assert.rejects(
    sessions.connect({
      ...p,
      path: path.join(
        os.tmpdir(),
        "does-not-exist-litebox-" +
          require("node:crypto").randomUUID() +
          ".sqlite",
      ),
    }),
  );
  assert.equal(sessions.sessions.size, 0);
});

test("PostgreSQL cursor preserves fields when its final read omits result metadata", async () => {
  const vm = require("node:vm");
  // Exercise the actual worker query path with pg-cursor's documented callback shape.
  // This is a driver-contract regression test, not a live PostgreSQL integration test.
  for (const count of [0, 3, 100, 101, 1001]) {
    let listener,
      response,
      closed = false;
    const commands = [];
    class Cursor {
      constructor() {
        this.offset = 0;
      }
      read(size, callback) {
        if (this.offset >= count && this.offset !== 0)
          return callback(null, []);
        const end = Math.min(count, this.offset + size);
        const rows = Array.from({ length: end - this.offset }, (_, i) => [
          String(this.offset + i),
        ]);
        this.offset = end || 1;
        callback(null, rows, { fields: [{ name: "value" }] });
      }
      async close() {
        closed = true;
      }
    }
    class Client {
      on() {}
      async connect() {}
      query(q) {
        if (q instanceof Cursor) return q;
        commands.push(q);
        return Promise.resolve({});
      }
    }
    vm.runInNewContext(
      fs.readFileSync(
        path.join(__dirname, "../electron/database-worker.cjs"),
        "utf8",
      ),
      {
        Buffer,
        require(name) {
          if (name === "./database-paging.cjs")
            return require("../electron/database-paging.cjs");
          if (name === "pg") return { Client };
          if (name === "pg-cursor") return Cursor;
          if (name === "./database-validation.cjs") return { readQuery };
          if (name === "./database-mutations.cjs")
            return require("../electron/database-mutations.cjs");
          throw Error("Unexpected module: " + name);
        },
        process: {
          connected: true,
          send(message) {
            response = message;
          },
          on(event, fn) {
            if (event === "message") listener = fn;
          },
        },
      },
    );
    await listener({
      id: 1,
      op: "connect",
      data: { profile: { ...p, type: "postgres" }, password: "" },
    });
    assert.equal(response.error, undefined);
    await listener({
      id: 2,
      op: "query",
      data: { sql: "SELECT value FROM fixture" },
    });
    assert.equal(response.error, undefined);
    assert.equal(response.result.columns.join(), "value");
    assert.equal(response.result.rows.length, Math.min(count, 1000));
    assert.equal(response.result.truncated, count > 1000);
    assert.equal(closed, true);
    assert.equal(commands.at(-1), "ROLLBACK");
  }
});
test("all six profile types validate without persisting secrets", () => {
  for (const [type, port, username, database] of [
    ["oracle", 1521, "scott", "FREEPDB1"],
    ["mongodb", 27017, "", "test"],
    ["redis", 6379, "", "0"],
  ]) {
    const r = profile({
      ...p,
      type,
      host: "127.0.0.1",
      port,
      username,
      database,
      password: "not-saved",
      authSource: "admin",
    });
    assert.equal(r.type, type);
    assert.equal(r.password, undefined);
  }
  assert.throws(() =>
    profile({
      ...p,
      type: "redis",
      host: "localhost",
      port: 6379,
      database: "-1",
    }),
  );
});
test("parameterized mutation builder rejects empty filters and keeps payload out of SQL", () => {
  const {
    buildMutation,
    validateMutation,
  } = require("../electron/database-mutations.cjs");
  const data = {
    action: "update",
    schema: "public",
    table: "orders",
    where: { id: "x" },
    values: { note: "x'; DELETE FROM orders; --" },
  };
  const r = buildMutation("postgres", data);
  assert.match(r.sql, /"note"=\$1/);
  assert.equal(r.params[0], data.values.note);
  assert(!r.sql.includes("DELETE"));
  assert.match(buildMutation("oracle", data).sql, /:1/);
  assert.throws(() => validateMutation({ ...data, where: {} }));
  assert.throws(() => validateMutation({ ...data, action: "drop" }));
});
test("SQLite structured CRUD is confirmed, transactional and restores readonly queries", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "litebox-crud-"));
  const file = path.join(dir, "crud.sqlite");
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE items (id TEXT PRIMARY KEY, note TEXT);");
  db.close();
  const sessions = new DatabaseSessions();
  const data = {
    action: "insert",
    schema: "main",
    table: "items",
    records: [
      { id: "0001", note: "O'Reilly" },
      { id: "0002", note: null },
    ],
  };
  try {
    await sessions.connect({ ...p, path: file });
    await assert.rejects(sessions.call("test", "mutate", data), /confirmed/);
    let r = await sessions.call("test", "mutate", { ...data, confirmed: true });
    assert.equal(r.rows[0][0], "2");
    r = await sessions.call("test", "query", {
      sql: "SELECT * FROM items ORDER BY id",
    });
    assert.deepEqual(r.rows, [
      ["0001", "O'Reilly"],
      ["0002", null],
    ]);
    await assert.rejects(
      sessions.call("test", "mutate", {
        ...data,
        records: [
          { id: "0003", note: "rollback" },
          { id: "0001", note: "duplicate" },
        ],
        confirmed: true,
      }),
      /UNIQUE/,
    );
    assert.equal(
      (
        await sessions.call("test", "query", {
          sql: "SELECT count(*) FROM items",
        })
      ).rows[0][0],
      "2",
    );
    await sessions.call("test", "mutate", {
      action: "update",
      schema: "main",
      table: "items",
      where: { id: "0002" },
      values: { note: "changed" },
      confirmed: true,
    });
    assert.equal(
      (
        await sessions.call("test", "query", {
          sql: "SELECT note FROM items WHERE id='0002'",
        })
      ).rows[0][0],
      "changed",
    );
    await assert.rejects(
      sessions.call("test", "mutate", {
        action: "delete",
        schema: "main",
        table: "items",
        where: {},
        confirmed: true,
      }),
      /nonempty/,
    );
    await sessions.call("test", "mutate", {
      action: "delete",
      schema: "main",
      table: "items",
      where: { id: "0002" },
      confirmed: true,
    });
    assert.equal(
      (
        await sessions.call("test", "query", {
          sql: "SELECT count(*) FROM items",
        })
      ).rows[0][0],
      "1",
    );
    assert.throws(
      () => sessions.call("test", "query", { sql: "DELETE FROM items" }),
      /read query/,
    );
  } finally {
    sessions.closeAll();
  }
});
test("SQLite write over 500 rows rolls back", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "litebox-write-cap-"));
  const file = path.join(dir, "cap.sqlite");
  const db = new DatabaseSync(file);
  db.exec(
    "CREATE TABLE items(id INTEGER, tag TEXT); WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<501) INSERT INTO items SELECT x,'old' FROM n",
  );
  db.close();
  const s = new DatabaseSessions();
  try {
    await s.connect({ ...p, path: file });
    await assert.rejects(
      s.call("test", "mutate", {
        action: "update",
        schema: "main",
        table: "items",
        where: { tag: "old" },
        values: { tag: "new" },
        confirmed: true,
      }),
      /500/,
    );
    assert.equal(
      (
        await s.call("test", "query", {
          sql: "SELECT count(*) FROM items WHERE tag='old'",
        })
      ).rows[0][0],
      "501",
    );
  } finally {
    s.closeAll();
  }
});
test("credential vault encrypts, binds destination, survives reload and forgets without plaintext", () => {
  const { createVault } = require("../electron/database-secrets.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "litebox-vault-"));
  const key = require("node:crypto").randomBytes(32);
  const crypto = require("node:crypto");
  const safe = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
      return Buffer.concat([iv, cipher.update(value, "utf8"), cipher.final()]);
    },
    decryptString: (bytes) => {
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        key,
        bytes.subarray(0, 16),
      );
      return Buffer.concat([
        decipher.update(bytes.subarray(16)),
        decipher.final(),
      ]).toString();
    },
  };
  const v = createVault(dir, safe),
    target = {
      ...p,
      type: "mysql",
      host: "localhost",
      port: 3306,
      username: "me",
    };
  v.save(target, "secret-password");
  assert.equal(v.get(target), "secret-password");
  assert.equal(v.status(target), true);
  assert(
    !fs
      .readFileSync(path.join(dir, "database-secrets.json"), "utf8")
      .includes("secret-password"),
  );
  assert.equal(v.get({ ...target, host: "other-host" }), "");
  assert.equal(v.get({ ...target, tls: true }), "");
  assert.equal(createVault(dir, safe).get(target), "secret-password");
  v.forget(target);
  assert.equal(v.status(target), false);
  assert.throws(
    () =>
      createVault(dir, { isEncryptionAvailable: () => false }).save(
        target,
        "secret",
      ),
    /encryption/,
  );
});
test("Oracle adapter contract: thin connection, bounded result set, precise numbers, binds and close", async () => {
  const vm = require("node:vm");
  let options,
    closed = false,
    executed;
  const oracle = {
    DB_TYPE_NUMBER: 2,
    STRING: 2001,
    async getConnection(config) {
      options = config;
      return {
        callTimeout: 0,
        async execute(sql, params, opts) {
          executed = { sql, params, opts };
          let n = 0;
          return {
            metaData: [{ name: "ID" }],
            resultSet: {
              async getRow() {
                return n++ === 0 ? ["9007199254740993"] : null;
              },
              async close() {
                closed = true;
              },
            },
          };
        },
      };
    },
  };
  const scope = {
    module: { exports: {} },
    Buffer,
    require: (n) =>
      n === "./database-paging.cjs"
        ? require("../electron/database-paging.cjs")
        : n === "oracledb"
          ? oracle
          : require("../electron/database-mutations.cjs"),
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../electron/database-extra.cjs"),
      "utf8",
    ),
    scope,
  );
  const a = await scope.module.exports.connectExtra(
    {
      ...p,
      type: "oracle",
      host: "localhost",
      port: 1521,
      username: "u",
      database: "FREEPDB1",
      tls: false,
    },
    "pw",
  );
  assert.equal(options.connectString, "tcp://localhost:1521/FREEPDB1");
  assert.equal(options.password, "pw");
  const r = await a.query("SELECT id FROM t;");
  assert.equal(r.rows[0][0], "9007199254740993");
  assert.equal(closed, true);
  assert.equal(executed.sql, "SELECT id FROM t");
  assert.equal(executed.opts.fetchTypeHandler({ dbType: 2 }).type, 2001);
  await a.columns({ schema: "U", table: "X'" });
  assert.equal(executed.params[1], "X'");
});
test("MongoDB adapter contract: EJSON, find only, target checks and single-document CRUD", async () => {
  const vm = require("node:vm");
  const BSON = require("mongodb").BSON;
  let opts,
    inserted,
    closed = false,
    matches = 1;
  const collection = {
    find() {
      return {
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        async *[Symbol.asyncIterator]() {
          yield {
            _id: new BSON.ObjectId("507f1f77bcf86cd799439011"),
            n: BSON.Long.fromString("9007199254740993"),
          };
        },
        async close() {
          closed = true;
        },
      };
    },
    async insertOne(doc) {
      inserted = doc;
      return { insertedId: doc._id };
    },
    async countDocuments() {
      return matches;
    },
    async updateOne() {
      return { modifiedCount: 1 };
    },
    async deleteOne() {
      return { deletedCount: 1 };
    },
  };
  const db = {
    databaseName: "test",
    async command() {
      return {};
    },
    collection() {
      return collection;
    },
    listCollections() {
      return {
        async *[Symbol.asyncIterator]() {
          yield { name: "items" };
        },
      };
    },
  };
  class MongoClient {
    constructor(uri, options) {
      opts = options;
    }
    async connect() {}
    db() {
      return db;
    }
  }
  const scope = {
    module: { exports: {} },
    Buffer,
    require: (n) =>
      n === "./database-paging.cjs"
        ? require("../electron/database-paging.cjs")
        : n === "mongodb"
          ? { MongoClient, BSON }
          : require("../electron/database-mutations.cjs"),
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../electron/database-extra.cjs"),
      "utf8",
    ),
    scope,
  );
  const a = await scope.module.exports.connectExtra(
    {
      ...p,
      type: "mongodb",
      host: "localhost",
      port: 27017,
      database: "test",
      username: "u",
      authSource: "admin",
    },
    "pw",
  );
  assert.equal(opts.auth.password, "pw");
  assert.equal(opts.authSource, "admin");
  const r = await a.query('{"action":"find","collection":"items"}');
  assert.match(r.rows[0][0], /\$numberLong/);
  assert.match(r.rows[0][0], /9007199254740993/);
  assert(closed);
  await assert.rejects(
    a.query('{"action":"delete","collection":"items"}'),
    /find/,
  );
  const data = {
    schema: "test",
    table: "items",
    action: "insert",
    records: [{ n: { $numberLong: "9007199254740993" } }],
  };
  await a.mutate(data);
  assert.equal(inserted.n.toString(), "9007199254740993");
  await assert.rejects(a.mutate({ ...data, schema: "other" }), /database/);
  await assert.rejects(a.mutate({ ...data, records: [{}, {}] }));
  assert.equal(
    await a.mutate({
      schema: "test",
      table: "items",
      action: "update",
      where: { id: 1 },
      values: { name: "x" },
    }),
    1,
  );
  matches = 2;
  await assert.rejects(
    a.mutate({
      schema: "test",
      table: "items",
      action: "delete",
      where: { id: 1 },
    }),
    /multiple/,
  );
});
test("Redis adapter contract: authentication, bounded read allowlist, cursor and atomic key writes", async () => {
  const vm = require("node:vm");
  let opts, last;
  const client = {
    on() {},
    async connect() {},
    async ping() {},
    async type() {
      return "string";
    },
    async del() {
      return 1;
    },
    async sendCommand(args) {
      last = args;
      if (args[0] === "SCAN")
        return ["0", Array.from({ length: 1002 }, (_, i) => "key" + i)];
      if (args[0] === "GET") return null;
      return "OK";
    },
  };
  const scope = {
    module: { exports: {} },
    Buffer,
    require: (n) =>
      n === "./database-paging.cjs"
        ? require("../electron/database-paging.cjs")
        : n === "redis"
          ? {
              createClient: (options) => {
                opts = options;
                return client;
              },
            }
          : require("../electron/database-mutations.cjs"),
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../electron/database-extra.cjs"),
      "utf8",
    ),
    scope,
  );
  const a = await scope.module.exports.connectExtra(
    { ...p, type: "redis", host: "localhost", port: 6379, database: "0" },
    "pw",
  );
  assert.equal(opts.password, "pw");
  assert.equal((await a.catalog()).truncated, true);
  assert.equal((await a.query('["GET","missing"]')).rows[0][0], null);
  await assert.rejects(a.query('["FLUSHALL"]'), /Allowed/);
  await assert.rejects(a.query('["LRANGE","key","bad","-1"]'), /Invalid/);
  await a.query('["SCAN","42","COUNT","999999"]');
  assert.equal(last.join(" "), "SCAN 42 COUNT 200");
  await a.query('["SCAN","0","MATCH","app:*","TYPE","string","COUNT","99"]');
  assert.equal(last.join(" "), "SCAN 0 MATCH app:* TYPE string COUNT 200");
  await assert.rejects(a.query('["SCAN","0","MATCH"]'), /Invalid/);
  await assert.rejects(a.query('["SCAN","0","COUNT","0"]'), /Invalid/);
  await assert.rejects(
    a.query('["SCAN","0","MATCH","x","MATCH","y"]'),
    /Invalid/,
  );
  await a.mutate({
    schema: "0",
    table: "key",
    action: "update",
    where: { key: "key" },
    values: { value: "x" },
  });
  assert.equal(last.join(" "), "SET key x XX KEEPTTL");
  await assert.rejects(
    a.mutate({
      schema: "1",
      table: "key",
      action: "delete",
      where: { key: "key" },
    }),
    /database/,
  );
});
