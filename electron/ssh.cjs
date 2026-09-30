"use strict";

const { dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { StringDecoder } = require("node:string_decoder");
const { str, obj, integer, server, safeFilename } = require("./validation.cjs");
const { atomicWrite, readJson } = require("./storage.cjs");
const hash = (text) => createHash("sha256").update(text).digest("hex");
function register({
  handle,
  win,
  dataDir,
  selectedKeys,
  remoteVault,
  confirmDialog,
}) {
  const sessions = new Map();
  const knownPath = path.join(dataDir, "known-hosts.json");
  let known = readJson(knownPath, {});
  function get(id) {
    const session = sessions.get(str(id, 80));
    if (!session?.sftp) throw new Error("SSH is not connected / SSH 未连接");
    return session;
  }
  function call(sftp, method, ...args) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("SFTP operation timed out / SFTP 操作超时"));
        }
      }, 30000);
      sftp[method](...args, (err, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        err ? reject(err) : resolve(value);
      });
    });
  }
  function remotePath(value) {
    return str(value, 4096, "remote path");
  }
  async function readRemote(sftp, filename) {
    const stat = await call(sftp, "stat", filename);
    if (!stat.isFile() || stat.size > 1024 * 1024)
      throw new Error(
        "Only text files up to 1 MB can be edited / 仅可编辑 1 MB 以内的文本文件",
      );
    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      const stream = sftp.createReadStream(filename);
      const timer = setTimeout(
        () => stream.destroy(new Error("Read timed out")),
        30000,
      );
      stream.on("data", (data) => {
        size += data.length;
        if (size > 1024 * 1024) {
          stream.destroy(new Error("File exceeds 1 MB"));
          return;
        }
        chunks.push(data);
      });
      stream.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      stream.on("end", () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
    });
    if (buffer.includes(0))
      throw new Error("Binary files cannot be edited / 不能编辑二进制文件");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  }
  handle("ssh:connect", async (p, event) => {
    obj(p);
    const profile = server(p.server);
    if (profile.type !== "ssh") throw new Error("SSH profile required");
    if (sessions.size)
      throw new Error(
        "Disconnect the current session first / 请先断开当前连接",
      );
    const client = new (require("ssh2").Client)();
    const session = {
      client,
      sftp: null,
      stream: null,
      reads: new Map(),
      busy: false,
    };

    const auth = p.auth === "key" ? "key" : "password";
    const saved = remoteVault?.get({ ...profile, auth });
    let privateKey;
    let savedPassphrase = "";
    if (auth === "key" && !p.keyPath && saved?.auth === "key") {
      privateKey = saved.privateKey;
      savedPassphrase = saved.passphrase;
    } else if (auth === "key") {
      if (!selectedKeys.has(p.keyPath))
        throw new Error(
          "Select the private key using the file dialog / 请通过文件选择器选择私钥",
        );
      privateKey = await fs.readFile(p.keyPath);
      if (privateKey.length > 128 * 1024) throw new Error("Invalid key size");
    }
    const options = {
      host: profile.host,
      port: profile.port,
      username: profile.username,
      readyTimeout: 25000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 3,
      hostVerifier: (key, callback) => {
        const fingerprint =
          "SHA256:" +
          createHash("sha256").update(key).digest("base64").replace(/=+$/, "");
        const keyId = profile.host + ":" + profile.port;
        const old = known[keyId];
        if (old === fingerprint) {
          callback(true);
          return;
        }
        if (old) {
          confirmDialog
            .showMessageBox(win(), {
              type: "error",
              title:
                p.locale === "en"
                  ? "SSH host key changed"
                  : "SSH 主机指纹已改变",
              message:
                p.locale === "en"
                  ? "Host fingerprint changed. Connection blocked."
                  : "主机指纹已改变，已阻止连接。",
              detail: `${keyId}\nSaved: ${old}\nReceived: ${fingerprint}\nVerify the change with your server administrator before removing the old entry from known-hosts.json.`,
            })
            .then(
              () => callback(false),
              () => callback(false),
            );
          return;
        }
        confirmDialog
          .showMessageBox(win(), {
            type: "warning",
            title: p.locale === "en" ? "Verify SSH host" : "验证 SSH 主机",
            message:
              p.locale === "en"
                ? "Verify this fingerprint with your server before trusting it."
                : "请与服务器管理员核对下方指纹后再信任。",
            detail: `${keyId}\n${fingerprint}`,
            buttons:
              p.locale === "en"
                ? ["Cancel", "Trust and connect"]
                : ["取消", "信任并连接"],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          })
          .then((result) => {
            if (result.response !== 1 || sessions.get(profile.id) !== session) {
              callback(false);
              return;
            }
            known[keyId] = fingerprint;
            atomicWrite(knownPath, JSON.stringify(known, null, 2));
            callback(true);
          })
          .catch(() => callback(false));
      },
    };
    if (auth === "key") {
      options.privateKey = privateKey;
      options.passphrase = str(p.passphrase || savedPassphrase || "", 4096);
    } else options.password = str(p.password || saved?.password || "", 4096);
    const cols = integer(p.cols || 80, 2, 500);
    const rows = integer(p.rows || 24, 2, 200);
    sessions.set(profile.id, session);
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (e) => {
        if (!settled) {
          settled = true;
          reject(e);
        }
        client.end();
        if (sessions.get(profile.id) === session) sessions.delete(profile.id);
      };
      client.on("error", fail);
      client.on("close", () => {
        if (sessions.get(profile.id) === session) sessions.delete(profile.id);
        if (!settled) {
          settled = true;
          reject(new Error("Connection closed / 连接已关闭"));
        }
        if (!event.sender.isDestroyed())
          event.sender.send("ssh:closed", { id: profile.id });
      });
      client.on("ready", () => {
        client.shell(
          {
            term: "xterm-256color",
            cols,
            rows,
          },
          (err, stream) => {
            if (err) return fail(err);
            session.stream = stream;
            const decoder = new StringDecoder("utf8");
            let pending = "";
            let timer;
            const flush = () => {
              if (pending && !event.sender.isDestroyed())
                event.sender.send("ssh:data", {
                  id: profile.id,
                  data: pending,
                });
              pending = "";
              timer = undefined;
            };
            stream.on("data", (data) => {
              pending += decoder.write(data);
              if (pending.length > 256 * 1024) {
                stream.pause();
                flush();
                setTimeout(() => stream.resume(), 20);
              }
              if (!timer) timer = setTimeout(flush, 16);
            });
            stream.on("error", fail);
            stream.on("close", () => {
              clearTimeout(timer);
              pending += decoder.end();
              flush();
              client.end();
            });
            client.sftp((error, sftp) => {
              if (error) return fail(error);
              session.sftp = sftp;
              settled = true;
              resolve({ connected: true });
            });
          },
        );
      });
      try {
        client.connect(options);
      } catch (e) {
        fail(e);
      }
    });
  });
  handle("ssh:write", (p) => {
    const s = get(p.id);
    const data = str(p.data, 65536);
    if (!s.stream) throw new Error("Terminal unavailable");
    s.stream.write(data);
    return true;
  });
  handle("ssh:resize", (p) => {
    const s = get(p.id);
    s.stream?.setWindow(integer(p.rows, 2, 200), integer(p.cols, 2, 500), 0, 0);
    return true;
  });
  handle("ssh:disconnect", (id) => {
    const s = sessions.get(str(id, 80));
    s?.client.end();
    sessions.delete(id);
    return true;
  });
  handle("sftp:list", async (p) => {
    const s = get(p.id);
    const resolved = await call(s.sftp, "realpath", remotePath(p.path));
    const list = await call(s.sftp, "readdir", resolved);
    return {
      path: resolved,
      files: list
        .filter((e) => e.filename !== "." && e.filename !== "..")
        .slice(0, 10000)
        .map((e) => ({
          filename: e.filename,
          directory: e.attrs.isDirectory(),
          size: e.attrs.size,
          modified: e.attrs.mtime,
        }))
        .sort(
          (a, b) =>
            Number(b.directory) - Number(a.directory) ||
            a.filename.localeCompare(b.filename),
        ),
    };
  });
  handle("sftp:read", async (p) => {
    const s = get(p.id);
    const filename = await call(s.sftp, "realpath", remotePath(p.path));
    const text = await readRemote(s.sftp, filename);
    s.reads.set(filename, hash(text));
    return text;
  });
  handle("sftp:save", async (p) => {
    const s = get(p.id);
    const filename = await call(s.sftp, "realpath", remotePath(p.path));
    const text = str(p.text, 1024 * 1024);
    const before = s.reads.get(filename);
    if (!before) throw new Error("Open the file before saving / 请先打开文件");
    const current = await readRemote(s.sftp, filename);
    if (hash(current) !== before)
      throw new Error(
        "Remote file changed. Reopen it before editing. / 远程文件已变化，请重新打开",
      );
    const confirmation = await confirmDialog.showMessageBox(win(), {
      type: "warning",
      title: p.locale === "en" ? "Save remote file" : "保存远程文件",
      danger: true,
      message:
        p.locale === "en"
          ? "Overwrite this remote file? This cannot be undone by LiteBox."
          : "覆盖此远程文件？轻匣不提供自动恢复。",
      detail: filename,
      buttons: p.locale === "en" ? ["Cancel", "Save"] : ["取消", "保存"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (confirmation.response !== 1) return { saved: false };
    if (hash(await readRemote(s.sftp, filename)) !== before)
      throw new Error(
        "Remote file changed during confirmation / 确认期间文件已变化",
      );
    const attrs = await call(s.sftp, "stat", filename);
    const temp = filename + ".litebox-" + randomUUID() + ".tmp";
    try {
      await call(s.sftp, "writeFile", temp, Buffer.from(text), {
        mode: attrs.mode & 0o777,
        flag: "wx",
      });
      await call(s.sftp, "chown", temp, attrs.uid, attrs.gid);
      try {
        await call(s.sftp, "ext_openssh_rename", temp, filename);
      } catch (e) {
        throw new Error(
          "Atomic replacement failed or timed out. Reopen the file to verify its contents. / 原子替换失败或超时，请重新读取文件核实结果",
        );
      }
      s.reads.set(filename, hash(text));
      return { saved: true };
    } finally {
      await call(s.sftp, "unlink", temp).catch(() => {});
    }
  });
  handle("sftp:download", async (p) => {
    const s = get(p.id);
    if (s.busy) throw new Error("A transfer is already running");
    const source = remotePath(p.path);
    const result = await dialog.showSaveDialog(win(), {
      defaultPath: safeFilename(p.name),
    });
    if (result.canceled) return null;
    s.busy = true;
    const temp = result.filePath + ".litebox-" + randomUUID() + ".part";
    try {
      await transfer(s.sftp, "fastGet", source, temp);
      await fs.rename(temp, result.filePath);
      return { saved: true };
    } finally {
      s.busy = false;
      await fs.unlink(temp).catch(() => {});
    }
  });
  handle("sftp:upload", async (p) => {
    const s = get(p.id);
    if (s.busy) throw new Error("A transfer is already running");
    const result = await dialog.showOpenDialog(win(), {
      properties: ["openFile"],
    });
    if (result.canceled) return null;
    const local = result.filePaths[0];
    const destination = path.posix.join(
      remotePath(p.path),
      path.basename(local),
    );
    let exists = false;
    let originalAttrs;
    try {
      originalAttrs = await call(s.sftp, "stat", destination);
      exists = true;
    } catch (e) {
      if (e.code !== 2) throw e;
    }
    if (exists) {
      const answer = await confirmDialog.showMessageBox(win(), {
        type: "warning",
        title: p.locale === "en" ? "Replace remote file" : "覆盖远程文件",
        danger: true,
        message:
          p.locale === "en"
            ? "Replace the existing remote file?"
            : "覆盖服务器上同名文件？",
        detail: destination,
        buttons: p.locale === "en" ? ["Cancel", "Replace"] : ["取消", "覆盖"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (answer.response !== 1) return null;
    }
    s.busy = true;
    const temp = destination + ".litebox-" + randomUUID() + ".part";
    try {
      await transfer(s.sftp, "fastPut", local, temp);
      if (exists) {
        await call(s.sftp, "chmod", temp, originalAttrs.mode & 0o777);
        await call(s.sftp, "chown", temp, originalAttrs.uid, originalAttrs.gid);
        await call(s.sftp, "ext_openssh_rename", temp, destination);
      } else {
        await call(s.sftp, "rename", temp, destination);
      }
      return { saved: true };
    } finally {
      s.busy = false;
      await call(s.sftp, "unlink", temp).catch(() => {});
    }
  });
  async function transfer(sftp, method, source, destination) {
    return new Promise((resolve, reject) => {
      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        sftp.destroy();
        reject(
          new Error(
            "Transfer timed out after 10 minutes / 传输超时，连接已关闭",
          ),
        );
      }, 600000);
      sftp[method](
        source,
        destination,
        { concurrency: 8, chunkSize: 32768 },
        (err) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          err ? reject(err) : resolve();
        },
      );
    });
  }
  return {
    close() {
      for (const s of sessions.values()) s.client.end();
      sessions.clear();
    },
  };
}
module.exports = { register };
