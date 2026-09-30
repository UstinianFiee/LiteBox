const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { dialog, clipboard } = require("electron");
const { DatabaseSync } = require("node:sqlite");
exports.run = async ({
  win,
  js,
  click,
  waitHeading,
  check,
  dataDir,
  confirmDialog,
}) => {
  const file = path.join(dataDir, "database-fixture.sqlite");
  const db = new DatabaseSync(file);
  db.exec(
    "CREATE TABLE orders(order_no TEXT, amount INTEGER, note TEXT); INSERT INTO orders VALUES ('00001234',9007199254740993,NULL),('DEMO-02',4,'=1+1');",
  );
  db.close();
  const invoke = (channel, payload) =>
    js(
      `window.litebox.invoke(${JSON.stringify(channel)},${JSON.stringify(payload)})`,
    );
  const p = {
    id: "sqlite-smoke",
    name: "SQLite verification",
    type: "sqlite",
    host: "",
    port: 0,
    username: "",
    database: "",
    path: file,
    tls: false,
  };
  const wait = (condition) =>
    js(
      `new Promise((resolve,reject)=>{let n=0;const poll=()=>(${condition})?resolve(true):++n>160?reject(Error('Database UI timeout: '+${JSON.stringify(condition)})):setTimeout(poll,30);poll();})`,
    );
  const fill = (label, value) =>
    js(
      `(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)});const el=label?.querySelector('input');if(!el)throw Error('Missing label');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  await check(
    "Oracle Thin, MongoDB and Redis drivers load in Electron",
    async () => {
      assert.equal(require("oracledb").thin, true);
      assert.equal(typeof require("mongodb").MongoClient, "function");
      assert.equal(typeof require("redis").createClient, "function");
    },
  );
  await check(
    "database IPC requires explicit SQLite file authorization",
    async () => {
      await assert.rejects(invoke("db:connect", { profile: p }), /选择器/);
    },
  );
  const originalOpen = dialog.showOpenDialog;
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  try {
    await click("数据库连接");
    await waitHeading("数据库连接");
    await click("新建数据库连接");
    await wait(`!!document.querySelector('dialog[open]')`);
    await fill("连接名称", "SQLite verification");
    await js(`document.querySelector('[aria-label="数据库类型"]').click()`);
    await wait(`!!document.querySelector(':popover-open')`);
    await js(
      `[...document.querySelectorAll('[role=option]')].find(el=>el.textContent.trim()==='SQLite').click()`,
    );
    await click("选择 SQLite 文件");
    await click("测试连接");
    await wait(
      `document.querySelector('dialog [role=status]')?.textContent.includes('连接测试成功')`,
    );
    await click("保存配置");
    await click("连接数据库");
    await wait(
      `document.querySelector('.db-state')?.textContent.includes('已连接')`,
    );
    await wait(`!!document.querySelector('.db-table')`);
    await check(
      "SQLite desktop UI connects, discovers table structure and runs real SQL",
      async () => {
        await js(`document.querySelector('.db-table').click()`);
        await wait(
          `document.querySelector('.db-grid')?.textContent.includes('order_no')`,
        );
        await click("运行查询");
        await wait(
          `document.querySelector('.db-grid')?.textContent.includes('9007199254740993')`,
        );
        assert.match(
          await js(`document.querySelector('.db-grid').textContent`),
          /00001234/,
        );
        assert.match(
          await js(`document.querySelector('.db-grid').textContent`),
          /NULL/,
        );
        assert.equal(
          await js(`document.querySelector('input[type=password]')`),
          null,
        );
      },
    );
    await check(
      "database connection and results survive switching tools",
      async () => {
        const before = await js(
          "document.querySelector('.db-grid').textContent",
        );
        await click("工作台");
        await waitHeading("工具就位");
        await click("数据库连接");
        await waitHeading("数据库连接");
        await wait(
          "document.querySelector('.db-state')?.textContent.includes('已连接')",
        );
        assert.equal(
          await js("document.querySelector('.db-grid').textContent"),
          before,
        );
        await click("运行查询");
        await wait(
          "document.querySelector('.db-grid')?.textContent.includes('9007199254740993')",
        );
      },
    );
    await check(
      "database result CSV exports exact integers and guards formulas",
      async () => {
        const output = path.join(dataDir, "database-result.csv");
        const originalSave = dialog.showSaveDialog;
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: output,
        });
        try {
          await click("导出");
          for (let i = 0; i < 100; i++) {
            if (
              fs.existsSync(output) &&
              fs.readFileSync(output, "utf8").includes("9007199254740993")
            )
              break;
            await new Promise((r) => setTimeout(r, 20));
          }
          const csv = fs.readFileSync(output, "utf8");
          assert.match(csv, /9007199254740993/);
          assert.match(csv, /'=1\+1/);
        } finally {
          dialog.showSaveDialog = originalSave;
        }
      },
    );
    await check("database copy buttons include or omit headers", async () => {
      const originalRead = clipboard.readText,
        originalWrite = clipboard.writeText;
      let fixture = "";
      clipboard.readText = async () => fixture;
      clipboard.writeText = async (text) => {
        fixture = text;
      };
      try {
        await click("复制表头+内容");
        await wait(`document.querySelector('[role=status]') || true`);
        for (
          let i = 0;
          i < 50 && !(await clipboard.readText()).startsWith("order_no");
          i++
        )
          await new Promise((r) => setTimeout(r, 20));
        assert(
          (await clipboard.readText()).startsWith("order_no\tamount\tnote"),
        );
        await click("仅复制内容");
        for (
          let i = 0;
          i < 50 && !(await clipboard.readText()).startsWith("00001234");
          i++
        )
          await new Promise((r) => setTimeout(r, 20));
        assert(
          (await clipboard.readText()).startsWith(
            "00001234\t9007199254740993\tNULL",
          ),
        );
      } finally {
        clipboard.readText = originalRead;
        clipboard.writeText = originalWrite;
      }
    });
    await check(
      "database OS credential persistence never returns plaintext to renderer",
      async () => {
        const target = {
          ...p,
          id: "vault-smoke",
          type: "mysql",
          host: "127.0.0.1",
          port: 3306,
          username: "fixture",
          path: "",
        };
        await invoke("db:secret-save", {
          profile: target,
          password: "fixture-only-password",
        });
        assert.equal(
          await invoke("db:secret-status", { profile: target }),
          true,
        );
        assert.equal(
          await invoke("db:secret-status", {
            profile: { ...target, host: "other-host" },
          }),
          false,
        );
        const file = fs.readFileSync(
          path.join(dataDir, "database-secrets.json"),
          "utf8",
        );
        assert(!file.includes("fixture-only-password"));
        const vault = require("../electron/database-secrets.cjs").createVault(
          dataDir,
          require("electron").safeStorage,
        );
        assert.equal(vault.get(target), "fixture-only-password");
        await invoke("db:secret-forget", { profile: target });
        assert.equal(
          await invoke("db:secret-status", { profile: target }),
          false,
        );
      },
    );
    await check(
      "database UI clears stale results and rejects a write query",
      async () => {
        await js(
          `(()=>{const el=document.querySelector('[aria-label="数据库 SQL 编辑器"]');el.value='DELETE FROM orders';el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
        );
        await wait(`!document.querySelector('.db-grid table')`);
        await click("运行查询");
        await wait(
          `document.querySelector('[role=alert]')?.textContent.includes('SELECT')`,
        );
        let profile;
        for (let i = 0; i < 100; i++) {
          profile = (await invoke("state:load"))?.databases?.[0];
          if (profile) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert(profile, "Database profile persisted");
        assert.equal(profile.password, undefined);
        const rows = await invoke("db:query", {
          id: profile.id,
          sql: "SELECT count(*) FROM orders",
        });
        assert.equal(rows.rows[0][0], "2");
      },
    );
    await check(
      "native database writes require confirmation and support real CRUD",
      async () => {
        const target = (await invoke("state:load")).databases[0];
        const original = confirmDialog.showMessageBox;
        const write = (data) =>
          invoke("db:mutate", {
            id: target.id,
            data: { schema: "main", table: "orders", ...data },
          });
        try {
          confirmDialog.showMessageBox = async () => ({ response: 0 });
          assert.equal(
            (
              await write({
                action: "insert",
                records: [{ order_no: "CRUD-001", amount: 5, note: "initial" }],
              })
            ).cancelled,
            true,
          );
          assert.equal(
            (
              await invoke("db:query", {
                id: target.id,
                sql: "SELECT count(*) FROM orders",
              })
            ).rows[0][0],
            "2",
          );
          confirmDialog.showMessageBox = async () => ({ response: 1 });
          assert.equal(
            (
              await write({
                action: "insert",
                records: [{ order_no: "CRUD-001", amount: 5, note: "initial" }],
              })
            ).rows[0][0],
            "1",
          );
          assert.equal(
            (
              await write({
                action: "update",
                where: { order_no: "CRUD-001" },
                values: { note: "updated" },
              })
            ).rows[0][0],
            "1",
          );
          assert.equal(
            (
              await invoke("db:query", {
                id: target.id,
                sql: "SELECT note FROM orders WHERE order_no='CRUD-001'",
              })
            ).rows[0][0],
            "updated",
          );
          assert.equal(
            (await write({ action: "delete", where: { order_no: "CRUD-001" } }))
              .rows[0][0],
            "1",
          );
          await assert.rejects(write({ action: "delete", where: {} }), /非空/);
        } finally {
          confirmDialog.showMessageBox = original;
        }
      },
    );
    await check(
      "data editor previews imports and keeps submit disabled until acknowledged",
      async () => {
        await click("新增 / 导入");
        await wait(`!!document.querySelector('.db-data-modal[open]')`);
        assert.equal(
          await js(
            `document.querySelector('.db-data-modal .primary').disabled`,
          ),
          true,
        );
        const input = path.join(dataDir, "import-preview.json");
        fs.writeFileSync(
          input,
          JSON.stringify([
            { order_no: "PREVIEW-ONLY", amount: "12", note: null },
          ]),
        );
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [input],
        });
        await click("导入 CSV / TSV / JSON");
        await wait(
          `document.querySelector('.db-import-preview')?.textContent.includes('PREVIEW-ONLY')`,
        );
        await js(
          `document.querySelector('.db-data-modal .icon-button').click()`,
        );
        const target = (await invoke("state:load")).databases[0];
        assert.equal(
          (
            await invoke("db:query", {
              id: target.id,
              sql: "SELECT count(*) FROM orders",
            })
          ).rows[0][0],
          "2",
        );
      },
    );
    await click("断开数据库");
    await wait(
      `document.querySelector('.db-state')?.textContent.includes('未连接')`,
    );
    await click("查看示例");
    await wait(
      `document.querySelector('.db-grid')?.textContent.includes('DEMO-001')`,
    );
    fs.writeFileSync(
      path.join(dataDir, "database-light.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await click("切换到英文");
    await click("Toggle theme");
    assert.match(
      await js(`document.querySelector('.db-demo').textContent`),
      /fictional/,
    );
    fs.writeFileSync(
      path.join(dataDir, "database-dark.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await click("Toggle theme");
    await click("Switch to Chinese");
    await click("工作台");
  } finally {
    dialog.showOpenDialog = originalOpen;
  }
};
