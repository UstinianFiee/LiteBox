"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
exports.run = async ({ win, js, click, check, dataDir, confirmDialog }) => {
  const wait = (condition) =>
    js(
      `new Promise((resolve,reject)=>{let n=0;const poll=()=>(${condition})?resolve(true):++n>150?reject(Error('Confirmation timed out')):setTimeout(poll,20);poll()})`,
    );
  const waitOpen = () =>
    wait(`!!document.querySelector('.confirm-dialog[open]')`);
  await check(
    "native history clear uses themed dialog; cancel keeps history",
    async () => {
      const before = await js(`window.litebox.invoke('activity:list')`);
      await js(
        `window.__clearResult=window.litebox.invoke('activity:clear');true`,
      );
      await waitOpen();
      assert.match(
        await js(`document.querySelector('.confirm-dialog').textContent`),
        /清空.*日志/,
      );
      assert(
        await js(`document.activeElement.hasAttribute('data-confirm-cancel')`),
      );
      await js(`document.querySelector('[data-confirm-cancel]').click()`);
      assert.equal(await js(`window.__clearResult`), false);
      assert.deepEqual(
        await js(`window.litebox.invoke('activity:list')`),
        before,
      );
    },
  );
  await check(
    "themed fingerprint details, light/dark, 820px viewport and safe default",
    async () => {
      for (const dark of [false, true]) {
        if (dark) await click("切换明暗主题");
        win.setContentSize(820, 620);
        const detail =
          "127.0.0.1:2222\nSHA256:" +
          "aB0f".repeat(32) +
          "\n请通过可信渠道核对服务器指纹。\n".repeat(12);
        const pending = confirmDialog.showMessageBox(win, {
          title: "核对服务器指纹",
          message: "首次连接：本机测试服务",
          detail,
          buttons: ["取消", "信任并连接"],
        });
        await waitOpen();
        await new Promise((r) => setTimeout(r, 300));
        assert.equal(
          await js(
            `document.querySelector('.confirm-dialog-detail').textContent`,
          ),
          detail,
        );
        const geometry = await js(
          `(()=>{const d=document.querySelector('.confirm-dialog'),f=d.querySelector('.confirm-dialog-footer');const r=d.getBoundingClientRect(),b=f.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,footer:b.bottom,height:innerHeight,width:innerWidth,focus:document.activeElement.hasAttribute('data-confirm-cancel')}})()`,
        );
        assert(geometry.focus);
        assert(
          geometry.top >= 0 &&
            geometry.bottom <= geometry.height + 1 &&
            geometry.right <= geometry.width + 1,
          JSON.stringify(geometry),
        );
        assert(
          geometry.footer <= geometry.height + 1,
          JSON.stringify(geometry),
        );
        fs.writeFileSync(
          path.join(dataDir, `confirm-${dark ? "dark" : "light"}.png`),
          (await win.webContents.capturePage()).toPNG(),
        );
        await js(`document.querySelector('[data-confirm-submit]').click()`);
        assert.equal((await pending).response, 1);
        await wait(`!document.querySelector('.confirm-dialog[open]')`);
      }
      await click("切换明暗主题");
      win.setContentSize(1440, 960);
    },
  );
  await check(
    "changed host key is acknowledge-only and Escape cancels",
    async () => {
      const p = confirmDialog.showMessageBox(win, {
        type: "error",
        title: "主机指纹已变更",
        message: "已阻止连接",
        buttons: ["知道了"],
      });
      await waitOpen();
      assert.equal(
        await js(`!!document.querySelector('[data-confirm-submit]')`),
        false,
      );
      await js(
        `window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
      );
      assert.equal((await p).response, 0);
    },
  );
  await check(
    "queued confirmations refocus cancel and cancelAll dismisses UI",
    async () => {
      const a = confirmDialog.showMessageBox(win, {
        message: "first",
        buttons: ["Cancel", "Continue"],
      });
      const b = confirmDialog.showMessageBox(win, {
        message: "second",
        buttons: ["Cancel", "Continue"],
      });
      await waitOpen();
      await js(`document.querySelector('[data-confirm-submit]').click()`);
      assert.equal((await a).response, 1);
      await wait(
        `document.querySelector('#confirm-dialog-message')?.textContent==='second'`,
      );
      assert(
        await js(`document.activeElement.hasAttribute('data-confirm-cancel')`),
      );
      confirmDialog.cancelAll();
      assert.equal((await b).response, 0);
      await wait(`!document.querySelector('.confirm-dialog[open]')`);
    },
  );
};
