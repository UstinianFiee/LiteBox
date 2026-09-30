const net = require("node:net");
const TYPES = new Set([
  "mysql",
  "postgres",
  "sqlite",
  "oracle",
  "mongodb",
  "redis",
]);
function text(x, max, label) {
  if (typeof x !== "string" || x.length > max || /[\x00-\x1f]/.test(x))
    throw Error(`Invalid ${label} / 参数无效`);
  return x.trim();
}
function profile(p) {
  if (!p || !TYPES.has(p.type))
    throw Error("Unsupported database / 不支持的数据库类型");
  const out = {
    id: text(p.id, 80, "id"),
    name: text(p.name, 80, "name"),
    type: p.type,
    host: text(p.host || "", 253, "host"),
    port: p.port,
    username: text(p.username || "", 128, "username"),
    database: text(p.database || "", 255, "database"),
    path: text(p.path || "", 4096, "path"),
    tls: p.tls === true,
    authSource: text(p.authSource || "admin", 128, "auth source"),
  };
  if (!/^[\w-]{1,80}$/.test(out.id) || !out.name)
    throw Error("Invalid profile / 连接配置无效");
  if (p.type !== "sqlite") {
    if (!(
      net.isIP(out.host) ||
      /^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(out.host)
    ))
      throw Error("Invalid host / 主机地址无效");
    if (
      !Number.isInteger(out.port) ||
      out.port < 1 ||
      out.port > 65535 ||
      (!["redis", "mongodb"].includes(p.type) && !out.username)
    )
      throw Error("Invalid port or username / 端口或用户名无效");
  } else {
    out.port = 0;
    out.host = "";
    out.username = "";
    out.database = "";
    out.tls = false;
  }
  if (p.type === "redis" && !/^(?:[0-9]|[1-9][0-9])$/.test(out.database || "0"))
    throw Error("Redis database must be 0–99");
  if (p.type === "oracle" && !/^[\w.$-]+$/.test(out.database))
    throw Error("Oracle requires a service name / 请填写 Oracle 服务名");
  return out;
}
// A deliberately small single-statement gate, not a general SQL parser or security sandbox.
function readQuery(sql) {
  if (
    typeof sql !== "string" ||
    !sql.trim() ||
    sql.length > 100000 ||
    sql.includes("\0")
  )
    throw Error("SQL must contain 1–100000 characters / SQL 长度无效");
  let mask = "",
    i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (sql.startsWith("--", i) || c === "#") {
      const end = sql.indexOf("\n", i);
      i = end < 0 ? sql.length : end;
      mask += " ";
      continue;
    }
    if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      if (end < 0 || sql[i + 2] === "!" || sql.slice(i + 2, end).includes("/*"))
        throw Error("Unsupported SQL comment / 不支持此注释");
      i = end + 2;
      mask += " ";
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      const q = c;
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === "\\")
          throw Error(
            "Backslash escapes are ambiguous; use standard SQL quoting / 请使用标准 SQL 引号",
          );
        if (sql[i] === q) {
          if (sql[i + 1] === q) {
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) throw Error("Unclosed SQL quote / SQL 引号未闭合");
      mask += " quoted ";
      continue;
    }
    if (c === "$" && /^\$(?:[\w]+)?\$/.test(sql.slice(i)))
      throw Error(
        "Dollar-quoted strings are not supported in this version / 暂不支持美元引号",
      );
    mask += c;
    i++;
  }
  mask = mask.trim().replace(/;\s*$/, "").trim();
  if (
    mask.includes(";") ||
    !/^(SELECT|WITH)\b/i.test(mask) ||
    /\b(INTO|ATTACH|DETACH|PRAGMA|COPY|CALL|INSERT|UPDATE|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE)\b/i.test(
      mask,
    )
  )
    throw Error(
      "Only one read query (SELECT / WITH) is allowed / 仅允许单条 SELECT 或 WITH 只读查询",
    );
  return sql;
}
module.exports = { profile, readQuery };
