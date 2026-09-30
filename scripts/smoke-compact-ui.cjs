const assert = require("node:assert/strict");
exports.run = async ({ win, js, click, check }) => {
  const size = win.getContentSize();
  const frame = () =>
    js("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
  const nav = async (page) => {
    await js(`document.querySelector('[data-page="${page}"]').click()`);
    await frame();
  };
  const pagers = () =>
    js(
      `[...document.querySelectorAll('main .pagination-bar')].map(e=>{const r=e.getBoundingClientRect();const a=e.querySelector('.pagination-actions');const s=e.querySelector('.select-trigger');return {height:r.height,width:r.width,overflow:e.scrollWidth>e.clientWidth+2,actionsOverflow:a.scrollWidth>a.clientWidth+2,selectHeight:s.getBoundingClientRect().height,selectWidth:s.getBoundingClientRect().width,buttons:[...e.querySelectorAll('.pagination-step')].map(b=>({width:b.getBoundingClientRect().width,label:b.getAttribute('aria-label')}))}})`,
    );
  const verify = async (count) => {
    const items = await pagers();
    assert.equal(items.length, count);
    for (const item of items) {
      assert(item.height <= 50, JSON.stringify(item));
      assert(!item.overflow && !item.actionsOverflow, JSON.stringify(item));
      assert(
        item.selectHeight <= 36 && item.selectWidth <= 110,
        JSON.stringify(item),
      );
      assert(
        item.buttons.every((b) => b.width >= 28 && b.width <= 36 && b.label),
        JSON.stringify(item),
      );
    }
  };
  try {
    await check(
      "compact database pagers share a footer, stay one line and keep keyboard page-size selection",
      async () => {
        await nav("database");
        await click("查看示例");
        await frame();
        for (const [width, height] of [
          [1440, 960],
          [980, 740],
          [820, 680],
        ]) {
          win.setContentSize(width, height);
          await frame();
          await verify(2);
          assert(
            await js(
              `!!document.querySelector('.db-explorer > .pagination-bar') && !!document.querySelector('.db-result-footer > .pagination-bar')`,
            ),
          );
          assert(
            await js(
              `(()=>{const p=document.querySelector('.db-result-footer').getBoundingClientRect();const s=document.querySelector('.db-workspace').getBoundingClientRect();return Math.abs(p.bottom-s.bottom)<3})()`,
            ),
          );
        }
        await js(
          `document.querySelector('.db-result-footer [role="combobox"]').focus()`,
        );
        win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Space" });
        win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Space" });
        await frame();
        assert.equal(
          await js(
            `document.querySelector('.db-result-footer [role="combobox"]').getAttribute('aria-expanded')`,
          ),
          "true",
        );
        assert(
          (await js(
            `document.querySelector('.db-result-footer [role="listbox"]').getBoundingClientRect().width`,
          )) <= 140,
        );
        for (const keyCode of ["End", "Enter"]) {
          win.webContents.sendInputEvent({ type: "keyDown", keyCode });
          win.webContents.sendInputEvent({ type: "keyUp", keyCode });
          await frame();
        }
        assert(
          await js(
            `document.querySelector('.db-result-footer [role="combobox"]').textContent.includes('200')`,
          ),
        );
        assert.equal(
          await js(`document.querySelectorAll('.db-grid tbody tr').length`),
          3,
        );
        await click("切换到英文");
        await frame();
        await verify(2);
        await click("Switch to Chinese");
      },
    );
    await check(
      "history uses the same compact paging footer in both languages",
      async () => {
        await nav("history");
        await verify(1);
        await click("切换到英文");
        await frame();
        await verify(1);
        await click("Switch to Chinese");
      },
    );
    await check(
      "chat attachment and knowledge tools sit inside the composer in both themes and locales",
      async () => {
        await nav("chat");
        for (const english of [false, true]) {
          if (english) await click("切换到英文");
          for (const [width, height] of [
            [1440, 960],
            [980, 740],
            [820, 680],
          ]) {
            win.setContentSize(width, height);
            await frame();
            for (let theme = 0; theme < 2; theme++) {
              await click(english ? "Toggle theme" : "切换明暗主题");
              await frame();
              const result = await js(
                `(()=>{const c=document.querySelector('.chat-composer');const tools=c.querySelector('.chat-context-tools');const r=c.getBoundingClientRect();const t=tools.getBoundingClientRect();return {inside:!!tools,height:t.height,contained:t.left>=r.left&&t.right<=r.right&&t.bottom<=r.bottom,overflow:c.scrollWidth>c.clientWidth+2,controlHeights:[...tools.querySelectorAll('button,label')].map(e=>e.getBoundingClientRect().height),named:!!tools.querySelector('button[aria-label][title]')&&!!tools.querySelector('input[aria-label]')}})()`,
              );
              assert(
                result.inside &&
                  result.contained &&
                  !result.overflow &&
                  result.named,
                JSON.stringify(result),
              );
              assert(
                result.controlHeights.every((h) => h >= 32 && h <= 36),
                JSON.stringify(result),
              );
            }
          }
          if (english) await click("Switch to Chinese");
        }
        await js(`document.querySelector('.knowledge-toggle input').click()`);
        await frame();
        assert(
          await js(
            `(()=>{const e=document.querySelector('.knowledge-toggle');return e.classList.contains('active')===e.querySelector('input').checked&&!!e.querySelector('svg.lucide-check-icon')===e.querySelector('input').checked})()`,
          ),
        );
        await js(`document.querySelector('.knowledge-toggle input').click()`);
      },
    );
  } finally {
    win.setContentSize(...size);
    if (
      await js(`!!document.querySelector('[aria-label="Switch to Chinese"]')`)
    )
      await click("Switch to Chinese");
  }
};
