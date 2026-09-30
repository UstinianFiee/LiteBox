const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { once } = require("node:events");
const { dialog } = require("electron");
const { DatabaseSync } = require("node:sqlite");
exports.run = async ({ win, js, click, waitHeading, check, dataDir }) => {
  const invoke = (c, p) =>
    js(`window.litebox.invoke(${JSON.stringify(c)},${JSON.stringify(p)})`);
  const wait = (condition) =>
    js(
      `new Promise((resolve,reject)=>{let n=0;const poll=()=>(${condition})?resolve(true):++n>200?reject(Error('Upgrade timeout: '+${JSON.stringify(condition)})):setTimeout(poll,25);poll()})`,
    );
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const fill = (selector, value) =>
    js(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  await check(
    "banner animation resumes after pause, navigation and visibility recovery",
    async () => {
      await click("工作台");
      await waitHeading("工具就位");
      if (await js(`!!document.querySelector('[aria-label="继续轮播"]')`))
        await click("继续轮播");
      assert.equal(
        await js(
          `getComputedStyle(document.querySelector('.banner-float')).animationPlayState`,
        ),
        "running",
      );
      const before = await js(
        `getComputedStyle(document.querySelector('.banner-float')).transform`,
      );
      await delay(180);
      assert.notEqual(
        await js(
          `getComputedStyle(document.querySelector('.banner-float')).transform`,
        ),
        before,
      );
      await click("暂停轮播");
      assert.equal(
        await js(
          `getComputedStyle(document.querySelector('.banner-float')).animationPlayState`,
        ),
        "paused",
      );
      await click("继续轮播");
      await click("历史日志");
      await waitHeading("历史日志");
      await click("工作台");
      await waitHeading("工具就位");
      await js(
        `document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pageshow'));`,
      );
      assert.equal(
        await js(
          `getComputedStyle(document.querySelector('.banner-float')).animationPlayState`,
        ),
        "running",
      );
    },
  );
  const dbFile = path.join(dataDir, "upgrade-pages.sqlite");
  const db = new DatabaseSync(dbFile);
  db.exec("CREATE TABLE records(id INTEGER PRIMARY KEY, text TEXT)");
  const insert = db.prepare("INSERT INTO records VALUES (?,?)");
  for (let i = 1; i <= 113; i++)
    insert.run(i, i === 1 ? "long-cell-" + "完整".repeat(1000) : "row-" + i);
  for (let i = 0; i < 61; i++)
    db.exec("CREATE TABLE table_" + String(i).padStart(3, "0") + "(id INT)");
  db.close();
  const requests = [];
  const api = http.createServer((req, res) => {
    let body = "";
    req.on("data", (b) => (body += b));
    req.on("end", () => {
      requests.push(JSON.parse(body));
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(
        'data: {"choices":[{"delta":{"content":"UPGRADE_AI_OK"}}]}\n\ndata: [DONE]\n\n',
      );
    });
  });
  await new Promise((r) => api.listen(0, "127.0.0.1", r));
  const config = {
    endpoint: `http://127.0.0.1:${api.address().port}/v1`,
    model: "upgrade-local",
    system: "",
  };
  await invoke("ai:configure", { ...config, key: "synthetic-upgrade-key" });
  const saved = await invoke("state:load");
  saved.theme = "light";
  saved.locale = "zh";
  saved.ai = { ...saved.ai, ...config };
  saved.databases.push({
    id: "upgrade-sqlite",
    name: "Upgrade SQLite",
    type: "sqlite",
    host: "",
    port: 0,
    username: "",
    database: "",
    path: dbFile,
    tls: false,
  });
  saved.snippets.push({
    id: "upgrade-kb",
    title: "连接超时处理记录",
    content:
      "当连接超时报错时，先核对网络与防火墙，再验证监听端口。REFERENCE_UNIQUE_729",
  });
  const originalOpen = dialog.showOpenDialog;
  const fixtureBackup = path.join(dataDir, "upgrade-state.json");
  fs.writeFileSync(fixtureBackup, JSON.stringify(saved));
  try {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [fixtureBackup],
    });
    await click("设置");
    await waitHeading("设置");
    await click("恢复");
    await wait(`!!document.querySelector('dialog[open]')`);
    await click("恢复备份");
    await wait(`!document.querySelector('dialog[open]')`);
    await delay(200);
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [dbFile],
    });
    await invoke("db:pick-file");
    dialog.showOpenDialog = originalOpen;
    await click("数据库连接");
    await waitHeading("数据库连接");
    await js(
      `[...document.querySelectorAll('.db-profile')].find(b=>b.textContent.includes('Upgrade SQLite')).click()`,
    );
    await click("连接数据库");
    await wait(
      `document.querySelector('.db-state')?.textContent.includes('已连接')`,
    );
    await check(
      "database panels share top and bottom, splitters resize both axes",
      async () => {
        const bounds = await js(
          `(()=>{const a=document.querySelector('.db-explorer').getBoundingClientRect(),b=document.querySelector('.db-workspace').getBoundingClientRect();return {ay:a.y,by:b.y,ab:a.bottom,bb:b.bottom,ax:a.right,bx:b.x}})()`,
        );
        assert(Math.abs(bounds.ay - bounds.by) < 2);
        assert(Math.abs(bounds.ab - bounds.bb) < 2);
        assert(bounds.bx > bounds.ax);
        for (const [axis, key] of [
          ["x", "ArrowRight"],
          ["y", "ArrowDown"],
        ]) {
          const selector = ".pane-divider.axis-" + axis;
          const before = await js(
            `Number(document.querySelector('${selector}').getAttribute('aria-valuenow'))`,
          );
          await js(
            `document.querySelector('${selector}').dispatchEvent(new KeyboardEvent('keydown',{key:'${key}',bubbles:true}))`,
          );
          assert.equal(
            await js(
              `Number(document.querySelector('${selector}').getAttribute('aria-valuenow'))`,
            ),
            before + 16,
          );
        }
      },
    );
    await check(
      "database catalogue pages past 50 objects without dropping names",
      async () => {
        await wait(`document.querySelectorAll('.db-table').length===50`);
        await js(
          `document.querySelector('.db-explorer .pagination-bar [aria-label="下一页"]').click()`,
        );
        await wait(`document.querySelectorAll('.db-table').length===12`);
        assert.match(
          await js(`document.querySelector('.db-tree').textContent`),
          /table_060/,
        );
      },
    );
    await check(
      "query result UI paginates all 113 rows and retains full long cells",
      async () => {
        await fill(".db-sql", "SELECT id, text FROM records ORDER BY id");
        await click("运行查询");
        await wait(
          `document.querySelectorAll('.db-grid tbody tr').length===50`,
        );
        assert.equal(
          await js(
            `document.querySelector('.db-grid tbody tr td:last-child').textContent.length`,
          ),
          2010,
        );
        const advance = () =>
          js(
            `document.querySelector('.db-workspace .pagination-bar [aria-label="下一页"]').click()`,
          );
        await advance();
        await wait(
          `document.querySelector('.db-grid tbody tr td')?.textContent==='51'`,
        );
        await advance();
        await wait(
          `document.querySelectorAll('.db-grid tbody tr').length===13`,
        );
        assert.equal(
          await js(
            `document.querySelector('.db-grid tbody tr:last-child td').textContent`,
          ),
          "113",
        );
        assert.equal(
          await js(
            `document.querySelector('.db-workspace .pagination-bar [aria-label="下一页"]').disabled`,
          ),
          true,
        );
        await js(
          `document.querySelector('.db-workspace .pagination-bar [aria-label="上一页"]').click()`,
        );
        await wait(
          `document.querySelector('.db-grid tbody tr td')?.textContent==='51'`,
        );
        await fill(".db-sql", "SELECT id FROM records WHERE id=113");
        await click("运行查询");
        await wait(`document.querySelectorAll('.db-grid tbody tr').length===1`);
        assert.equal(
          await js(`document.querySelector('.db-grid tbody th').textContent`),
          "1",
        );
      },
    );
    await invoke("db:disconnect", { id: "upgrade-sqlite" });
    await check(
      "history page uses next/previous and retains all stored events",
      async () => {
        await js(
          `Promise.all(Array.from({length:105},()=>window.litebox.invoke('activity:add',{module:'database',action:'run',status:'success'})))`,
        );
        await click("历史日志");
        await waitHeading("历史日志");
        await wait(
          `document.querySelectorAll('.history-panel tbody tr').length===50`,
        );
        await js(
          `document.querySelector('.history-panel .pagination-bar [aria-label="下一页"]').click()`,
        );
        await wait(
          `document.querySelector('.history-panel .pagination-bar').textContent.includes('2 /')`,
        );
        assert.equal(
          await js(
            `document.querySelectorAll('.history-panel tbody tr').length`,
          ),
          50,
        );
      },
    );
    await check(
      "AI text/image upload plus selected knowledge reaches local provider only after confirmation",
      async () => {
        await click("AI 助手");
        await waitHeading("AI 助手");
        await click("开启新对话");
        await fill('textarea[aria-label="消息内容"]', "连接超时报错如何解决？");
        assert.equal(
          await js(`document.querySelector('.knowledge-toggle input').checked`),
          false,
        );
        await js(
          `(()=>{const label=document.querySelector('.knowledge-toggle');label.querySelector('input').click()})()`,
        );
        await wait(
          `document.querySelector('.knowledge-preview')?.textContent.includes('连接超时处理记录')`,
        );
        const png =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV1sAAAAASUVORK5CYII=";
        await js(
          `(()=>{const dt=new DataTransfer();dt.items.add(new File(['Error: fixture connection timeout'],'fixture-error.log',{type:'text/plain'}));const b=Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0));dt.items.add(new File([b],'fixture.png',{type:'image/png'}));const el=document.querySelector('input[type=file]');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
        );
        await wait(
          `document.querySelectorAll('.chat-attachments .chat-attachment').length===2 || (document.querySelector('.chat-attachments')?.textContent.includes('fixture.png') && !document.querySelector('[aria-label="发送"]').disabled)`,
        );
        assert.equal(requests.length, 0);
        await click("发送");
        await wait(`!!document.querySelector('dialog[open]')`);
        assert.equal(requests.length, 0);
        await click("发送附件");
        await wait(
          `document.querySelector('.chat-messages')?.textContent.includes('UPGRADE_AI_OK') || document.querySelector('main')?.textContent.includes('UPGRADE_AI_OK')`,
        );
        assert.equal(requests.length, 1);
        const payload = JSON.stringify(requests[0]);
        assert.match(payload, /image_url/);
        assert.match(payload, /fixture connection timeout/);
        assert.match(payload, /REFERENCE_UNIQUE_729/);
        const latest = (await invoke("state:load")).chats.find((c) =>
          c.messages.some((m) => m.content.includes("连接超时报错如何解决")),
        );
        await wait(`!document.querySelector('[aria-label="停止生成"]')`);
        assert(
          fs.readdirSync(path.join(dataDir, "ai-attachments")).length >= 2,
        );
        await click("开启新对话");
        await fill('textarea[aria-label="消息内容"]', "不引用记录的普通问题");
        await js(
          `(()=>{const el=document.querySelector('.knowledge-toggle').querySelector('input');if(el.checked)el.click()})()`,
        );
        await click("发送");
        await wait(
          `document.querySelector('main').textContent.includes('UPGRADE_AI_OK') && !document.querySelector('[aria-label="停止生成"]')`,
        );
        assert.equal(requests.length, 2);
        assert.doesNotMatch(
          JSON.stringify(requests[1]),
          /REFERENCE_UNIQUE_729/,
        );
      },
    );
    await click("工作台");
    await waitHeading("工具就位");
    fs.writeFileSync(
      path.join(dataDir, "upgrade-home.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
  } catch (e) {
    console.error(
      "UPGRADE DIAGNOSTIC",
      await js(`document.querySelector('main').innerText`),
      "requests",
      requests.length,
    );
    throw e;
  } finally {
    dialog.showOpenDialog = originalOpen;
    api.close();
  }
};
