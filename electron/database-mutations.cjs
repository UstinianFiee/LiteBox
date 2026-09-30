// Structured mutations only: parameter bindings, no raw write SQL or DDL.
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
function validateMutation(data) {
  if (!object(data) || !["insert", "update", "delete"].includes(data.action))
    throw Error("Invalid mutation");
  if (Buffer.byteLength(JSON.stringify(data)) > 2 * 1024 * 1024)
    throw Error("Write payload exceeds 2 MiB");
  for (const field of ["schema", "table"])
    if (
      typeof data[field] !== "string" ||
      !data[field] ||
      data[field].length > 255 ||
      /\x00/.test(data[field])
    )
      throw Error("Select a target object / 请选择目标对象");
  if (data.action === "insert") {
    if (
      !Array.isArray(data.records) ||
      !data.records.length ||
      data.records.length > 500 ||
      data.records.some((r) => !object(r) || !Object.keys(r).length)
    )
      throw Error(
        "Insert requires 1–500 nonempty objects / 新增需要 1–500 条记录",
      );
  } else {
    if (!object(data.where) || !Object.keys(data.where).length)
      throw Error(
        "A nonempty exact-match filter is required / 必须填写非空精确匹配条件",
      );
    if (
      data.action === "update" &&
      (!object(data.values) || !Object.keys(data.values).length)
    )
      throw Error("Update values required");
  }
  return data;
}
function buildMutation(type, data, record) {
  validateMutation(data);
  const q = (name) => {
    if (!name || name.length > 255 || /\x00/.test(name))
      throw Error("Invalid identifier");
    const c = type === "mysql" ? "`" : '"';
    return c + name.split(c).join(c + c) + c;
  };
  const params = [];
  const bind = (value) => {
    if (
      value !== null &&
      !["string", "number", "boolean"].includes(typeof value)
    )
      throw Error("SQL fields must be scalar values / SQL 字段必须为标量");
    params.push(
      typeof value === "boolean" && type !== "postgres" ? Number(value) : value,
    );
    return type === "postgres"
      ? "$" + params.length
      : type === "oracle"
        ? ":" + params.length
        : "?";
  };
  const table = q(data.schema) + "." + q(data.table);
  let sql;
  if (data.action === "insert") {
    sql = `INSERT INTO ${table} (${Object.keys(record).map(q).join(",")}) VALUES (${Object.values(record).map(bind).join(",")})`;
  } else {
    const set =
      data.action === "update"
        ? Object.entries(data.values)
            .map(([k, v]) => q(k) + "=" + bind(v))
            .join(",")
        : "";
    const where = Object.entries(data.where)
      .map(([k, v]) => q(k) + (v === null ? " IS NULL" : "=" + bind(v)))
      .join(" AND ");
    sql =
      data.action === "delete"
        ? `DELETE FROM ${table} WHERE ${where}`
        : `UPDATE ${table} SET ${set} WHERE ${where}`;
  }
  return { sql, params };
}
module.exports = { validateMutation, buildMutation };
