// Local UI fixture only. Imports the production table and styles; no database,
// Electron bridge, persistence or customer records are used.
import { createApp, h, ref, computed, nextTick } from "vue";
import DatabaseResultTable from "../../src/components/DatabaseResultTable.vue";
import "../../src/styles.css";
import "../../src/responsive.css";
import "../../src/motion.css";
import "../../src/remote-layout.css";
import "../../src/enhancements.css";
import "../../src/connections.css";
import "../../src/database.css";

const buildResult = (count, rows = 50, offset = 50) => ({
  columns: Array.from(
    { length: count },
    (_, i) =>
      ["订单单号", "项次", "业务日期", "备注"][i] || `XMDC_FIELD_${i + 1}`,
  ),
  rows: Array.from({ length: rows }, (_, r) =>
    Array.from({ length: count }, (_, c) =>
      c === 0
        ? `T2214-260921${String(r + 1).padStart(3, "0")}`
        : c === 1
          ? String(r + offset + 1)
          : c === 2
            ? "2026-09-30 09:30:00"
            : c === 3
              ? "完整中文内容\n第二行说明"
              : c % 3
                ? "0"
                : null,
    ),
  ),
  elapsedMs: 1,
  truncated: false,
  offset,
});
createApp({
  setup() {
    const width = ref(980),
      result = ref(buildResult(120)),
      report = ref("待验证"),
      dark = ref(false);
    const style = computed(() => ({
      width: `${width.value}px`,
      maxWidth: "100%",
      margin: "24px auto",
      padding: "16px",
    }));
    // Vue flushes DOM updates before geometry reads; avoid background-tab RAF
    // throttling and prevent overlapping runs from mutating the fixture.
    const running = ref(false);
    const frame = () => nextTick();
    async function runChecks() {
      if (running.value) return;
      running.value = true;
      report.value = "正在验证";
      const failures = [],
        checks = [];
      const original = result.value,
        originalWidth = width.value;
      for (const w of [1440, 980, 768, 600, 320]) {
        width.value = w;
        for (const columns of [3, 120]) {
          result.value = buildResult(columns);
          await nextTick();
          await frame();
          const grid = document.querySelector(".db-grid"),
            table = grid.querySelector("table");
          const cells = [...table.querySelectorAll("tbody tr:first-child td")];
          const minWidth = Math.min(
            ...cells.map((c) => c.getBoundingClientRect().width),
          );
          const firstRow = table.querySelector("tbody tr"),
            header = table.querySelector("thead");
          const item = {
            width: w,
            columns,
            minWidth,
            rowHeight: firstRow.getBoundingClientRect().height,
            headerHeight: header.getBoundingClientRect().height,
            gridWidth: grid.clientWidth,
            scrollWidth: grid.scrollWidth,
          };
          if (
            minWidth < 143 ||
            item.rowHeight > 100 ||
            item.headerHeight > 64 ||
            (columns === 120 && grid.scrollWidth <= grid.clientWidth) ||
            document.documentElement.scrollWidth > innerWidth + 1
          )
            failures.push(item);
          if (
            table.querySelector("tbody th").textContent.trim() !== "51" ||
            cells[0].textContent !== "T2214-260921001" ||
            table.querySelectorAll("tbody tr").length !== 50
          )
            failures.push({ integrity: item });
          grid.scrollLeft = grid.scrollWidth;
          const last = cells.at(-1).getBoundingClientRect(),
            bounds = grid.getBoundingClientRect();
          if (last.right > bounds.right + 2 || last.right < bounds.left)
            failures.push({ unreachableLastColumn: item });
          grid.scrollTop = 400;
          await frame();
          if (
            Math.abs(
              table.querySelector("thead th").getBoundingClientRect().top -
                grid.getBoundingClientRect().top,
            ) > 2
          )
            failures.push({ headerNotSticky: item });
          checks.push(item);
        }
      }
      result.value = buildResult(3, 1, 0);
      result.value.rows[0][2] = "长内容".repeat(1000) + "END";
      await nextTick();
      await frame();
      const longCell = document.querySelector(".db-grid tbody td:last-child");
      if (
        longCell.textContent.length !== 3003 ||
        longCell.getAttribute("title") !== longCell.textContent ||
        longCell.getBoundingClientRect().width > 481
      )
        failures.push({ longValue: longCell.getBoundingClientRect().width });
      result.value = { ...buildResult(3), rows: [] };
      await nextTick();
      if (
        document.querySelectorAll(".db-grid thead th").length !== 4 ||
        document.querySelectorAll(".db-grid tbody tr").length !== 0
      )
        failures.push({ emptyResult: true });
      width.value = originalWidth;
      result.value = original;
      await nextTick();
      const restoredGrid = document.querySelector(".db-grid");
      restoredGrid.scrollLeft = 0;
      restoredGrid.scrollTop = 0;
      running.value = false;
      report.value = JSON.stringify(
        {
          passed: failures.length === 0,
          cases: checks.length + 2,
          failures,
          checks,
        },
        null,
        2,
      );
    }
    return () =>
      h("main", { style: style.value }, [
        h("h1", "数据库宽表回归 / Database grid regression"),
        h(
          "p",
          "仅使用虚构数据 · 与数据库页面共用结果表格和样式，不连接真实数据库。",
        ),
        h(
          "div",
          { style: "display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px" },
          [
            h(
              "button",
              { class: "button", disabled: running.value, onClick: runChecks },
              "运行布局回归",
            ),
            h(
              "button",
              {
                class: "button",
                onClick: () => {
                  dark.value = !dark.value;
                  document.documentElement.dataset.theme = dark.value
                    ? "dark"
                    : "light";
                },
              },
              "切换明暗主题",
            ),
            h(
              "button",
              {
                class: "button",
                onClick: () => {
                  result.value = buildResult(120);
                },
              },
              "120 列结果",
            ),
            h(
              "button",
              {
                class: "button",
                onClick: () => {
                  result.value = buildResult(3);
                },
              },
              "3 列结果",
            ),
          ],
        ),
        h("section", { class: "database-page", style: "min-height:0" }, [
          h(
            "div",
            { class: "db-workspace panel", style: "height:500px;min-height:0" },
            [
              h(
                "div",
                { class: "db-result-toolbar" },
                "查询结果 · 从第 51 条开始 / Query results · offset 50",
              ),
              h(
                "div",
                {
                  class: "db-grid",
                  tabindex: 0,
                  "aria-label": "数据库结果表格",
                },
                [h(DatabaseResultTable, { result: result.value })],
              ),
              h("div", { class: "db-result-footer" }, [
                h(
                  "div",
                  { class: "db-result-status" },
                  "第 2 页 · 50 条记录 · 可横向及纵向滚动",
                ),
              ]),
            ],
          ),
        ]),
        h(
          "pre",
          {
            role: "status",
            style: "white-space:pre-wrap;overflow-wrap:anywhere",
          },
          report.value,
        ),
      ]);
  },
}).mount("#app");
