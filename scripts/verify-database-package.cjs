"use strict";
// Verify drivers and forked SQLite work from the actual packaged archive/runtime.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
if (process.argv[2] !== "--child") {
  const { spawnSync } = require("node:child_process");
  const exe = path.resolve(process.argv[2]);
  const archive = path.join(path.dirname(exe), "resources", "app.asar");
  const run = spawnSync(exe, [__filename, "--child", archive], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    windowsHide: true,
    encoding: "utf8",
    timeout: 30000,
  });
  process.stdout.write(run.stdout || "");
  process.stderr.write(run.stderr || "");
  if (run.error) console.error(run.error);
  process.exit(run.status ?? 1);
} else {
  (async () => {
    const archive = process.argv[3];
    const requireApp = require("node:module").createRequire(
      path.join(archive, "package.json"),
    );
    const dependencies = ["mysql2", "pg", "pg-cursor", "ssh2", "oracledb", "mongodb", "redis"];
    for (const name of dependencies) {
      assert(
        requireApp.resolve(name).startsWith(archive),
        "Driver escaped packaged archive: " + name,
      );
      requireApp(name);
    }
    const { DatabaseSync } = require("node:sqlite");
    const dir = fs.mkdtempSync(
      path.join(require("node:os").tmpdir(), "litebox-packaged-db-"),
    );
    const file = path.join(dir, "fixture.sqlite");
    const db = new DatabaseSync(file);
    db.exec(
      "CREATE TABLE orders(id TEXT, amount INTEGER); INSERT INTO orders VALUES ('0000123', 9007199254740993)",
    );
    db.close();
    const original = fs.readFileSync(file);
    const { DatabaseSessions } = requireApp("./electron/database.cjs");
    const sessions = new DatabaseSessions();
    const profile = {
      id: "packaged-test",
      name: "Isolated fixture",
      type: "sqlite",
      host: "",
      port: 0,
      username: "",
      database: "",
      path: file,
      tls: false,
    };
    try {
      await sessions.connect(profile);
      assert.equal(
        (await sessions.call(profile.id, "catalog")).rows[0][1],
        "orders",
      );
      const result = await sessions.call(profile.id, "query", {
        sql: "SELECT * FROM orders",
      });
      assert.deepEqual(result.rows, [["0000123", "9007199254740993"]]);
      const pending = sessions.call(profile.id, "query", {
        sql: "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n",
      });
      sessions.close(profile.id, "canceled");
      await assert.rejects(pending, /canceled/);
      assert.deepEqual(fs.readFileSync(file), original);
      console.log(
        JSON.stringify(
          {
            passed: true,
            runtime: process.versions.electron,
            archive,
            packagedDrivers: dependencies,
            forkedSQLite: true,
            exactIntegers: true,
            cancellation: true,
            noDatabaseWrites: true,
          },
          null,
          2,
        ),
      );
    } finally {
      sessions.closeAll();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
