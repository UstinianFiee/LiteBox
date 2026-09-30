import type { Snippet, KnowledgeSource } from "./types";
export function retrieveKnowledge(
  query: string,
  records: Snippet[],
): KnowledgeSource[] {
  const normalized = query.toLocaleLowerCase();
  const tokens = new Set(normalized.match(/[a-z0-9_]{2,}/g) || []);
  for (const chunk of normalized.match(/[\u3400-\u9fff]+/g) || [])
    for (let i = 0; i < chunk.length - 1; i++)
      tokens.add(chunk.slice(i, i + 2));
  if (!tokens.size) return [];
  return records
    .map((record) => {
      const title = record.title.toLocaleLowerCase(),
        body = record.content.toLocaleLowerCase();
      let score = 0,
        first = -1;
      for (const token of tokens) {
        if (title.includes(token)) score += 5;
        const i = body.indexOf(token);
        if (i >= 0) {
          score++;
          if (first < 0 || i < first) first = i;
        }
      }
      const start = Math.max(0, first - 500),
        content =
          record.content.length > 5800
            ? (start ? "[摘录 / excerpt]…\n" : "") +
              record.content.slice(start, start + 5800) +
              "\n…[摘录 / excerpt]"
            : record.content;
      return { id: record.id, title: record.title, content, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(({ score, ...r }) => r);
}
