import type { QueryResult } from "./types";
export function resultCsv(result: QueryResult) {
  const escape = (value: string | null) => {
    let text = value ?? "";
    // Spreadsheet formula protection; original values remain unchanged in the grid.
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [result.columns, ...result.rows]
      .map((row) => row.map(escape).join(","))
      .join("\r\n")
  );
}
export function quoteDatabaseIdentifier(value: string, type: string) {
  const quote = type === "mysql" ? "`" : '"';
  return quote + value.split(quote).join(quote + quote) + quote;
}
