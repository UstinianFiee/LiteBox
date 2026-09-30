const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { atomicWrite } = require("./storage.cjs");
const MODULES = new Set([
  "app",
  "home",
  "orders",
  "sql",
  "images",
  "convert",
  "markdown",
  "remote",
  "database",
  "chat",
  "dashboard",
  "history",
  "snippets",
  "settings",
]);
const ACTIONS = new Set([
  "start",
  "visit",
  "run",
  "copy",
  "export",
  "import",
  "open",
  "save",
  "connect",
  "disconnect",
  "query",
  "write",
  "delete",
  "credentials",
  "cancel",
  "clear",
]);
const CHANNELS = {
  "clipboard:write": ["app", "copy"],
  "file:open": ["app", "open"],
  "file:save": ["app", "save"],
  "file:export": ["app", "export"],
  "backup:export": ["settings", "export"],
  "backup:import": ["settings", "import"],
  "ai:chat": ["chat", "run"],
  "ai:configure": ["settings", "credentials"],
  "ai:clear-key": ["settings", "delete"],
  "ssh:connect": ["remote", "connect"],
  "ssh:disconnect": ["remote", "disconnect"],
  "rdp:connect": ["remote", "connect"],
  "sftp:download": ["remote", "export"],
  "sftp:upload": ["remote", "import"],
  "sftp:save": ["remote", "write"],
  "db:connect": ["database", "connect"],
  "db:test": ["database", "connect"],
  "db:disconnect": ["database", "disconnect"],
  "db:query": ["database", "query"],
  "db:mutate": ["database", "write"],
  "db:secret-save": ["database", "credentials"],
  "db:secret-forget": ["database", "delete"],
  "remote:secret-save": ["remote", "credentials"],
  "remote:secret-forget": ["remote", "delete"],
};
function cleanEvent(p) {
  if (
    !p ||
    !MODULES.has(p.module) ||
    !ACTIONS.has(p.action) ||
    !["success", "error", "cancelled"].includes(p.status)
  )
    throw Error("Invalid activity event");
  return { module: p.module, action: p.action, status: p.status };
}
function createActivity(dataDir, changed = () => {}) {
  const file = path.join(dataDir, "activity-log.json");
  let records = [],
    loadError = "";
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(raw)) throw Error("Invalid log");
      records = raw
        .slice(-3000)
        .map((r) => ({
          ...cleanEvent(r),
          id: String(r.id).slice(0, 80),
          at: Number(r.at),
        }))
        .filter((r) => Number.isFinite(r.at));
    }
  } catch {
    loadError =
      "Activity log could not be read; original file preserved / 日志文件损坏，原文件已保留";
  }
  function persist() {
    atomicWrite(file, JSON.stringify(records));
    changed();
  }
  return {
    list: () => ({ records: [...records], error: loadError }),
    add(p) {
      if (loadError) throw Error(loadError);
      const next = { ...cleanEvent(p), id: randomUUID(), at: Date.now() };
      records.push(next);
      records = records.slice(-3000);
      persist();
      return next;
    },
    clear() {
      if (loadError) throw Error(loadError);
      records = [];
      persist();
    },
  };
}
module.exports = { createActivity, cleanEvent, CHANNELS };
