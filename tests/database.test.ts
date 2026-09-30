import { describe, expect, it } from "vitest";
import { resultCsv, quoteDatabaseIdentifier } from "../src/lib/database";
describe("database result export", () => {
  it("quotes CSV, preserves null and guards spreadsheet formulas", () => {
    const csv = resultCsv({
      columns: ["id", "note"],
      rows: [
        ["0001", 'a,"b"\nline'],
        [null, "=1+1"],
      ],
      truncated: false,
      elapsedMs: 1,
    });
    expect(csv).toBe(
      '\ufeff"id","note"\r\n"0001","a,""b""\nline"\r\n"","\'=1+1"',
    );
  });
  it("quotes actual table identifiers without SQL interpolation", () => {
    expect(quoteDatabaseIdentifier("a`b", "mysql")).toBe("`a``b`");
    expect(quoteDatabaseIdentifier('a"b', "postgres")).toBe('"a""b"');
  });
});
