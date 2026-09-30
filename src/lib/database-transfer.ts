import Papa from "papaparse";
import { parse, isSafeNumber } from "lossless-json";
export function parseDataJson(text: string): any {
  return parse(text, undefined, {
    parseNumber: (value) => {
      if (!isSafeNumber(value))
        throw Error(
          "Quote large / high-precision numbers or use MongoDB Extended JSON / 大数及高精度数请加引号或使用 Extended JSON",
        );
      return Number(value);
    },
  });
}
import type { QueryResult } from "./types";
import { quoteDatabaseIdentifier, resultCsv } from "./database";
export type DataFormat = "csv" | "tsv" | "json" | "sql";
export function resultClipboard(result: QueryResult, headers = true) {
  const quote = (v: string | null) => {
    const s = v ?? "NULL";
    return /[\t\r\n"]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  };
  return (headers ? [result.columns, ...result.rows] : result.rows)
    .map((row) => row.map(quote).join("\t"))
    .join("\r\n");
}
export function exportResult(
  result: QueryResult,
  format: DataFormat,
  type = "sqlite",
  schema = "",
  table = "",
) {
  if (format === "csv") return resultCsv(result);
  if (format === "tsv")
    return (
      "\ufeff" +
      Papa.unparse(
        { fields: result.columns, data: result.rows },
        { delimiter: "\t", escapeFormulae: true },
      )
    );
  // Matrix format preserves duplicate column names, NULL and exact text values.
  if (format === "json") {
    if (
      type === "mongodb" &&
      result.columns.length === 1 &&
      result.columns[0] === "document"
    )
      return JSON.stringify(
        result.rows.map((row) => parseDataJson(row[0] || "null")),
        null,
        2,
      );
    return JSON.stringify(
      { columns: result.columns, rows: result.rows },
      null,
      2,
    );
  }
  if (!schema || !table || ["mongodb", "redis"].includes(type))
    throw Error(
      "SQL export requires a selected SQL table / SQL 导出需要选中关系型数据表",
    );
  if (new Set(result.columns).size !== result.columns.length)
    throw Error(
      "Duplicate column names cannot be exported as INSERT statements / 重复列名不能导出 INSERT",
    );
  const q = (v: string) => quoteDatabaseIdentifier(v, type);
  const literal = (v: string | null) => {
    if (v === null) return "NULL";
    if (v.includes("\0")) throw Error("SQL export does not support NUL");
    let s = v.replaceAll("'", "''");
    if (v.includes("\\") && type === "mysql") {
      const hex = Array.from(new TextEncoder().encode(v), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      return `CONVERT(X'${hex}' USING utf8mb4)`;
    }
    if (v.includes("\\") && type === "postgres")
      return "E'" + s.replaceAll("\\", "\\\\") + "'";
    return "'" + s + "'";
  };
  return (
    "-- Review target columns and types before running. Text values are quoted.\n" +
    result.rows
      .map(
        (row) =>
          `INSERT INTO ${q(schema)}.${q(table)} (${result.columns.map(q).join(", ")}) VALUES (${row.map(literal).join(", ")});`,
      )
      .join("\n")
  );
}
export function parseImport(
  text: string,
  name: string,
): Record<string, unknown>[] {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw Error("Import limit: 2 MiB / 导入上限 2 MiB");
  let records: unknown;
  if (name.toLowerCase().endsWith(".json")) {
    const value = parseDataJson(text.replace(/^\ufeff/, ""));
    if (Array.isArray(value)) records = value;
    else if (
      value &&
      Array.isArray(value.columns) &&
      Array.isArray(value.rows)
    ) {
      if (
        value.columns.some((c: unknown) => typeof c !== "string" || !c) ||
        new Set(value.columns).size !== value.columns.length
      )
        throw Error("Unique nonempty column names required / 列名须非空且唯一");
      records = value.rows.map((row: unknown[]) => {
        if (!Array.isArray(row) || row.length !== value.columns.length)
          throw Error("Column count mismatch");
        return Object.fromEntries(
          value.columns.map((c: string, i: number) => [c, row[i]]),
        );
      });
    } else
      throw Error(
        "JSON requires an array of objects or {columns, rows} / JSON 需要对象数组或 {columns, rows}",
      );
  } else {
    if (!/\.(csv|tsv)$/i.test(name)) throw Error("Supported: CSV / TSV / JSON");
    const parsed = Papa.parse<string[]>(text.replace(/^\ufeff/, ""), {
      delimiter: name.toLowerCase().endsWith(".tsv") ? "\t" : ",",
      skipEmptyLines: "greedy",
    });
    if (parsed.errors.length) throw Error(parsed.errors[0]!.message);
    const [headers, ...rows] = parsed.data;
    if (
      !headers?.length ||
      headers.some((h) => !h.trim()) ||
      new Set(headers).size !== headers.length
    )
      throw Error("Unique nonempty headers required / 首行列名须非空且唯一");
    records = rows.map((row) => {
      if (row.length !== headers.length)
        throw Error("Column count mismatch / 列数不一致");
      return Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    });
  }
  if (
    !Array.isArray(records) ||
    !records.length ||
    records.length > 500 ||
    records.some(
      (r) =>
        !r ||
        typeof r !== "object" ||
        Array.isArray(r) ||
        !Object.keys(r).length,
    )
  )
    throw Error("Import requires 1–500 objects / 每次导入 1–500 条记录");
  return records;
}
