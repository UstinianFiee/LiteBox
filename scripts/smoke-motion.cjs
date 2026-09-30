const assert = require("node:assert/strict");

// Runs only in the existing isolated Electron smoke profile, never user data.
exports.run = async ({ win, js, click, waitHeading, check }) => {
  const debug = win.webContents.debugger;
  debug.attach("1.3");
  try {
    // The smoke window is offscreen: emulate active focus without showing it.
    await debug.sendCommand("Emulation.setFocusEmulationEnabled", {
      enabled: true,
    });
    const wait = (condition) =>
      js(`new Promise((resolve,reject)=>{
    let n=0; const poll=()=>(${condition})?resolve(true):++n>100?reject(Error('Motion check timed out: '+${JSON.stringify(condition)}+'; active='+document.activeElement?.outerHTML+'; background='+getComputedStyle(document.activeElement).backgroundSize)):setTimeout(poll,20);poll();
  })`);
    await js(`document.querySelector('[data-page="settings"]').click()`);
    await waitHeading("设置");
    await check(
      "text/password inputs use an animated underline without shifting layout",
      async () => {
        for (const selector of [
          'main input[type="password"]',
          "main input:not([type])",
        ]) {
          const q = JSON.stringify(selector);
          const before = await js(
            `(()=>{const e=document.querySelector(${q}),s=getComputedStyle(e),r=e.getBoundingClientRect();e.focus();return {height:r.height,top:s.borderTopWidth,left:s.borderLeftWidth,bottom:s.borderBottomWidth}})()`,
          );
          assert.equal(before.top, "0px");
          assert.equal(before.left, "0px");
          assert.equal(before.bottom, "1px");
          assert(before.height >= 44);
          await wait(
            `getComputedStyle(document.querySelector(${q})).backgroundSize==='100% 3px'`,
          );
          assert.equal(
            await js(
              `document.querySelector(${q}).getBoundingClientRect().height`,
            ),
            before.height,
          );
          await js(`document.querySelector(${q}).blur()`);
          await wait(
            `getComputedStyle(document.querySelector(${q})).backgroundSize==='0% 3px'`,
          );
        }
      },
    );
    await check(
      "composite searches and AI composer have one focus underline",
      async () => {
        await js(`document.querySelector('.search-wrap input').focus()`);
        await wait(
          `getComputedStyle(document.querySelector('.search-wrap'),'::after').transform==='matrix(1, 0, 0, 1, 0, 0)'`,
        );
        assert.equal(
          await js(
            `getComputedStyle(document.querySelector('.search-wrap input')).borderBottomWidth`,
          ),
          "0px",
        );
        await click("AI 助手");
        await waitHeading("AI 助手");
        await js(`document.querySelector('.chat-composer textarea').focus()`);
        await wait(
          `getComputedStyle(document.querySelector('.chat-composer'),'::after').transform==='matrix(1, 0, 0, 1, 0, 0)'`,
        );
        assert.equal(
          await js(
            `getComputedStyle(document.querySelector('.chat-composer')).boxShadow`,
          ),
          "none",
        );
      },
    );
    await check(
      "reduced-motion disables effects but keeps keyboard focus visible",
      async () => {
        try {
          await debug.sendCommand("Emulation.setEmulatedMedia", {
            features: [{ name: "prefers-reduced-motion", value: "reduce" }],
          });
          assert.equal(
            await js(`matchMedia('(prefers-reduced-motion: reduce)').matches`),
            true,
          );
          await js(
            `document.querySelector('.chat-history-search input').focus()`,
          );
          const style = await js(
            `(()=>{const s=getComputedStyle(document.querySelector('.chat-history-search'),'::after');return {duration:s.transitionDuration,line:s.transform,page:getComputedStyle(document.querySelector('main > .page')).animationName}})()`,
          );
          assert.equal(style.duration, "0s");
          assert.equal(style.line, "matrix(1, 0, 0, 1, 0, 0)");
          assert.equal(style.page, "none");
        } finally {
          await debug.sendCommand("Emulation.setEmulatedMedia", {
            features: [],
          });
        }
      },
    );
    await click("工作台");
    await waitHeading("工具就位");
  } finally {
    await debug.sendCommand("Emulation.setFocusEmulationEnabled", {
      enabled: false,
    });
    debug.detach();
  }
};
