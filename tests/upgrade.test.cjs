const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { collector, pageOptions } = require("../electron/database-paging.cjs");
const {
  createAttachmentStore,
  validate,
  knowledge,
  prepareMessages,
} = require("../electron/ai-attachments.cjs");
const { DatabaseSessions } = require("../electron/database.cjs");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "litebox-upgrade-"));
test("page collector validates bounds and preserves all rows across byte boundaries", () => {
  for (const p of [
    { limit: 0 },
    { limit: 1001 },
    { offset: -1 },
    { offset: 1.5 },
  ])
    assert.throws(() => pageOptions(p));
  const input = Array.from({ length: 11 }, (_, i) => [
      String(i),
      "长".repeat(250000),
    ]),
    out = [];
  let offset = 0,
    more;
  do {
    const c = collector({ offset, limit: 5 });
    for (const row of input) if (!c.accept(row)) break;
    const r = c.result(["id", "text"]);
    out.push(...r.rows);
    offset = r.nextOffset;
    more = r.hasMore;
    assert.equal(r.truncated, false);
  } while (more);
  assert.deepEqual(out, input);
});
test("first large cell is complete and oversize is explicit, never silently dropped", () => {
  const c = collector({ limit: 50 });
  c.accept(["x".repeat(2200000)]);
  assert.equal(c.result(["value"]).rows[0][0].length, 2200000);
  assert.throws(
    () => collector({ limit: 50 }).accept(["x".repeat(33 * 1024 * 1024)]),
    /32 MiB/,
  );
});
test("SQLite pages reach all 1205 records and 1003 catalog tables", async () => {
  const { DatabaseSync } = require("node:sqlite"),
    file = path.join(dir, "pages.sqlite"),
    db = new DatabaseSync(file);
  db.exec("BEGIN");
  for (let i = 0; i < 1003; i++) db.exec("CREATE TABLE t" + i + "(id INTEGER)");
  db.exec("COMMIT");
  db.close();
  const sessions = new DatabaseSessions();
  await sessions.connect({
    id: "pages",
    name: "Pages",
    type: "sqlite",
    host: "",
    port: 0,
    username: "",
    database: "",
    path: file,
    tls: false,
  });
  try {
    let offset = 0,
      more,
      rows = [];
    do {
      const r = await sessions.call("pages", "query", {
        sql: "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1205) SELECT x FROM n ORDER BY x",
        paging: { offset, limit: 200 },
      });
      rows.push(...r.rows);
      offset = r.nextOffset;
      more = r.hasMore;
    } while (more);
    assert.equal(rows.length, 1205);
    assert.equal(rows[0][0], "1");
    assert.equal(rows.at(-1)[0], "1205");
    assert.equal(new Set(rows.map((r) => r[0])).size, 1205);
    offset = 0;
    rows = [];
    do {
      const r = await sessions.call("pages", "catalog", {
        paging: { offset, limit: 200 },
      });
      rows.push(...r.rows);
      offset = r.nextOffset;
      more = r.hasMore;
    } while (more);
    assert.equal(rows.length, 1003);
    const r = await sessions.call("pages", "query", {
      sql: "SELECT X'00FF' AS data",
      paging: { offset: 0, limit: 50 },
    });
    assert.equal(r.rows[0][0], "base64:AP8=");
  } finally {
    sessions.closeAll();
  }
});
test("attachment store validates formats, persists across instances and never accepts arbitrary paths", () => {
  const store = createAttachmentStore(dir);
  const a = store.save({
    name: "error.log",
    data: Buffer.from("Error: example").toString("base64"),
  });
  const reload = createAttachmentStore(dir);
  assert.equal(reload.content([a])[0].type, "text");
  assert.match(reload.content([a])[0].text, /Error: example/);
  assert.throws(() => reload.preview("../state.json"));
  assert.throws(() =>
    validate({
      name: "payload.exe",
      data: Buffer.from("MZbinary").toString("base64"),
    }),
  );
  assert.throws(() => validate({ name: "x.txt", data: "!!!!" }));
  assert.throws(() =>
    validate({ name: "x.txt", data: Buffer.from([255, 0]).toString("base64") }),
  );
  assert.throws(() =>
    validate({
      name: "x.txt",
      data: Buffer.alloc(513 * 1024, 65).toString("base64"),
    }),
  );
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  const img = store.save({ name: "fixture.png", data: png });
  assert.equal(img.kind, "image");
  assert.equal(store.preview(img.id), "data:image/png;base64," + png);
  const wire = prepareMessages(
    [
      {
        role: "user",
        content: "Explain",
        attachments: [a, img],
        knowledge: [{ id: "r1", title: "Example", content: "Reference text" }],
      },
    ],
    store,
  );
  assert.equal(wire[0].content.at(-1).type, "image_url");
  assert.match(wire[0].content[1].text, /untrusted/);
  assert.throws(() =>
    prepareMessages(
      [{ role: "assistant", content: "x", attachments: [img] }],
      store,
    ),
  );
  assert.throws(() => store.content(Array(6).fill(img)));
  assert.throws(() =>
    knowledge([{ id: "r", title: "x", content: "x".repeat(6001) }]),
  );
});
