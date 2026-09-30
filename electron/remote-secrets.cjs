const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { server, str } = require("./validation.cjs");
const { atomicWrite } = require("./storage.cjs");
function createRemoteVault(dataDir, safeStorage, selectedKeys) {
  const file = path.join(dataDir, "remote-secrets.json");
  const load = () =>
    fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const fingerprint = (p) =>
    createHash("sha256")
      .update(JSON.stringify([p.type, p.host, p.port, p.username, p.auth]))
      .digest("hex");
  const available = () => {
    if (
      !safeStorage.isEncryptionAvailable() ||
      safeStorage.getSelectedStorageBackend?.() === "basic_text"
    )
      throw Error("OS encryption unavailable / 系统加密不可用");
  };
  function get(input) {
    const p = server(input),
      entries = load();
    const e = Object.hasOwn(entries, p.id) ? entries[p.id] : null;
    if (!e || e.destination !== fingerprint(p)) return null;
    available();
    try {
      return JSON.parse(
        safeStorage.decryptString(Buffer.from(e.cipher, "base64")),
      );
    } catch {
      throw Error(
        "Saved credentials cannot be decrypted / 已存凭据无法解密，请重新保存",
      );
    }
  }
  return {
    get,
    status(input) {
      const p = server(input),
        entries = load(),
        e = Object.hasOwn(entries, p.id) ? entries[p.id] : null;
      return !!e && e.destination === fingerprint(p);
    },
    save(input, value) {
      const p = server(input);
      available();
      let secret;
      if (p.type === "ssh" && p.auth === "key") {
        const keyPath = str(value.keyPath || "", 4096);
        if (!keyPath) {
          const old = get(p);
          if (old?.auth === "key") return true;
        }
        if (!selectedKeys.has(keyPath))
          throw Error(
            "Choose the private key using the file dialog / 请通过文件选择器选择私钥",
          );
        const stat = fs.statSync(keyPath);
        if (!stat.isFile() || stat.size > 128 * 1024)
          throw Error("Invalid private key file");
        const privateKey = fs.readFileSync(keyPath, "utf8");
        secret = {
          auth: "key",
          privateKey,
          passphrase: str(value.passphrase || "", 4096),
        };
      } else {
        const password = str(value.password || "", 4096);
        if (!password) {
          if (get(p)) return true;
          throw Error("Enter a password / 请输入密码");
        }
        secret = { auth: "password", password };
      }
      const entries = load();
      Object.defineProperty(entries, p.id, {
        value: {
          destination: fingerprint(p),
          cipher: safeStorage
            .encryptString(JSON.stringify(secret))
            .toString("base64"),
        },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      atomicWrite(file, JSON.stringify(entries));
      return true;
    },
    forget(input) {
      const p = server(input),
        entries = load();
      delete entries[p.id];
      atomicWrite(file, JSON.stringify(entries));
      return true;
    },
  };
}
module.exports = { createRemoteVault };
