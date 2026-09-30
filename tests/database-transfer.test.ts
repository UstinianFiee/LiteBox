import { describe, it, expect } from "vitest";
import {
  exportResult,
  parseImport,
  resultClipboard,
  parseDataJson,
} from "../src/lib/database-transfer";
const result = {
  columns: ["id", "note"],
  rows: [
    ["0001", "a\tb"],
    ["9007199254740993", null],
  ],
  truncated: false,
  elapsedMs: 1,
};
describe("database transfer", () => {
  it("copies header and content separately with multiline escaping and exact values", () => {
    expect(resultClipboard(result, true)).toBe(
      'id\tnote\r\n0001\t"a\tb"\r\n9007199254740993\tNULL',
    );
    expect(resultClipboard(result, false)).not.toContain("id\tnote");
  });
  it("round trips JSON NULL and exact integer strings", () => {
    expect(parseImport(exportResult(result, "json"), "data.json")).toEqual([
      { id: "0001", note: "a\tb" },
      { id: "9007199254740993", note: null },
    ]);
  });
  it("handles CSV and TSV quoting, blank values and leading zeros", () => {
    expect(parseImport('id,note\r\n001,"a,b"\r\n002,""', "test.csv")).toEqual([
      { id: "001", note: "a,b" },
      { id: "002", note: "" },
    ]);
    expect(parseImport('id\tnote\n001\t"hello\nworld"', "test.tsv")[0]).toEqual(
      { id: "001", note: "hello\nworld" },
    );
  });
  it("guards unsafe imports", () => {
    for (const [text, name] of [
      ["a,a\n1,2", "x.csv"],
      ["a,b\n1", "x.csv"],
      ["[]", "x.json"],
      ["DROP TABLE x", "x.sql"],
      ['[{"n":9007199254740993}]', "x.json"],
    ])
      expect(() => parseImport(text!, name!)).toThrow();
    expect(() =>
      parseImport(
        JSON.stringify(Array.from({ length: 501 }, () => ({ id: "1" }))),
        "x.json",
      ),
    ).toThrow();
    expect(() => parseDataJson('{"n":0.12345678901234567890123}')).toThrow();
  });
  it("preserves duplicate columns on JSON export but refuses ambiguous import", () => {
    const value = exportResult({ ...result, columns: ["x", "x"] }, "json");
    expect(JSON.parse(value).columns).toEqual(["x", "x"]);
    expect(() => parseImport(value, "data.json")).toThrow();
  });
  it("exports escaped INSERT scripts for selected relational targets only", () => {
    expect(
      exportResult(
        { ...result, rows: [["O'Reilly", null]] },
        "sql",
        "postgres",
        "public",
        "orders",
      ),
    ).toContain("VALUES ('O''Reilly', NULL)");
    expect(() => exportResult(result, "sql")).toThrow();
    expect(() => exportResult(result, "sql", "redis", "0", "key")).toThrow();
  });
  it("exports MongoDB documents as Extended JSON arrays for reimport", () => {
    const doc = {
      _id: { $oid: "507f1f77bcf86cd799439011" },
      n: { $numberLong: "9007199254740993" },
    };
    expect(
      parseImport(
        exportResult(
          { ...result, columns: ["document"], rows: [[JSON.stringify(doc)]] },
          "json",
          "mongodb",
        ),
        "mongo.json",
      ),
    ).toEqual([doc]);
  });
});
