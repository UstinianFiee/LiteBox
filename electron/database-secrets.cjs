const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { atomicWrite } = require("./storage.cjs");
const { profile } = require("./database-validation.cjs");
function createVault(dataDir, safeStorage) {
  const file = path.join(dataDir, "database-secrets.json");
  const load = () =>
    fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const fingerprint = (p) =>
    createHash("sha256")
      .update(
        JSON.stringify([
          p.type,
          p.host,
          p.port,
          p.username,
          p.database,
          p.tls,
          p.authSource,
        ]),
      )
      .digest("hex");
  const available = () => {
    if (
      !safeStorage.isEncryptionAvailable() ||
      safeStorage.getSelectedStorageBackend?.() === "basic_text"
    )
      throw Error("OS encryption unavailable / 系统安全加密不可用");
  };
  return {
    status(input) {
      const p = profile(input);
      const entry = load()[p.id];
      return !!entry && entry.destination === fingerprint(p);
    },
    save(input, password) {
      const p = profile(input);
      available();
      if (
        p.type === "sqlite" ||
        typeof password !== "string" ||
        !password ||
        password.length > 4096
      )
        throw Error("Invalid password");
      const entries = load();
      entries[p.id] = {
        destination: fingerprint(p),
        cipher: safeStorage.encryptString(password).toString("base64"),
      };
      atomicWrite(file, JSON.stringify(entries));
      return true;
    },
    forget(input) {
      const p = profile(input);
      const entries = load();
      delete entries[p.id];
      atomicWrite(file, JSON.stringify(entries));
      return true;
    },
    get(input) {
      const p = profile(input);
      const entry = load()[p.id];
      if (!entry || entry.destination !== fingerprint(p)) return "";
      available();
      try {
        return safeStorage.decryptString(Buffer.from(entry.cipher, "base64"));
      } catch {
        throw Error(
          "Saved password cannot be decrypted; enter again / 已存密码无法解密，请重新输入",
        );
      }
    },
  };
}
module.exports = { createVault };
