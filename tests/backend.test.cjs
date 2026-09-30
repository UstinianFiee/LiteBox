"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const {
  endpoint,
  server,
  cleanState,
  safeFilename,
  str,
  clipboardReadText,
} = require("../electron/validation.cjs");
const { atomicWrite, readJson } = require("../electron/storage.cjs");
const { buildPrompt, streamCompletion } = require("../electron/ai.cjs");
const fixture = () => ({
  version: 1,
  locale: "zh",
  theme: "light",
  favorites: [],
  recent: [],
  usage: {},
  order: {
    input: "001",
    size: 50,
    delimiter: "|",
    dedupe: false,
    quote: "",
    split: "auto",
    mode: "size",
  },
  markdown: { text: "", name: "Untitled.md", path: "" },
  servers: [],
  chats: [],
  snippets: [],
  ai: { endpoint: "", model: "", mode: "general", system: "" },
  dashboard: { csv: "", name: "", x: "", y: "", type: "bar" },
});
test("endpoint security", () => {
  assert.equal(
    endpoint("https://example.com/v1/chat/completions/"),
    "https://example.com/v1",
  );
  assert.equal(
    endpoint("http://127.0.0.1:1234/v1"),
    "http://127.0.0.1:1234/v1",
  );
  for (const url of [
    "http://remote.example/v1",
    "file:///tmp/x",
    "https://u:p@example.com",
    "https://example.com?key=secret",
  ])
    assert.throws(() => endpoint(url));
});
test("host validation", () => {
  const p = {
    id: "one",
    name: "test",
    host: "127.0.0.1",
    port: 22,
    username: "root",
    type: "ssh",
    group: "",
  };
  assert.equal(server(p).host, "127.0.0.1");
  for (const host of ["-flag", "host & calc", "foo\r\nbar", "host/path"])
    assert.throws(() => server({ ...p, host }));
  assert.throws(() => server({ ...p, port: 70000 }));
});
test("state strips unknown secrets and clamps batches", () => {
  const s = fixture();
  s.secret = "must not persist";
  s.ai.key = "test-key";
  s.order.size = -4;
  const result = cleanState(s);
  assert.equal(result.secret, undefined);
  assert.equal(result.ai.key, undefined);
  assert.equal(result.order.size, 1);
  assert.throws(() => cleanState({ ...s, version: 2 }));
});
test("string and filename validation", () => {
  assert.throws(() => str("a\0b"));
  assert.equal(safeFilename("../bad:name.txt"), "bad_name.txt");
});
test("atomic local storage and corrupt JSON", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "litebox-test-"));
  const f = path.join(dir, "state.json");
  try {
    atomicWrite(f, '{"a":1}');
    atomicWrite(f, '{"a":2}');
    assert.deepEqual(readJson(f), { a: 2 });
    assert.equal(fs.readdirSync(dir).length, 1);
    fs.writeFileSync(f, "oops");
    assert.throws(() => readJson(f));
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
test("debug prompt has guardrails and localization", () => {
  assert.match(buildPrompt("debug", "zh"), /Simplified Chinese/);
  assert.match(buildPrompt("debug", "en"), /non-destructive/);
  assert.match(buildPrompt("general", "en"), /cannot access files/);
});
async function mock(body, fn, status = 200, type = "text/event-stream") {
  const srv = http.createServer((req, res) => {
    req.resume();
    res.writeHead(status, { "content-type": type });
    if (Array.isArray(body)) {
      for (const byte of Buffer.from(body.join("")))
        res.write(Buffer.from([byte]));
      res.end();
    } else res.end(body);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try {
    return await fn(`http://127.0.0.1:${srv.address().port}`);
  } finally {
    srv.closeAllConnections();
    await new Promise((r) => srv.close(r));
  }
}
const request = (url, onText = () => {}) =>
  streamCompletion({
    url,
    key: "",
    model: "mock",
    messages: [{ role: "user", content: "test" }],
    signal: new AbortController().signal,
    onText,
  });
test("SSE parses fragmented UTF8 and CRLF", async () => {
  let result = "";
  await mock(
    [
      ": ping\r\n\r\n",
      'data: {"choices":[{"delta":{"content":"你好 🚀"}}]}\r\n\r\n',
      "data: [DONE]\r\n\r\n",
    ],
    (url) => request(url, (s) => (result += s)),
  );
  assert.equal(result, "你好 🚀");
});
test("SSE rejects truncated answers", async () => {
  await mock('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n', (url) =>
    assert.rejects(request(url), /unexpectedly/),
  );
});
test("SSE handles HTTP failure", async () => {
  await mock(
    "Unauthorized",
    (url) => assert.rejects(request(url), /401/),
    401,
    "text/plain",
  );
});
test("SSE rejects malformed events", async () => {
  await mock("data: not-json\n\n", (url) =>
    assert.rejects(request(url), /Malformed/),
  );
});
test("SSE rejects non-stream providers", async () => {
  await mock(
    "{}",
    (url) => assert.rejects(request(url), /SSE/),
    200,
    "application/json",
  );
});

test("SQL drafts migrate old backups and survive native validation", () => {
  const previous = cleanState(fixture());
  assert.equal(previous.sql.input, "");
  assert.match(previous.sql.template, /IN \(\{\{values\}\}\)/);
  const s = fixture();
  s.sql = {
    template: "SELECT * FROM t WHERE id IN ''",
    input: "00001\nO'Brien",
    dedupe: true,
    separator: "auto",
    password: "ignored",
  };
  s.favorites = ["sql"];
  s.recent = [{ page: "sql", at: 1 }];
  s.usage = { sql: 2 };
  const next = cleanState(s);
  assert.deepEqual(next.sql, {
    template: s.sql.template,
    input: s.sql.input,
    dedupe: true,
    separator: "auto",
  });
  assert.deepEqual(next.favorites, ["sql"]);
  assert.equal(next.usage.sql, 2);
  assert.equal(next.recent[0].page, "sql");
  assert.throws(() =>
    cleanState({ ...s, sql: { ...s.sql, input: "x".repeat(1024 * 1024 + 1) } }),
  );
});

test("database backup migration strips passwords and keeps safe connection profiles", () => {
  const s = fixture();
  assert.deepEqual(cleanState(s).databases, []);
  s.databases = [
    {
      id: "db1",
      name: "Local",
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "readonly",
      database: "app",
      path: "",
      tls: true,
      password: "never-save",
      connectionString: "never-save",
    },
  ];
  const saved = cleanState(s);
  assert.equal(saved.databases[0].password, undefined);
  assert.equal(saved.databases[0].connectionString, undefined);
  assert.equal(saved.databases[0].database, "app");
});

test("clipboard reads preserve untrusted control characters for guarded paste, without relaxing SSH validation", () => {
  for (const text of [
    "",
    "中文😀\r\nplain",
    "a\0b\0",
    "\0",
    "x".repeat(1024 * 1024),
  ])
    assert.equal(clipboardReadText(text), text);
  assert.throws(
    () => clipboardReadText("x".repeat(1024 * 1024 + 1)),
    /Clipboard text is too long/,
  );
  for (const invalid of [null, undefined, 1, {}, Buffer.from("text")])
    assert.throws(
      () => clipboardReadText(invalid),
      /Cannot read clipboard plain text/,
    );
  assert.throws(() => str("a\0b"), /Invalid/);
});
