const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRemoteVault } = require("../electron/remote-secrets.cjs");
const { createActivity, cleanEvent } = require("../electron/activity.cjs");
const { server } = require("../electron/validation.cjs");
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), "litebox-experience-"));
const safe = (() => {
  const key = crypto.randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(s) {
      const iv = crypto.randomBytes(16),
        c = crypto.createCipheriv("aes-256-cbc", key, iv);
      return Buffer.concat([iv, c.update(s, "utf8"), c.final()]);
    },
    decryptString(b) {
      const c = crypto.createDecipheriv("aes-256-cbc", key, b.subarray(0, 16));
      return Buffer.concat([c.update(b.subarray(16)), c.final()]).toString();
    },
  };
})();
const profile = {
  id: "test",
  type: "ssh",
  host: "127.0.0.1",
  port: 22,
  username: "tester",
  name: "test",
  group: "",
  auth: "password",
};
test("remote password vault encrypts, persists and binds authentication destination", () => {
  const root = dir(),
    v = createRemoteVault(root, safe, new Set());
  v.save(profile, { password: "SYNTHETIC-PASSWORD" });
  assert.equal(v.status(profile), true);
  assert(
    !fs
      .readFileSync(path.join(root, "remote-secrets.json"), "utf8")
      .includes("SYNTHETIC-PASSWORD"),
  );
  assert.equal(
    createRemoteVault(root, safe, new Set()).get(profile).password,
    "SYNTHETIC-PASSWORD",
  );
  for (const change of [
    { host: "other.test" },
    { username: "other" },
    { port: 23 },
    { type: "rdp" },
    { auth: "key" },
  ])
    assert.equal(v.get({ ...profile, ...change }), null);
  v.save(profile, { password: "" });
  v.forget(profile);
  assert.equal(v.status(profile), false);
  assert.throws(
    () =>
      createRemoteVault(
        root,
        { isEncryptionAvailable: () => false },
        new Set(),
      ).save(profile, { password: "x" }),
    /encryption/,
  );
});
test("remote key vault requires file authorization and encrypts key plus passphrase", () => {
  const root = dir(),
    file = path.join(root, "test-key"),
    p = { ...profile, auth: "key" };
  fs.writeFileSync(file, "SYNTHETIC-PRIVATE-KEY");
  const selected = new Set(),
    v = createRemoteVault(root, safe, selected);
  assert.throws(() => v.save(p, { keyPath: file }), /file dialog/);
  selected.add(file);
  v.save(p, { keyPath: file, passphrase: "SYNTHETIC-PASSPHRASE" });
  const bytes = fs.readFileSync(path.join(root, "remote-secrets.json"), "utf8");
  assert(!bytes.includes("PRIVATE-KEY"));
  assert(!bytes.includes("PASSPHRASE"));
  assert(!bytes.includes(file));
  const reopened = createRemoteVault(root, safe, new Set());
  assert.equal(reopened.get(p).privateKey, "SYNTHETIC-PRIVATE-KEY");
  assert.equal(reopened.get(p).passphrase, "SYNTHETIC-PASSPHRASE");
  reopened.save(p, { keyPath: "" });
  assert(
    !Object.hasOwn(
      server({ ...p, password: "secret", privateKey: "secret", keyPath: file }),
      "password",
    ),
  );
});
test("history stores only allowlisted metadata, persists and rejects malformed events", () => {
  const root = dir(),
    v = createActivity(root);
  v.add({
    module: "database",
    action: "query",
    status: "error",
    password: "NEVER-LOG",
    sql: "NEVER-LOG",
    content: "NEVER-LOG",
  });
  const file = path.join(root, "activity-log.json");
  assert(!fs.readFileSync(file, "utf8").includes("NEVER-LOG"));
  assert.equal(createActivity(root).list().records.length, 1);
  assert.throws(() =>
    cleanEvent({ module: "unknown", action: "query", status: "success" }),
  );
  assert.throws(() =>
    cleanEvent({ module: "app", action: "unknown", status: "success" }),
  );
  v.clear();
  assert.equal(createActivity(root).list().records.length, 0);
});
test("history retention is bounded and a corrupt original is never overwritten", () => {
  const root = dir(),
    file = path.join(root, "activity-log.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      Array.from({ length: 3002 }, (_, i) => ({
        id: String(i),
        at: i,
        module: "app",
        action: "start",
        status: "success",
      })),
    ),
  );
  const v = createActivity(root);
  assert.equal(v.list().records.length, 3000);
  v.add({ module: "app", action: "start", status: "success" });
  assert.equal(v.list().records.length, 3000);
  fs.writeFileSync(file, "BROKEN");
  const broken = createActivity(root);
  assert(broken.list().error);
  assert.throws(() =>
    broken.add({ module: "app", action: "start", status: "success" }),
  );
  assert.throws(() => broken.clear());
  assert.equal(fs.readFileSync(file, "utf8"), "BROKEN");
});
