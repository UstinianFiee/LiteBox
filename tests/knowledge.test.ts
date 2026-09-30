import { describe, it, expect } from "vitest";
import { retrieveKnowledge } from "../src/lib/knowledge";
describe("local knowledge retrieval", () => {
  it("matches Chinese bigrams and English terms while ignoring unrelated records", () => {
    const rows = [
      { id: "1", title: "数据库连接", content: "连接超时请检查网络" },
      { id: "2", title: "Redis memory", content: "memory usage" },
      { id: "3", title: "购物清单", content: "水果" },
    ];
    expect(retrieveKnowledge("数据库连接超时", rows)[0]?.id).toBe("1");
    expect(retrieveKnowledge("Redis memory", rows)[0]?.id).toBe("2");
    expect(retrieveKnowledge("unmatched", rows)).toEqual([]);
  });
  it("limits sources to three and uses bounded labeled excerpts", () => {
    const records = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      title: "Error guide",
      content: "x".repeat(10000) + " error " + "y".repeat(10000),
    }));
    const results = retrieveKnowledge("error", records);
    expect(results).toHaveLength(3);
    expect(results[0]!.content.length).toBeLessThanOrEqual(6000);
    expect(results[0]!.content).toContain("error");
    expect(results[0]!.content).toContain("excerpt");
  });
});
