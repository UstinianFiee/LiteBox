export const SQL_TEMPLATE = `SELECT XMDCDOCNO AS 订单单号,
       XMDCSEQ AS 项次
FROM XMDC_T
WHERE XMDCDOCNO IN ({{values}});`;

export const SQL_EXAMPLE_IDS = `T2214-260921004
T2235-260920001
T2235-260918002
T2235-260914001
T2235-260911001
T2214-260902002
T2214-260825002
T2214-260805002
T2214-260805007

T2214-260729001
T2215-260724002
T2235-260717002
T2214-260716001
T2235-260710001
T2235-260709001
T2214-260707001
T2211-260707001
T2235-260707001
T2235-260622002
T2214-260630002
T2214-260608005
T2214-260605006
T2214-260605004
T2235-260604003
T2214-260602001
T2235-260525001
T2214-260521005
T2211-260526001
T2214-260522005
T2214-260508002
T2215-260422012
T2215-260420006
T2214-260421004
T2214-260415004
T2214-260413009
T2214-260409003
T2215-260407002
T2214-260402006
T2211-260324002

T2211-260324003

T2215-260306004
T2214-260225003
T2214-260224001
T2214-260225001`;

export type SqlErrorCode =
  | "emptyValues"
  | "tooLarge"
  | "tooMany"
  | "unsafeValue"
  | "emptyTemplate"
  | "invalidTemplate"
  | "placeholder";
export class SqlInputError extends Error {
  constructor(public code: SqlErrorCode) {
    super(code);
  }
}
export interface SqlOptions {
  template: string;
  input: string;
  dedupe: boolean;
  separator: "lines" | "auto";
}
export function parseSqlValues(
  input: string,
  separator: SqlOptions["separator"],
) {
  if (input.length > 1024 * 1024) throw new SqlInputError("tooLarge");
  const values = input
    .split(separator === "auto" ? /[\r\n,，\t|]+/ : /\r\n|[\r\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.length > 50000) throw new SqlInputError("tooMany");
  // Backslash escaping differs by database/session. Refuse ambiguity instead of guessing.
  if (values.some((v) => /[\\\x00-\x1f\x7f]/.test(v)))
    throw new SqlInputError("unsafeValue");
  return { values, duplicates: values.length - new Set(values).size };
}

/** Mask comments, string literals and quoted identifiers; offsets stay unchanged.
 * This is targeted IN-template handling, not a SQL parser or query validator.
 */
function codeMask(sql: string): string {
  const mask = sql.split("");
  let i = 0;
  const hide = (end: number, fill = " ") => {
    while (i < end) mask[i++] = fill;
  };
  while (i < sql.length) {
    if (sql.startsWith("--", i)) {
      const length = sql.slice(i).search(/[\r\n]/);
      hide(length === -1 ? sql.length : i + length);
    } else if (sql.startsWith("/*", i)) {
      let depth = 1,
        end = i + 2;
      while (end < sql.length && depth) {
        if (sql.startsWith("/*", end)) {
          depth++;
          end += 2;
        } else if (sql.startsWith("*/", end)) {
          depth--;
          end += 2;
        } else end++;
      }
      if (depth) throw new SqlInputError("invalidTemplate");
      hide(end);
    } else if (["'", '"', "`", "["].includes(sql[i]!)) {
      const close = sql[i] === "[" ? "]" : sql[i]!;
      let end = i + 1,
        closed = false;
      while (end < sql.length) {
        if (sql[end] === close) {
          if (sql[end + 1] === close) {
            end += 2;
            continue;
          }
          end++;
          closed = true;
          break;
        }
        end++;
      }
      if (!closed) throw new SqlInputError("invalidTemplate");
      hide(end, "~");
    } else if (
      sql[i] === "$" &&
      /^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/.test(sql.slice(i))
    ) {
      const tag = sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)![0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end === -1) throw new SqlInputError("invalidTemplate");
      hide(end + tag.length, "~");
    } else i++;
  }
  return mask.join("");
}

export function buildSql(options: SqlOptions) {
  const parsed = parseSqlValues(options.input, options.separator);
  if (!parsed.values.length) throw new SqlInputError("emptyValues");
  if (options.template.length > 100000) throw new SqlInputError("tooLarge");
  let template = options.template.trim();
  if (!template) throw new SqlInputError("emptyTemplate");
  let mask = codeMask(template);
  let normalizedIdentifier = false;
  // Undo Markdown's escaped underscore only in unquoted SQL code, never in values.
  template = template.replace(/\\_/g, (text, index: number) => {
    if (mask.slice(index, index + 2) !== text) return text;
    normalizedIdentifier = true;
    return "_";
  });
  mask = codeMask(template);
  const values = options.dedupe ? [...new Set(parsed.values)] : parsed.values;
  const list = values
    .map((value) => `  '${value.replace(/'/g, "''")}'`)
    .join(",\n");
  const placeholders = [...mask.matchAll(/\{\{\s*values\s*\}\}/g)];
  let sql: string;
  if (placeholders.length) {
    // Require one explicit target, with the placeholder as the entire IN-list.
    const clause = [
      ...mask.matchAll(/\bIN\s*\(\s*(\{\{\s*values\s*\}\})\s*\)/gi),
    ];
    if (placeholders.length !== 1 || clause.length !== 1)
      throw new SqlInputError("placeholder");
    const index = placeholders[0]!.index!;
    sql =
      template.slice(0, index) +
      "\n" +
      list +
      "\n" +
      template.slice(index + placeholders[0]![0].length);
  } else {
    const lastIn = [...mask.matchAll(/\bIN\b/gi)].pop();
    if (!lastIn) throw new SqlInputError("placeholder");
    const start = lastIn.index! + lastIn[0].length;
    const suffix = template.slice(start);
    if (!/^\s*(?:''|\(\s*(?:'')?\s*\))?\s*;?\s*$/.test(suffix))
      throw new SqlInputError("placeholder");
    sql =
      template.slice(0, start) +
      " (\n" +
      list +
      "\n)" +
      (suffix.trimEnd().endsWith(";") ? ";" : "");
  }
  return {
    sql,
    count: values.length,
    total: parsed.values.length,
    duplicates: parsed.duplicates,
    normalizedIdentifier,
  };
}
