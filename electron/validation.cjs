"use strict";
const path = require("node:path");
const net = require("node:net");
const PAGES = new Set([
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
  "snippets",
  "settings",
  "history",
]);
function str(value, max = 4096, name = "value") {
  if (typeof value !== "string" || value.length > max || value.includes("\0"))
    throw new Error(`Invalid ${name} / 参数无效`);
  return value;
}
// Clipboard input is untrusted plain text, not a path or SSH command.
// Preserve NUL here so the terminal can offer an explicit cleanup confirmation.
// Never relax str(): credentials, writes and SSH payloads still reject NUL.
function clipboardReadText(value) {
  if (typeof value !== "string")
    throw new Error(
      "Cannot read clipboard plain text. Copy the text again. / 无法读取剪贴板纯文本，请重新复制文本",
    );
  if (value.length > 1024 * 1024)
    throw new Error(
      "Clipboard text is too long. Select a smaller portion (terminal paste limit: 64K characters). / 剪贴板文本过长，请缩小复制范围（终端每次最多粘贴64K字符）",
    );
  return value;
}
function obj(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid object / 对象无效");
  return value;
}
function integer(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error("Invalid number / 数字超出范围");
  return value;
}
function endpoint(value) {
  const url = new URL(str(value, 2048, "endpoint"));
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use HTTPS, or HTTP on localhost; no credentials/query in URL. / 请使用 HTTPS 或本机 HTTP",
    );
  url.pathname = url.pathname
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/, "");
  return url.toString().replace(/\/+$/, "");
}
function server(value) {
  const p = obj(value);
  const host = str(p.host, 253, "hostname").trim();
  if (!(
    net.isIP(host) ||
    /^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)
  ))
    throw new Error("Invalid host / 主机地址无效");
  if (!["ssh", "rdp"].includes(p.type))
    throw new Error("Invalid connection type");
  return {
    id: str(p.id, 80, "id"),
    name: str(p.name, 80, "name"),
    host,
    port: integer(p.port, 1, 65535),
    username: str(p.username, 128, "username"),
    type: p.type,
    group: str(p.group || "", 200, "group"),
    auth: p.type === "ssh" && p.auth === "key" ? "key" : "password",
  };
}
function array(value, max) {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("Invalid list / 列表过长");
  return value;
}
function cleanState(value) {
  const s = obj(value);
  if (s.version !== 1)
    throw new Error("Unsupported backup version / 不支持的备份版本");
  const o = obj(s.order),
    m = obj(s.markdown),
    a = obj(s.ai),
    d = obj(s.dashboard),
    q = s.sql === undefined ? {} : obj(s.sql);
  const out = {
    version: 1,
    locale: s.locale === "en" ? "en" : "zh",
    theme: s.theme === "dark" ? "dark" : "light",
    favorites: array(s.favorites, 20).filter((p) => PAGES.has(p)),
    recent: array(s.recent, 10)
      .filter((r) => PAGES.has(r.page))
      .map((r) => ({
        page: r.page,
        at: integer(r.at, 0, Number.MAX_SAFE_INTEGER),
      })),
    usage: {},
    order: {
      input: str(o.input, 5 * 1024 * 1024),
      size: Math.max(1, Math.min(100000, Math.floor(Number(o.size) || 1))),
      delimiter: str(o.delimiter, 20),
      dedupe: !!o.dedupe,
      quote: ["", "'", '"'].includes(o.quote) ? o.quote : "",
      split: ["auto", "lines", "comma", "pipe"].includes(o.split)
        ? o.split
        : "auto",
      mode: o.mode === "groups" ? "groups" : "size",
    },
    sql: {
      template: str(
        q.template ??
          "SELECT XMDCDOCNO AS 订单单号,\n       XMDCSEQ AS 项次\nFROM XMDC_T\nWHERE XMDCDOCNO IN ({{values}});",
        100000,
      ),
      input: str(q.input ?? "", 1024 * 1024),
      dedupe: !!q.dedupe,
      separator: q.separator === "auto" ? "auto" : "lines",
    },
    markdown: {
      text: str(m.text, 5 * 1024 * 1024),
      name: str(m.name, 255),
      path: str(m.path || "", 4096),
    },
    servers: array(s.servers, 500).map(server),
    databases: array(s.databases ?? [], 100).map(
      require("./database-validation.cjs").profile,
    ),
    chats: array(s.chats, 500).map((c) => ({
      id: str(c.id, 80),
      title: str(c.title, 200),
      updatedAt: integer(c.updatedAt, 0, Number.MAX_SAFE_INTEGER),
      messages: array(c.messages, 1000).map((x) => {
        if (!["user", "assistant"].includes(x.role))
          throw new Error("Invalid message role");
        const result = { role: x.role, content: str(x.content, 1024 * 1024) };
        if (x.attachments != null)
          result.attachments = array(x.attachments, 5).map(
            require("./ai-attachments.cjs").metadata,
          );
        if (x.knowledge != null)
          result.knowledge = require("./ai-attachments.cjs").knowledge(
            x.knowledge,
          );
        return result;
      }),
    })),
    snippets: array(s.snippets, 2000).map((x) => ({
      id: str(x.id, 80),
      title: str(x.title, 500),
      content: str(x.content, 1024 * 1024),
    })),
    ai: {
      endpoint: str(a.endpoint, 2048),
      model: str(a.model, 200),
      mode: ["general", "debug", "code", "writing"].includes(a.mode)
        ? a.mode
        : "general",
      system: str(a.system, 10000),
    },
    dashboard: {
      csv: str(d.csv, 5 * 1024 * 1024),
      name: str(d.name, 255),
      x: str(d.x, 500),
      y: str(d.y, 500),
      type: d.type === "line" ? "line" : "bar",
    },
  };
  for (const [key, count] of Object.entries(obj(s.usage)))
    if (PAGES.has(key))
      out.usage[key] = integer(count, 0, Number.MAX_SAFE_INTEGER);
  if (Buffer.byteLength(JSON.stringify(out)) > 20 * 1024 * 1024)
    throw new Error(
      "Local data limit is 20 MB. Export and remove old chats. / 本地数据超过 20 MB，请导出并清理旧会话",
    );
  return out;
}
function safeFilename(value, fallback = "export.txt") {
  const name = path
    .basename(str(value || fallback, 255))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return name && name !== "." && name !== ".." ? name : fallback;
}
module.exports = {
  str,
  clipboardReadText,
  obj,
  integer,
  endpoint,
  server,
  cleanState,
  safeFilename,
};
