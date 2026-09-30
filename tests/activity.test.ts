import { describe, expect, it } from "vitest";
import {
  activityStats,
  moduleNames,
  actionNames,
  type ActivityRecord,
} from "../src/lib/activity";
describe("activity statistics", () => {
  const now = new Date(2026, 8, 28, 12).getTime();
  const row = (
    action: ActivityRecord["action"],
    at = now,
    status: ActivityRecord["status"] = "success",
  ): ActivityRecord => ({
    id: crypto.randomUUID(),
    module: "database",
    action,
    at,
    status,
  });
  it("excludes navigation and starts, counts genuine errors and handles empty data", () => {
    const stats = activityStats(
      [
        row("start"),
        row("visit"),
        row("query"),
        row("write", now, "error"),
        row("export", now, "cancelled"),
      ],
      now,
    );
    expect(stats.today).toBe(3);
    expect(stats.errors).toBe(1);
    expect(stats.modules[0]?.count).toBe(3);
    expect(activityStats([], now).days.every((d) => d.count === 0)).toBe(true);
  });
  it("uses seven local-calendar-day boundaries and excludes future from today", () => {
    const midnight = new Date(2026, 8, 28).getTime();
    const stats = activityStats(
      [
        row("query", midnight - 1),
        row("query", midnight),
        row("query", now + 86400000),
      ],
      now,
    );
    expect(stats.today).toBe(1);
    expect(stats.days).toHaveLength(7);
    expect(stats.days[5]?.count).toBe(1);
    expect(stats.days[6]?.count).toBe(1);
  });
  it("provides bilingual labels for all types", () => {
    expect(
      Object.values(moduleNames).every(
        (p) => p.length === 2 && p.every(Boolean),
      ),
    ).toBe(true);
    expect(
      Object.values(actionNames).every(
        (p) => p.length === 2 && p.every(Boolean),
      ),
    ).toBe(true);
  });
});
