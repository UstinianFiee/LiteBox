import { describe, it, expect } from "vitest";
import { tokenize, groupOrders, compareSets, convert } from "../src/lib/tools";
const opts = {
  size: 2,
  delimiter: "|",
  dedupe: false,
  quote: "",
  split: "auto",
  mode: "size",
};
describe("order identifiers", () => {
  it("keeps leading zeroes and large IDs", () =>
    expect(
      groupOrders("00001\n90071992547409931234\n002", opts).groups.map(
        (g) => g.text,
      ),
    ).toEqual(["00001|90071992547409931234", "002"]));
  it("handles mixed delimiters", () =>
    expect(tokenize(" 01，02;03；04|05\t06\r\n")).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
    ]));
  it("dedupes without changing order", () =>
    expect(
      groupOrders("03 01 03 02", { ...opts, dedupe: true }).groups.map(
        (g) => g.text,
      ),
    ).toEqual(["03|01", "02"]));
  it("balances a requested group count", () =>
    expect(
      groupOrders("1 2 3 4 5 6 7", {
        ...opts,
        mode: "groups",
        size: 3,
      }).groups.map((g) => g.count),
    ).toEqual([3, 2, 2]));
  it("never creates empty groups", () =>
    expect(
      groupOrders("1 2", { ...opts, mode: "groups", size: 50 }).groups,
    ).toHaveLength(2));
  it("handles empty input", () =>
    expect(groupOrders("\n  ", opts).groups).toEqual([]));
  it("supports quotes and newline delimiter", () =>
    expect(
      groupOrders("01 02", { ...opts, quote: "'", delimiter: "\\n" }).groups[0]
        .text,
    ).toBe("'01'\n'02'"));
  it("clamps invalid group size", () =>
    expect(groupOrders("1 2", { ...opts, size: 0 }).groups).toHaveLength(2));
  it("compares sets", () => {
    expect(compareSets("a b a c", "b d", "difference")).toBe("a\nc");
    expect(compareSets("a b c", "b d", "intersection")).toBe("b");
  });
});
describe("converters", () => {
  it("formats JSON losslessly", () =>
    expect(convert('{"id":90071992547409931234}', "json-pretty")).toContain(
      "90071992547409931234",
    ));
  it("minifies JSON", () =>
    expect(convert(' { "a": 1 } ', "json-minify")).toBe('{"a":1}'));
  it("rejects malformed JSON", () =>
    expect(() => convert("{oops}", "json-pretty")).toThrow());
  it("roundtrips UTF8 Base64", () =>
    expect(
      convert(convert("轻匣 🚀 hello", "base64-encode"), "base64-decode"),
    ).toBe("轻匣 🚀 hello"));
  it("rejects invalid Base64", () =>
    expect(() => convert("%%%", "base64-decode")).toThrow());
  it("roundtrips URLs", () =>
    expect(convert(convert("中文&a=b /", "url-encode"), "url-decode")).toBe(
      "中文&a=b /",
    ));
  it("converts YAML", () =>
    expect(
      JSON.parse(
        convert("hello: world\nid: 90071992547409931234", "yaml-json"),
      ),
    ).toEqual({ hello: "world", id: "90071992547409931234" }));
  it("keeps safe YAML integers numeric", () =>
    expect(JSON.parse(convert("count: 42\nnegative: -7", "yaml-json"))).toEqual(
      { count: 42, negative: -7 },
    ));
  it("rejects unsafe exponent-form integers", () =>
    expect(() => convert('{"id":9e20}', "json-yaml")).toThrow());
  it("rejects non-finite JSON→YAML numbers", () =>
    expect(() => convert('{"id":1e400}', "json-yaml")).toThrow());
  it("rejects unsafe JSON→YAML integers", () =>
    expect(() =>
      convert('{"id":90071992547409931234}', "json-yaml"),
    ).toThrow());
  it("deduplicates lines", () =>
    expect(convert(" a\n b\n a\n", "dedupe")).toBe("a\nb"));
  it("generates UUIDs", () =>
    expect(convert("3", "uuid").split("\n")).toHaveLength(3));
  it("converts epoch", () =>
    expect(convert("0", "timestamp")).toContain("1970-01-01T00:00:00.000Z"));
  it("rejects invalid date", () =>
    expect(() => convert("not-a-date", "timestamp")).toThrow());
});
