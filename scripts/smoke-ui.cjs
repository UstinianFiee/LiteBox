const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
exports.run = async ({ win, js, click, waitHeading, check, dataDir }) => {
  const wait = (condition) =>
    js(
      `new Promise((resolve,reject)=>{let n=0;const poll=()=>(${condition})?resolve(true):++n>150?reject(Error('UI timed out: '+${JSON.stringify(condition)})):setTimeout(poll,20);poll()})`,
    );
  const fill = (label, value) =>
    js(
      `(()=>{const el=[...document.querySelectorAll('dialog label')].find(el=>el.textContent.trim()===${JSON.stringify(label)}).querySelector('input');el.value=${JSON.stringify(String(value))};el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  const option = async (label) => {
    await wait(`!!document.querySelector('[popover]:popover-open')`);
    await js(
      `[...document.querySelectorAll('[popover]:popover-open [role=option]')].find(el=>el.textContent.trim()===${JSON.stringify(label)}).click()`,
    );
  };
  await check(
    "blue-white palette, readable body and 44px controls",
    async () => {
      assert.equal(
        await js(`getComputedStyle(document.body).fontSize`),
        "16px",
      );
      assert.equal(
        await js(
          `getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`,
        ),
        "#165dce",
      );
      await click("文本整理");
      await waitHeading("文本整理");
      assert(
        await js(
          `[...document.querySelectorAll('.select-trigger')].every(el=>el.getBoundingClientRect().height>=44&&parseFloat(getComputedStyle(el).fontSize)>=16)`,
        ),
      );
      assert.equal(await js(`document.querySelectorAll('select').length`), 0);
    },
  );
  await check("shared dropdown keyboard selection and dismissal", async () => {
    await js(`document.querySelector('[aria-label="添加引号"]').click()`);
    await wait(`!!document.querySelector('[popover]:popover-open')`);
    await js(
      `document.querySelector('[aria-label="添加引号"]').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))`,
    );
    await js(
      `document.querySelector('[aria-label="添加引号"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`,
    );
    assert.match(
      await js(`document.querySelector('[aria-label="添加引号"]').textContent`),
      /双引号/,
    );
    assert.equal(
      await js(`document.querySelectorAll(':popover-open').length`),
      0,
    );
    await js(`document.querySelector('[aria-label="添加引号"]').click()`);
    await wait(`!!document.querySelector(':popover-open')`);
    await js(
      `document.querySelector('[aria-label="添加引号"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
    );
    assert.equal(
      await js(`document.querySelectorAll(':popover-open').length`),
      0,
    );
  });
  await click("远程连接");
  await waitHeading("远程连接");
  await click("新建连接");
  await wait(`!!document.querySelector('dialog[open]')`);
  await check(
    "dropdown works inside modal and preserves RDP/SSH defaults",
    async () => {
      await js(`document.querySelector('[aria-label="连接类型"]').click()`);
      await option("Windows / RDP");
      assert.equal(
        await js(`document.querySelector('dialog input[type=number]').value`),
        "3389",
      );
      await js(`document.querySelector('[aria-label="连接类型"]').click()`);
      await option("Linux / SSH");
      assert.equal(
        await js(`document.querySelector('dialog input[type=number]').value`),
        "22",
      );
    },
  );
  await fill("名称", "界面验证 · 本机模拟服务器");
  await fill("主机地址", "127.0.0.1");
  await fill("用户名", "tester");
  await click("保存连接");
  await wait(`!!document.querySelector('.terminal-panel')`);
  await check(
    "remote defaults to terminal + file layout, tabs preserve DOM, list collapses",
    async () => {
      assert(
        await js(`document.querySelector('.terminal-panel').clientWidth>600`),
      );
      assert.notEqual(
        await js(
          `getComputedStyle(document.querySelector('.sftp-panel')).display`,
        ),
        "none",
      );
      await js(
        `window.__terminalPanel=document.querySelector('.terminal-container')`,
      );
      await click("文件管理");
      await click("双面板");
      await click("终端");
      assert(
        await js(
          `window.__terminalPanel===document.querySelector('.terminal-container')`,
        ),
      );
      await click("收起服务器列表");
      assert.equal(
        await js(
          `getComputedStyle(document.querySelector('.server-sidebar')).display`,
        ),
        "none",
      );
      await click("显示服务器列表");
    },
  );
  await check(
    "remote panels align and terminal fills height at desktop sizes",
    async () => {
      for (const [width, height] of [
        [1440, 960],
        [1280, 720],
        [820, 620],
      ]) {
        win.setContentSize(width, height);
        await new Promise((r) => setTimeout(r, 150));
        const rects = await js(
          `(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};return {sidebar:rect('.server-sidebar'),main:rect('.remote-main'),terminal:rect('.terminal-panel'),container:rect('.terminal-container'),viewport:innerHeight}})()`,
        );
        assert(
          Math.abs(rects.sidebar.bottom - rects.main.bottom) < 2,
          JSON.stringify(rects),
        );
        assert(rects.main.bottom <= height + 1, JSON.stringify(rects));
        if (height >= 700)
          assert(
            Math.abs(rects.terminal.bottom - rects.main.bottom) < 5,
            JSON.stringify(rects),
          );
        else
          assert(
            await js(
              `(()=>{const p=document.querySelector('.remote-main > [role=tabpanel]');return p.scrollHeight>p.clientHeight && getComputedStyle(p).overflowY==='auto'})()`,
            ),
            "Short viewport must scroll inside workspace",
          );
        assert(rects.container.height >= 120, JSON.stringify(rects));
      }
      win.setContentSize(1440, 960);
    },
  );
  await js(`document.querySelector('main').scrollTop=0`);
  await new Promise((r) => setTimeout(r, 300));
  fs.writeFileSync(
    path.join(dataDir, "remote-blue.png"),
    (await win.webContents.capturePage()).toPNG(),
  );
  await click("切换明暗主题");
  await check("dark theme uses neutral black surfaces", async () => {
    assert.equal(
      await js(
        `getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`,
      ),
      "#080809",
    );
    assert.equal(
      await js(
        `getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()`,
      ),
      "#141415",
    );
  });
  await new Promise((r) => setTimeout(r, 300));
  fs.writeFileSync(
    path.join(dataDir, "remote-black.png"),
    (await win.webContents.capturePage()).toPNG(),
  );
  await click("切换明暗主题");
  await check(
    "820px and 1280px layouts: all pages in Chinese and English fit horizontally",
    async () => {
      for (const [width, height] of [
        [820, 680],
        [1280, 720],
      ]) {
        win.setContentSize(width, height);
        for (const english of [false, true]) {
          if (english) await click("切换到英文");
          for (const page of [
            "home",
            "orders",
            "sql",
            "convert",
            "images",
            "markdown",
            "snippets",
            "remote",
            "chat",
            "dashboard",
            "history",
            "database",
            "settings",
          ]) {
            await js(
              `(()=>{const b=document.querySelector('[data-page="${page}"]');if(b)b.click();else throw Error('Missing nav '+${JSON.stringify(page)})})()`,
            );
            await new Promise((r) => setTimeout(r, 60));
            if (page === "remote") {
              await js(`document.querySelector('.server-item').click()`);
              await new Promise((r) => setTimeout(r, 60));
            }
            if (width === 820 && !english && page === "remote") {
              fs.writeFileSync(
                path.join(dataDir, "remote-small.png"),
                (await win.webContents.capturePage()).toPNG(),
              );
            }
            const overflow = await js(
              `(()=>{const main=document.querySelector('main');return {scroll:main.scrollWidth,width:main.clientWidth,body:document.body.scrollWidth,viewport:innerWidth}})()`,
            );
            assert(
              overflow.scroll <= overflow.width + 2 &&
                overflow.body <= overflow.viewport + 2,
              `${width}/${english}/${page}: ${JSON.stringify(overflow)}`,
            );
          }
          if (english) await click("Switch to Chinese");
        }
      }
      win.setContentSize(1440, 960);
    },
  );
  await click("工作台");
  await waitHeading("工具就位");
  return async (port) => {
    await click("远程连接");
    await waitHeading("远程连接");
    await js(`document.querySelector('.server-item').click()`);
    await click("编辑");
    await wait(`!!document.querySelector('dialog[open]')`);
    await fill("端口", port);
    await click("保存连接");
    await js(
      `(()=>{const el=document.querySelector('input[type=password]');el.value='synthetic-password';el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await click("连接");
    await wait(
      `!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='断开')`,
    );
    await check(
      "live SSH terminal survives file/dual-panel switches and resize",
      async () => {
        await js(`window.__liveTerminal=document.querySelector('.xterm');true`);
        await click("文件管理");
        await wait(
          `document.querySelector('.sftp-panel').textContent.includes('note.txt')`,
        );
        await click("双面板");
        await click("收起服务器列表");
        await click("终端");
        assert(
          await js(`window.__liveTerminal===document.querySelector('.xterm')`),
        );
        // FitAddon observes the layout asynchronously after switching panels.
        await wait(`document.querySelector('.xterm-screen')?.clientWidth>900`);
        assert(
          await js(`document.querySelector('.xterm-screen').clientWidth>900`),
        );
      },
    );
    await check(
      "live terminal grid fills panel height after connecting and resizing",
      async () => {
        for (const [width, height] of [
          [1440, 960],
          [1280, 720],
        ]) {
          win.setContentSize(width, height);
          await new Promise((r) => setTimeout(r, 250));
          const g = await js(
            `(()=>{const panel=document.querySelector('.terminal-container'),grid=document.querySelector('.xterm-screen');return {container:panel.clientHeight,grid:grid.clientHeight}})()`,
          );
          assert(
            g.grid > 120 &&
              g.container - g.grid >= 20 &&
              g.container - g.grid < 52,
            JSON.stringify(g),
          );
        }
        win.setContentSize(1440, 960);
      },
    );
    await require("./smoke-terminal.cjs").run({
      win,
      js,
      click,
      waitHeading,
      check,
      wait,
    });
    await check(
      "live SSH session stays mounted when another asset tab opens",
      async () => {
        await click("新建连接");
        await wait(`!!document.querySelector('dialog[open]')`);
        await fill("名称", "Second session fixture");
        await fill("主机地址", "127.0.0.1");
        await click("保存连接");
        assert.equal(
          await js(`document.querySelectorAll('.session-tab').length`),
          2,
        );
        assert(await js(`window.__liveTerminal.isConnected`));
        await js(`document.querySelector('.session-tabs [role=tab]').click()`);
        await wait(
          `!!document.querySelector('[role=tabpanel]:not([style*="display: none"]) .xterm')`,
        );
        assert(
          await js(`document.querySelector('.xterm')===window.__liveTerminal`),
        );
      },
    );
    await check(
      "live SSH terminal and SFTP survive switching tools",
      async () => {
        await click("工作台");
        await waitHeading("工具就位");
        await click("远程连接");
        await waitHeading("远程连接");
        assert(
          await js(
            "document.querySelector('.xterm') === window.__liveTerminal",
          ),
        );
        await wait(
          "!![...document.querySelectorAll('button')].find(b => b.textContent.trim() === '断开')",
        );
        await click("文件管理");
        await js(
          `document.querySelector('[role=tabpanel]:not([style*="display: none"]) [aria-label="刷新文件"]').click()`,
        );
        await wait(
          `!document.querySelector('[role=tabpanel]:not([style*="display: none"]) [aria-label="刷新文件"]')?.disabled`,
        );
        await wait(
          "document.querySelector('.sftp-panel').textContent.includes('note.txt')",
        );
      },
    );
    await click("断开");
    await click("工作台");
  };
};
