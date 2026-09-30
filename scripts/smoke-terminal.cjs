const assert = require("node:assert/strict");
const { clipboard } = require("electron");
exports.run = async ({ win, js, click, waitHeading, check, wait }) => {
  const selectError = async () => {
    await wait(
      `!![...document.querySelectorAll('.xterm-rows > div')].find(x=>x.textContent.includes('ERROR fixture'))`,
    );
    await wait(
      `(()=>{const el=[...document.querySelectorAll('.xterm-rows > div')].find(x=>x.textContent.includes('ERROR fixture'));if(!el)return false;const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+14,r.y+r.height/2)?.closest('.xterm-screen')})()`,
    );
    const point = await js(
      `(()=>{const el=[...document.querySelectorAll('.xterm-rows > div')].find(x=>x.textContent.includes('ERROR fixture'));const r=el.getBoundingClientRect();return {x:Math.round(r.x+14),y:Math.round(r.y+r.height/2)}})()`,
    );
    win.webContents.sendInputEvent({
      type: "mouseDown",
      button: "left",
      clickCount: 3,
      ...point,
    });
    win.webContents.sendInputEvent({
      type: "mouseUp",
      button: "left",
      clickCount: 3,
      ...point,
    });
    await wait(
      `!document.querySelector('.terminal-title button[title="AI分析"]')?.disabled && [...document.querySelectorAll('.terminal-title button')].some(x=>x.textContent.includes('AI分析')&&!x.disabled)`,
    );
    await js(
      `(()=>{const el=[...document.querySelectorAll('.terminal-container')].find(x=>x.offsetParent!==null)||document.querySelector('.terminal-container');el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,view:window,clientX:${point.x},clientY:${point.y}}));return !!el})()`,
    );
    await wait(`!!document.querySelector('.terminal-context-menu')`);
  };
  await check(
    "SSH selection round-trips through asynchronous clipboard, guarded paste works and ANSI colors stay distinct",
    async () => {
      const originalRead = clipboard.readText,
        originalWrite = clipboard.writeText;
      let copied = "",
        clipboardFixture = "",
        readBack;
      try {
        clipboard.writeText = async (value) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          copied = value;
          clipboardFixture = value;
        };
        clipboard.readText = async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          readBack = clipboardFixture;
          return clipboardFixture;
        };
        await selectError();
        await js(
          `[...document.querySelectorAll('.terminal-context-menu button')].find(x=>x.textContent.includes('复制选中内容')).click()`,
        );
        await wait(`!document.querySelector('.terminal-context-menu')`);
        for (let i = 0; i < 100 && !copied; i++) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.match(copied, /ERROR fixture/);
        await js(
          "window.__clipboardEcho='';window.__clipboardEchoOff=window.litebox.on('ssh:data',e=>window.__clipboardEcho+=e.data);true",
        );
        await click("粘贴");
        if (/[\r\n\x00-\x08\x0b-\x1f\x7f]/.test(copied)) {
          await wait("!!document.querySelector('dialog[open]')");
          await click("确认粘贴");
        }
        await wait("window.__clipboardEcho.includes('ERROR fixture')");
        assert.equal(
          readBack,
          copied,
          "Paste must read the exact selection just copied",
        );
        clipboardFixture = "PASTE_TOKEN_729";
        await click("粘贴");
        await wait(
          "document.querySelector('.xterm-rows').textContent.includes('PASTE_TOKEN_729')",
        );
        clipboard.readText = async () => "DANGEROUS_TOKEN_729\n";
        await click("粘贴");
        await wait(`!!document.querySelector('dialog[open]')`);
        await click("取消");
        assert.equal(
          await js(
            `document.querySelector('.xterm-rows').textContent.includes('DANGEROUS_TOKEN_729')`,
          ),
          false,
        );
        // NUL text must be confirmed, not rejected by the read IPC or sent to SSH.
        clipboard.readText = async () => "NUL_CANCEL_729\0";
        await click("粘贴");
        await wait(
          "!!document.querySelector('dialog[open]') && document.querySelector('dialog[open]').textContent.includes('隐藏空字符')",
        );
        await click("取消");
        assert.equal(
          await js(
            "document.querySelector('.xterm-rows').textContent.includes('NUL_CANCEL_729')",
          ),
          false,
        );
        clipboard.readText = async () => "NUL_\0OK_729\0";
        await click("粘贴");
        await wait(
          "!!document.querySelector('dialog[open]') && document.querySelector('dialog[open]').textContent.includes('隐藏空字符')",
        );
        await click("确认粘贴");
        await wait(
          "document.querySelector('.xterm-rows').textContent.includes('NUL_OK_729')",
        );
        // Native Ctrl+V/paste events use the same guard as toolbar paste.
        await js(
          "(()=>{const el=[...document.querySelectorAll('.terminal-container')].find(x=>x.offsetParent!==null); const data=new DataTransfer();data.setData('text/plain','EVENT_'+String.fromCharCode(0)+'OK_729');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));})()",
        );
        await wait(
          "!!document.querySelector('dialog[open]') && document.querySelector('dialog[open]').textContent.includes('隐藏空字符')",
        );
        await click("确认粘贴");
        await wait(
          "document.querySelector('.xterm-rows').textContent.includes('EVENT_OK_729')",
        );
        const colors = await js(
          `(()=>{const rows=[...document.querySelectorAll('.xterm-rows > div')];return ['ERROR fixture','OK fixture'].map(t=>{const row=rows.find(x=>x.textContent.includes(t));return getComputedStyle([...row.querySelectorAll('span')].find(x=>x.textContent.includes(t.split(' ')[0]))).color})})()`,
        );
        assert.notEqual(colors[0], colors[1]);
      } finally {
        clipboard.readText = originalRead;
        clipboard.writeText = originalWrite;
        await js(
          "window.__clipboardEchoOff?.();delete window.__clipboardEchoOff;delete window.__clipboardEcho;true",
        );
      }
    },
  );
  await check(
    "SSH context action prepares an AI debug draft without sending or disconnecting",
    async () => {
      await click("AI 助手");
      await waitHeading("AI 助手");
      await click("开启新对话");
      await click("远程连接");
      await waitHeading("远程连接");
      await selectError();
      await click("发送到AI分析（草稿）");
      await waitHeading("AI 助手");
      await wait(
        `document.querySelector('textarea[aria-label="消息内容"]')?.value.includes('ERROR')`,
      );
      assert.equal(
        await js(`!!document.querySelector('[aria-label="停止生成"]')`),
        false,
      );
      assert.equal(
        await js(
          `[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='报错分析')?.getAttribute('aria-pressed')`,
        ),
        "true",
      );
      await click("远程连接");
      await waitHeading("远程连接");
      assert(
        await js(`window.__liveTerminal===document.querySelector('.xterm')`),
      );
    },
  );
};
