import { describe, expect, it } from "vitest";
import {
  buildSql,
  parseSqlValues,
  SQL_TEMPLATE,
  SQL_EXAMPLE_IDS,
  type SqlOptions,
} from "../src/lib/sql";
const options = (updates: Partial<SqlOptions> = {}): SqlOptions => ({
  template: SQL_TEMPLATE,
  input: "00001\n90071992547409931234",
  dedupe: false,
  separator: "lines",
  ...updates,
});

describe("SQL IN builder", () => {
  it("fills all 44 supplied orders without blank lines or omissions", () => {
    const r = buildSql(options({ input: SQL_EXAMPLE_IDS }));
    const ids = SQL_EXAMPLE_IDS.split(/\r?\n/).filter(Boolean);
    expect(r.count).toBe(44);
    expect(r.duplicates).toBe(0);
    expect(r.sql).toBe(
      "SELECT XMDCDOCNO AS 订单单号,\n       XMDCSEQ AS 项次\nFROM XMDC_T\nWHERE XMDCDOCNO IN (\n" +
        ids.map((id) => `  '${id}'`).join(",\n") +
        "\n);",
    );
  });
  it("preserves leading zeros and long identifiers as strings", () => {
    expect(buildSql(options()).sql).toContain(
      "'00001',\n  '90071992547409931234'",
    );
  });
  it.each(["IN", "IN ''", "IN ()", "in ( '' )", "IN '';", "IN ( );"])(
    "supports a trailing %s",
    (tail) => {
      const r = buildSql(
        options({ template: `SELECT * FROM orders WHERE id ${tail}` }),
      );
      expect(r.sql).toContain("(\n  '00001',\n  '90071992547409931234'\n)");
      expect(r.sql.endsWith(";")).toBe(tail.endsWith(";"));
    },
  );
  it("normalizes only Markdown-escaped identifiers, not literals/comments", () => {
    const r = buildSql(
      options({
        template: "SELECT 'a\\_b' AS note FROM XMDC\\_T WHERE id IN ''",
      }),
    );
    expect(r.normalizedIdentifier).toBe(true);
    expect(r.sql).toContain("SELECT 'a\\_b' AS note FROM XMDC_T");
  });
  it("ignores blank CRLF lines and trims outer whitespace", () => {
    expect(parseSqlValues("  A \r\n\r\n B \r C\n", "lines").values).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
  it("keeps duplicates by default and removes them only on request", () => {
    const r = buildSql(options({ input: "a\na\nb" }));
    expect(r.count).toBe(3);
    expect(r.duplicates).toBe(1);
    expect(buildSql(options({ input: "a\na\nb", dedupe: true })).count).toBe(2);
  });
  it("uses explicit multi-separator mode without splitting spaces within a value", () => {
    expect(parseSqlValues("a,b，c|d\te\nf g", "auto").values).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f g",
    ]);
    expect(parseSqlValues("a,b|c", "lines").values).toEqual(["a,b|c"]);
  });
  it("escapes apostrophes instead of allowing them to terminate the SQL literal", () => {
    const r = buildSql(
      options({ input: "O'Brien\nx'); DROP TABLE orders;--\n中文😀" }),
    );
    expect(r.sql).toContain("'O''Brien'");
    expect(r.sql).toContain("'x''); DROP TABLE orders;--'");
    expect(r.sql).toContain("'中文😀'");
  });
  it("preserves the rest of a query including additional conditions and ordering", () => {
    const r = buildSql(
      options({
        template:
          "SELECT * FROM orders WHERE id IN ({{values}}) AND status = 'IN' ORDER BY id; -- keep",
      }),
    );
    expect(r.sql).toContain(") AND status = 'IN' ORDER BY id; -- keep");
  });
  it("ignores placeholder-like text in comments and literals", () => {
    const template =
      "SELECT '{{values}}' FROM orders /* IN ({{values}}) */ WHERE id IN ({{values}});";
    const r = buildSql(options({ template }));
    expect(r.sql).toContain(
      "SELECT '{{values}}' FROM orders /* IN ({{values}}) */",
    );
  });
  it.each([
    "SELECT * FROM t WHERE id IN ('old')",
    "SELECT '{{values}}'",
    "SELECT * FROM t WHERE id = {{values}}",
    "SELECT * FROM t WHERE id IN ('old' {{values}})",
    "SELECT * FROM t WHERE id IN ({{values}}) OR code IN ({{values}})",
    "SELECT * FROM t -- IN ()",
    "SELECT $$IN ({{values}})$$",
    "SELECT [IN ({{values}})]",
  ])("rejects ambiguous or nonempty templates: %s", (template) => {
    expect(() => buildSql(options({ template }))).toThrow("placeholder");
  });
  it.each([
    "SELECT 'unterminated",
    "SELECT /* unterminated",
    "SELECT [unterminated",
    "SELECT $tag$unterminated",
  ])("rejects unclosed templates: %s", (template) => {
    expect(() => buildSql(options({ template }))).toThrow("invalidTemplate");
  });
  it.each(["a\\b", "a\x00b", "a\tb"])(
    "rejects ambiguous/control characters in line mode: %s",
    (input) => {
      expect(() => buildSql(options({ input }))).toThrow("unsafeValue");
    },
  );
  it("never creates an empty IN list", () => {
    expect(() => buildSql(options({ input: " \n\n" }))).toThrow("emptyValues");
    expect(() => buildSql(options({ template: " " }))).toThrow("emptyTemplate");
  });
  it("limits input size and list count", () => {
    expect(() =>
      buildSql(options({ input: "x".repeat(1024 * 1024 + 1) })),
    ).toThrow("tooLarge");
    expect(() => buildSql(options({ template: "x".repeat(100001) }))).toThrow(
      "tooLarge",
    );
    expect(() => buildSql(options({ input: "x\n".repeat(50001) }))).toThrow(
      "tooMany",
    );
  });
});

it("accepts whitespace inside the explicit placeholder", () => {
  expect(
    buildSql(
      options({ template: "SELECT * FROM t WHERE id IN ({{ values }});" }),
    ).sql,
  ).toContain("'00001'");
});
