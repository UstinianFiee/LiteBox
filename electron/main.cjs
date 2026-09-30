"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  session,
  safeStorage,
  clipboard,
} = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const {
  str,
  clipboardReadText,
  obj,
  cleanState,
  safeFilename,
  server,
} = require("./validation.cjs");
const { atomicWrite, readJson } = require("./storage.cjs");
const { createActivity, CHANNELS } = require("./activity.cjs");
const { createRemoteVault } = require("./remote-secrets.cjs");
const { protectRdpPassword } = require("./rdp-secret.cjs");
const isSmoke = process.argv.includes("--litebox-smoke");
// Offscreen smoke screenshots must also work on headless Windows/RDP GPU sessions.
// Normal and packaged application rendering is unchanged.
if (isSmoke && !app.isPackaged) app.disableHardwareAcceleration();
const dataDir = !app.isPackaged
  ? process.env.LITEBOX_TEST_DATA || path.join(__dirname, "..", ".litebox-data")
  : path.join(
      process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath("exe")),
      "litebox-data",
    );
try {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.accessSync(dataDir, fs.constants.W_OK);
  app.setPath("userData", dataDir);
} catch (e) {
  dialog.showErrorBox(
    "LiteBox",
    `Cannot write beside the app. Move it to a writable folder. / 请将程序移到可写目录。\n${e.message}`,
  );
  app.exit(1);
}
let win;
const confirmDialog = require("./confirmation.cjs").createConfirmationService({
  send: (channel, payload) => {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed())
      throw Error("Window unavailable");
    win.webContents.send(channel, payload);
  },
});
let activity;
let remoteVault;
function recordChannel(channel, status) {
  const entry = CHANNELS[channel];
  if (!entry || !activity) return;
  try {
    activity.add({ module: entry[0], action: entry[1], status });
  } catch {
    /* A log failure must not retry a database write. */
  }
}
let state = null;
let stateError = "";
const statePath = path.join(dataDir, "state.json");
const authorizedPaths = new Set();
const snapshots = new Map();
const selectedKeys = new Set();
try {
  const saved = readJson(statePath);
  if (saved) state = cleanState(saved);
} catch (e) {
  stateError = `Cannot load saved state; file has NOT been overwritten. / 无法读取保存的数据，原文件未覆盖。 ${e.message}`;
}
const zh = () => state?.locale !== "en";
function trusted(event) {
  if (
    !win ||
    event.sender !== win.webContents ||
    event.senderFrame !== win.webContents.mainFrame
  )
    throw new Error("Untrusted IPC sender");
  const url = event.senderFrame.url;
  const expected =
    app.isPackaged || !process.env.LITEBOX_DEV_URL
      ? pathToFileURL(path.join(__dirname, "../dist/index.html")).href
      : process.env.LITEBOX_DEV_URL;
  if (url.split("#")[0] !== expected && url.split("#")[0] !== expected + "/")
    throw new Error("Invalid sender URL");
}
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, payload) => {
    trusted(event);
    try {
      const result = await fn(payload, event);
      recordChannel(
        channel,
        result === null ||
          result?.cancelled === true ||
          result?.canceled === true ||
          result?.saved === false
          ? "cancelled"
          : "success",
      );
      return result;
    } catch (e) {
      recordChannel(channel, "error");
      throw new Error(e.message || String(e));
    }
  });
}
function saveState(value) {
  if (stateError) throw new Error(stateError);
  const next = cleanState(value);
  atomicWrite(statePath, JSON.stringify(next));
  state = next;
  return true;
}
async function readText(filename, max = 5 * 1024 * 1024) {
  const stat = await fsp.stat(filename);
  if (!stat.isFile() || stat.size > max)
    throw new Error("File exceeds size limit / 文件过大");
  const buffer = await fsp.readFile(filename);
  if (buffer.includes(0))
    throw new Error("Binary file is not supported / 不支持二进制文件");
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}
async function saveDialog(text, name) {
  str(text, 20 * 1024 * 1024, "text");
  const result = await dialog.showSaveDialog(win, {
    defaultPath: safeFilename(name),
  });
  if (result.canceled || !result.filePath) return null;
  await fsp.writeFile(result.filePath, text, "utf8");
  return {
    saved: true,
    path: result.filePath,
    name: path.basename(result.filePath),
  };
}
function register() {
  handle("confirmation:respond", (payload) => confirmDialog.respond(payload));
  activity = createActivity(dataDir, () => {
    if (!win.isDestroyed()) win.webContents.send("activity:changed");
  });
  remoteVault = createRemoteVault(dataDir, safeStorage, selectedKeys);
  try {
    activity.add({ module: "app", action: "start", status: "success" });
  } catch {}
  handle("activity:list", () => activity.list());
  handle("activity:add", (p) => {
    if (!["visit", "run"].includes(p?.action))
      throw Error("Invalid activity action");
    return activity.add(p);
  });
  handle("activity:clear", async () => {
    const result = await confirmDialog.showMessageBox(win, {
      title: zh() ? "清空使用日志" : "Clear activity history",
      danger: true,
      type: "warning",
      buttons: zh() ? ["取消", "清空日志"] : ["Cancel", "Clear history"],
      defaultId: 0,
      cancelId: 0,
      message: zh()
        ? "清空此设备的全部使用日志？此操作不可撤销。"
        : "Clear all local activity history? This cannot be undone.",
    });
    if (result.response !== 1) return false;
    activity.clear();
    return true;
  });
  handle("remote:secret-status", (p) => remoteVault.status(p));
  handle("remote:secret-save", (p) => remoteVault.save(p.server, p));
  handle("remote:secret-forget", (p) => remoteVault.forget(p));
  handle("clipboard:read", async () =>
    clipboardReadText(await clipboard.readText()),
  );
  handle("clipboard:write", async (text) => {
    await clipboard.writeText(str(text, 20 * 1024 * 1024, "clipboard text"));
    return true;
  });
  handle("state:load", () => {
    if (stateError) throw new Error(stateError);
    return state;
  });
  handle("state:save", saveState);
  ipcMain.on("state:flush", (event, payload) => {
    try {
      trusted(event);
      saveState(payload);
      event.returnValue = true;
    } catch (e) {
      event.returnValue = false;
    }
  });
  handle("app:info", () => ({
    version: app.getVersion(),
    dataDir,
    secretSaved: fs.existsSync(path.join(dataDir, "ai-key.bin")),
    portable: app.isPackaged,
  }));
  handle("app:open-data", async () => {
    const error = await shell.openPath(dataDir);
    if (error) throw new Error(error);
  });
  handle("app:licenses", () =>
    readText(
      path.join(app.getAppPath(), "THIRD_PARTY_NOTICES.md"),
      5 * 1024 * 1024,
    ),
  );
  handle("window:action", (action) => {
    if (action === "minimize") win.minimize();
    else if (action === "maximize")
      win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (action === "close") win.close();
  });
  handle("file:open", async (p) => {
    const ext = Array.isArray(p?.extensions)
      ? p.extensions.filter((x) =>
          ["md", "markdown", "txt", "csv", "json"].includes(x),
        )
      : ["txt"];
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Text", extensions: ext }],
    });
    if (result.canceled) return null;
    const filename = result.filePaths[0];
    const text = await readText(filename);
    authorizedPaths.add(filename);
    snapshots.set(filename, text);
    return { text, name: path.basename(filename), path: filename };
  });
  handle("file:save", async (p) => {
    obj(p);
    const text = str(p.text, 5 * 1024 * 1024);
    let filename =
      typeof p.path === "string" && authorizedPaths.has(p.path) ? p.path : "";
    if (!filename) {
      const result = await saveDialog(text, p.name || "Untitled.md");
      if (result) {
        authorizedPaths.add(result.path);
        snapshots.set(result.path, text);
      }
      return result;
    }
    const existing = await readText(filename);
    if (snapshots.get(filename) !== existing)
      throw new Error(
        "The file changed on disk. Save as a new file to avoid overwriting. / 文件已被外部修改，请另存为",
      );
    await fsp.writeFile(filename, text, "utf8");
    snapshots.set(filename, text);
    return { saved: true, path: filename, name: path.basename(filename) };
  });
  handle("file:export", (p) =>
    saveDialog(str(p.text, 20 * 1024 * 1024), safeFilename(p.filename)),
  );
  handle("backup:export", async (p) => {
    const clean = cleanState(p);
    clean.markdown.path = "";
    return saveDialog(
      JSON.stringify(clean, null, 2),
      "LiteBox-backup-" + new Date().toISOString().slice(0, 10) + ".json",
    );
  });
  handle("backup:import", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "LiteBox backup", extensions: ["json"] }],
    });
    if (result.canceled) return null;
    const text = await readText(result.filePaths[0], 20 * 1024 * 1024);
    const next = cleanState(JSON.parse(text));
    next.markdown.path = "";
    if (fs.existsSync(statePath))
      await fsp.copyFile(
        statePath,
        path.join(dataDir, "state.before-restore.json"),
      );
    stateError = "";
    saveState(next);
    return next;
  });
  handle("ssh:pick-key", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: zh() ? "选择 SSH 私钥" : "Select SSH private key",
      properties: ["openFile"],
    });
    if (result.canceled) return null;
    const filename = result.filePaths[0];
    const stat = await fsp.stat(filename);
    if (!stat.isFile() || stat.size > 128 * 1024)
      throw new Error("Invalid key file");
    selectedKeys.add(filename);
    return filename;
  });
  handle("rdp:connect", async (p) => {
    const profile = server(p);
    if (profile.type !== "rdp") throw new Error("RDP profile required");
    if (process.platform !== "win32") throw new Error("Windows only");
    const host = profile.host.includes(":")
      ? "[" + profile.host + "]"
      : profile.host;
    const filename = path.join(dataDir, "rdp-" + randomUUID() + ".rdp");
    const saved = remoteVault.get(profile);
    const passwordLine = saved?.password
      ? `password 51:b:${await protectRdpPassword(saved.password)}\r\n`
      : "";
    const content = `${passwordLine}full address:s:${host}:${profile.port}\r\nusername:s:${profile.username.replace(/[\r\n]/g, "")}\r\nprompt for credentials:i:${saved?.password ? 0 : 1}\r\nauthentication level:i:2\r\nenablecredsspsupport:i:1\r\nredirectclipboard:i:0\r\ndrivestoredirect:s:\r\n`;
    await fsp.writeFile(filename, content, "utf8");
    await new Promise((resolve, reject) => {
      const child = spawn(
        path.join(
          process.env.SystemRoot || "C:\\Windows",
          "System32",
          "mstsc.exe",
        ),
        [filename],
        { windowsHide: false, stdio: "ignore" },
      );
      child.once("error", reject);
      child.once("spawn", () => {
        resolve();
      });
      child.once("exit", () => fsp.unlink(filename).catch(() => {}));
    });
    return true;
  });
  const common = {
    handle,
    win: () => win,
    dataDir,
    state: () => state,
    selectedKeys,
    remoteVault,
    confirmDialog,
    readText,
  };
  const ai = require("./ai.cjs").register(common);
  const ssh = require("./ssh.cjs").register(common);
  const database = require("./database.cjs").register(common);
  win.on("closed", () => confirmDialog.cancelAll());
  app.on("before-quit", () => {
    confirmDialog.cancelAll();
    ai.close();
    ssh.close();
    database.close();
  });
  win.webContents.on("render-process-gone", () => {
    confirmDialog.cancelAll();
    ai.close();
    ssh.close();
    database.close();
  });
  win.webContents.on("will-navigate", () => {
    confirmDialog.cancelAll();
    ai.close();
    ssh.close();
    database.close();
  });
}
function createWindow() {
  win = new BrowserWindow({
    width: 1380,
    height: 950,
    minWidth: 820,
    minHeight: 620,
    frame: false,
    backgroundColor: "#f4f6fa",
    show: !isSmoke,
    icon: path.join(__dirname, "../build/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: !isSmoke,
      offscreen: isSmoke,
    },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.on("will-attach-webview", (e) => e.preventDefault());
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  register();
  if (process.env.LITEBOX_DEV_URL && !app.isPackaged) {
    if (process.env.LITEBOX_DEV_URL !== "http://127.0.0.1:5173")
      throw new Error("Invalid dev URL");
    win.loadURL(process.env.LITEBOX_DEV_URL);
  } else win.loadFile(path.join(__dirname, "../dist/index.html"));
  if (isSmoke && !app.isPackaged)
    require("../scripts/smoke-native.cjs").run({
      win,
      app,
      dataDir,
      confirmDialog,
    });
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(createWindow)
    .catch((e) => {
      dialog.showErrorBox("LiteBox", e.message);
      app.exit(1);
    });
  app.on("window-all-closed", () => app.quit());
}
