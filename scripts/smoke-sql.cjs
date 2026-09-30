"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { clipboard, dialog } = require("electron");
exports.run = async ({ win, js, click, waitHeading, check, dataDir }) => {
  const fill = async (id, value) => {
    await js(
      `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
  };
  await click("SQL 处理");
  await waitHeading("SQL 处理");
  await check(
    "SQL example generates all 44 orders and writes through native clipboard",
    async () => {
      await click("载入订单示例");
      const result = await js(`document.getElementById('sql-output').value`);
      assert.equal(
        result.split("\n").filter((line) => /^  '/.test(line)).length,
        44,
      );
      assert.match(result, /'T2214-260921004'/);
      assert.match(result, /'T2214-260225001'/);
      const original = clipboard.writeText;
      const writes = [];
      clipboard.writeText = async (text) => writes.push(text);
      try {
        await click("复制 SQL");
        assert.deepEqual(writes, [result]);
      } finally {
        clipboard.writeText = original;
      }
      const save = dialog.showSaveDialog;
      const output = path.join(dataDir, "sql-orders.sql");
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: output,
      });
      try {
        await click("导出 .sql");
        // File creation precedes the asynchronous write; wait for complete contents.
        for (let i = 0; i < 100; i++) {
          if (
            fs.existsSync(output) &&
            fs.readFileSync(output, "utf8") === result
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.equal(fs.readFileSync(output, "utf8"), result);
      } finally {
        dialog.showSaveDialog = save;
      }
    },
  );
  await check(
    "SQL drafts clear stale output and reject ambiguous templates",
    async () => {
      await fill("sql-template", "SELECT * FROM t WHERE id IN ('existing')");
      assert.equal(await js(`document.getElementById('sql-output').value`), "");
      await click("生成 SQL");
      assert.match(
        await js(`document.querySelector('[role=alert]').textContent`),
        /IN/,
      );
      assert.equal(await js(`document.getElementById('sql-output').value`), "");
    },
  );
  await check(
    "SQL template handles escaped table name, blanks and quoted IDs",
    async () => {
      await fill(
        "sql-template",
        "SELECT * FROM XMDC\\_T WHERE XMDCDOCNO IN ''",
      );
      await fill("sql-values", "00001\n\nO'Brien\n90071992547409931234");
      await click("生成 SQL");
      assert.equal(
        await js(`document.getElementById('sql-output').value`),
        "SELECT * FROM XMDC_T WHERE XMDCDOCNO IN (\n  '00001',\n  'O''Brien',\n  '90071992547409931234'\n)",
      );
      await click("切换到英文");
      await waitHeading("SQL builder");
      await click("Generate SQL");
      assert.match(
        await js(
          `document.querySelector('.sql-result [role=status]').textContent`,
        ),
        /Generated 3 values/,
      );
      await click("Switch to Chinese");
    },
  );
  await check(
    "SQL drafts persist through native state and navigation",
    async () => {
      const expected = await js(`document.getElementById('sql-values').value`);
      let saved;
      for (let i = 0; i < 100; i++) {
        saved = await js(`window.litebox.invoke('state:load')`);
        if (saved?.sql?.input === expected) break;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      assert.equal(saved.sql.input, expected);
      await click("工作台");
      await waitHeading("工具就位");
      await click("SQL 处理");
      await waitHeading("SQL 处理");
      assert.equal(
        await js(`document.getElementById('sql-values').value`),
        expected,
      );
      assert.match(
        await js(`document.getElementById('sql-output').value`),
        /O''Brien/,
      );
    },
  );
};
