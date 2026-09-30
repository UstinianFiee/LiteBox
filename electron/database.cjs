"use strict";
const { fork } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { profile, readQuery } = require("./database-validation.cjs");
class DatabaseSessions {
  constructor(onClose = () => {}) {
    this.sessions = new Map();
    this.onClose = onClose;
    this.sequence = 0;
  }
  async connect(p, password = "") {
    p = profile(p);
    if (typeof password !== "string" || password.length > 4096)
      throw Error("Invalid password");
    if (this.sessions.has(p.id))
      throw Error(
        "Disconnect this session before reconnecting / 请先断开此连接",
      );
    if (this.sessions.size >= 4)
      throw Error("At most 4 database sessions / 最多 4 个数据库连接");
    const worker = fork(path.join(__dirname, "database-worker.cjs"), [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      execArgv: ["--max-old-space-size=128"],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      serialization: "advanced",
      windowsHide: true,
    });
    const s = { worker, pending: null, profile: p };
    this.sessions.set(p.id, s);
    worker.on("message", (m) => {
      if (this.sessions.get(p.id) !== s) return;
      if (m.fatal) {
        this.close(p.id, m.error);
        return;
      }
      if (s.pending?.id !== m.id) return;
      const pending = s.pending;
      s.pending = null;
      clearTimeout(pending.timer);
      m.error ? pending.reject(Error(m.error)) : pending.resolve(m.result);
    });
    worker.on("error", () => {
      if (this.sessions.get(p.id) === s)
        this.close(p.id, "Database process stopped / 数据库进程已停止");
    });
    worker.on("exit", () => {
      if (this.sessions.get(p.id) === s)
        this.close(p.id, "Database disconnected / 数据库连接已断开");
    });
    try {
      return await this.call(p.id, "connect", { profile: p, password }, 15000);
    } catch (e) {
      if (this.sessions.get(p.id) === s) this.close(p.id);
      throw e;
    }
  }
  call(id, op, data = {}, timeout = 25000) {
    const s = this.sessions.get(id);
    if (!s) return Promise.reject(Error("Not connected / 尚未连接"));
    if (s.pending)
      return Promise.reject(Error("Database is busy / 数据库正在执行操作"));
    if (op === "query") {
      if (["mongodb", "redis"].includes(s.profile.type)) {
        if (typeof data.sql !== "string" || data.sql.length > 100000)
          throw Error("Invalid query");
        JSON.parse(data.sql);
      } else readQuery(data.sql);
    }
    return new Promise((resolve, reject) => {
      const request = ++this.sequence;
      const timer = setTimeout(
        () =>
          this.close(
            id,
            "Operation timed out; disconnected / 操作超时，已断开连接",
          ),
        timeout,
      );
      s.pending = { id: request, resolve, reject, timer };
      s.worker.send({ id: request, op, data }, (err) => {
        if (err && this.sessions.get(id) === s)
          this.close(id, "Database process unavailable / 数据库进程不可用");
      });
    });
  }
  close(id, reason = "Disconnected / 已断开连接") {
    const s = this.sessions.get(id);
    if (!s) return;
    this.sessions.delete(id);
    if (s.pending) {
      clearTimeout(s.pending.timer);
      s.pending.reject(Error(reason));
      s.pending = null;
    }
    s.worker.kill();
    this.onClose(id, reason);
  }
  closeAll() {
    for (const id of [...this.sessions.keys()]) this.close(id);
  }
}
function register({ handle, win, dataDir, confirmDialog, state }) {
  const zh = () => state?.()?.locale !== "en";
  const { dialog, safeStorage } = require("electron");
  const vault = require("./database-secrets.cjs").createVault(
    dataDir,
    safeStorage,
  );
  handle("db:secret-status", (payload) => vault.status(payload.profile));
  handle("db:secret-save", (payload) =>
    vault.save(payload.profile, payload.password),
  );
  handle("db:secret-forget", (payload) => vault.forget(payload.profile));
  const authorizedFiles = new Set();
  const sessions = new DatabaseSessions((id, reason) => {
    if (!win()?.isDestroyed())
      win().webContents.send("db:closed", { id, reason });
  });
  handle("db:pick-file", async () => {
    const r = await dialog.showOpenDialog(win(), {
      properties: ["openFile"],
      filters: [
        { name: "SQLite", extensions: ["sqlite", "sqlite3", "db"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (r.canceled) return null;
    const file = fs.realpathSync(r.filePaths[0]);
    authorizedFiles.add(file);
    return file;
  });
  const checked = (payload) => {
    const p = profile(payload?.profile);
    if (p.type === "sqlite") {
      const file = fs.realpathSync(p.path);
      if (!authorizedFiles.has(file))
        throw Error(
          "Choose the SQLite file with the file picker this session / 请先通过文件选择器授权 SQLite 文件",
        );
      p.path = file;
    }
    return p;
  };
  handle("db:connect", async (payload) =>
    sessions.connect(
      checked(payload),
      payload.password || vault.get(checked(payload)),
    ),
  );
  handle("db:test", async (payload) => {
    const p = checked(payload);
    const tester = new DatabaseSessions();
    try {
      return await tester.connect(p, payload.password || vault.get(p));
    } finally {
      tester.closeAll();
    }
  });
  handle("db:disconnect", (payload) => {
    sessions.close(payload?.id);
    return true;
  });
  handle("db:cancel", (payload) => {
    sessions.close(
      payload?.id,
      "Canceled; reconnect to continue / 已取消，请重新连接",
    );
    return true;
  });
  handle("db:catalog", (payload) =>
    sessions.call(payload?.id, "catalog", { paging: payload?.paging }),
  );
  handle("db:columns", (payload) =>
    sessions.call(payload?.id, "columns", {
      schema: payload?.schema,
      table: payload?.table,
      paging: payload?.paging,
    }),
  );
  handle("db:query", (payload) =>
    sessions.call(payload?.id, "query", {
      sql: payload?.sql,
      paging: payload?.paging,
    }),
  );
  const confirming = new Set();
  handle("db:mutate", async (payload) => {
    const { validateMutation } = require("./database-mutations.cjs");
    const data = validateMutation(payload?.data);
    const session = sessions.sessions.get(payload?.id);
    if (!session || session.pending || confirming.has(payload.id))
      throw Error("Not connected or busy / 未连接或正在忙");
    confirming.add(payload.id);
    try {
      const answer = await confirmDialog.showMessageBox(win(), {
        danger: true,
        type: "warning",
        title: zh() ? "确认数据库写入" : "Confirm database write",
        message: `${session.profile.name} · ${data.schema}.${data.table} · ${data.action}`,
        detail: `${session.profile.host || session.profile.path}\n${data.action === "insert" ? data.records.length + " records / 条记录" : JSON.stringify(data.where)}\n写入会立即提交。取消或超时不保证远端未提交，请核对后再重试。\nWrites commit immediately. After timeout/cancellation, verify before retrying.`,
        buttons: zh() ? ["取消", "确认写入"] : ["Cancel", "Commit write"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (answer.response !== 1) return { cancelled: true };
      if (sessions.sessions.get(payload.id) !== session)
        throw Error("Session changed; retry");
      return await sessions.call(payload.id, "mutate", {
        ...data,
        confirmed: true,
      });
    } finally {
      confirming.delete(payload.id);
    }
  });
  return {
    close: () => {
      sessions.closeAll();
      authorizedFiles.clear();
    },
  };
}
module.exports = { DatabaseSessions, register };
