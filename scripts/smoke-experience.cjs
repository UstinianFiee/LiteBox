const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { safeStorage, dialog } = require("electron");
exports.run = async ({ win, js, click, waitHeading, check, dataDir, confirmDialog }) => {
  const invoke = (c, p) =>
    js(`window.litebox.invoke(${JSON.stringify(c)},${JSON.stringify(p)})`);
  const wait = (c) =>
    js(
      `new Promise((resolve,reject)=>{let n=0;const poll=()=>(${c})?resolve(true):++n>150?reject(Error('Experience UI timeout')):setTimeout(poll,20);poll()})`,
    );
  await check(
    "sidebar defaults collapsed and explicit expansion survives navigation",
    async () => {
      assert(
        await js(
          `document.querySelector('.app-shell').classList.contains('collapsed')`,
        ),
      );
      await click("展开菜单");
      await click("历史日志");
      await waitHeading("历史日志");
      assert.equal(
        await js(
          `document.querySelector('.app-shell').classList.contains('collapsed')`,
        ),
        false,
      );
      await click("收起菜单");
    },
  );
  await check(
    "bilingual wisdom supports next and pause; dashboard has real activity and Escape exit",
    async () => {
      await click("工作台");
      await waitHeading("工具就位");
      const before = await js(
        `document.querySelector('.quote-zh').textContent`,
      );
      await click("下一句");
      await wait(
        `document.querySelector('.quote-zh')?.textContent!==${JSON.stringify(before)}`,
      );
      assert(await js(`!!document.querySelector('.quote-en').textContent`));
      await click("暂停轮播");
      assert.equal(
        await js(
          `document.querySelector('[aria-label="继续轮播"]').getAttribute('aria-pressed')`,
        ),
        "true",
      );
      await click("数据看板");
      await waitHeading("数据看板");
      const events = (await invoke("activity:list")).records.filter(
        (r) => !["visit", "start"].includes(r.action),
      );
      assert.equal(
        await js(
          `Number(document.querySelectorAll('.activity-kpis strong')[1].textContent)`,
        ),
        events.length,
      );
      await click("大屏模式");
      assert(await js(`!!document.querySelector('.dashboard-immersive')`));
      await js(
        `window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`,
      );
      await wait(`!document.querySelector('.dashboard-immersive')`);
      fs.writeFileSync(
        path.join(dataDir, "activity-dashboard.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
    },
  );
  await check(
    "AI redesigned composer handles IME, history toggle and a short viewport",
    async () => {
      await click("AI 助手");
      await waitHeading("AI 助手");
      await js(
        `(()=>{const e=document.querySelector('.chat-composer textarea');e.value='synthetic IME';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));})()`,
      );
      assert.equal(
        await js(`document.querySelector('.chat-composer textarea').value`),
        "synthetic IME",
      );
      await click("收起会话列表");
      assert(await js(`!!document.querySelector('.history-hidden')`));
      await click("展开会话列表");
      const size = win.getSize();
      win.setSize(820, 680);
      await new Promise((r) => setTimeout(r, 120));
      assert(
        await js(
          `(()=>{const a=document.querySelector('.chat-composer').getBoundingClientRect(),b=document.querySelector('main').getBoundingClientRect();return a.bottom<=b.bottom && a.right<=b.right;})()`,
        ),
      );
      fs.writeFileSync(
        path.join(dataDir, "chat-small.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      win.setSize(...size);
    },
  );
  await check(
    "private-key dialog scrolls only its body with pinned title/actions across locales and zoom",
    async () => {
      const originalSize = win.getSize();
      const originalZoom = win.webContents.getZoomFactor();
      await click("远程连接");
      await waitHeading("远程连接");
      try {
        for (const english of [false, true]) {
          if (english) {
            await click("切换到英文");
            await click("Toggle theme");
          }
          for (const [width, height, zoom] of [
            [1380, 950, 1],
            [820, 680, 1],
            [1024, 768, 1.25],
          ]) {
            win.setSize(width, height);
            win.webContents.setZoomFactor(zoom);
            await new Promise((r) => setTimeout(r, 100));
            await click(english ? "New connection" : "新建连接");
            await wait(
              "!!document.querySelector('.remote-profile-dialog[open]')",
            );
            await js(
              `(()=>{const e=document.querySelector('.credential-section [role="combobox"]');e.focus();e.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));})()`,
            );
            await wait("!!document.querySelector('[role=option]')");
            await js(
              `[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.trim()===${JSON.stringify(english ? "Private key" : "私钥")}).click()`,
            );
            await wait("!!document.querySelector('.remote-key-picker')");
            // Synthetic long filename exercises wrapping without reading any real key.
            const oldPickerText = await js(
              "document.querySelector('.remote-key-picker').textContent",
            );
            await js(
              "document.querySelector('.remote-key-picker').textContent='synthetic-long-key-name-'.repeat(14)+'.pem'",
            );
            for (const end of [false, true]) {
              await js(
                `(()=>{const s=document.querySelector('.remote-form-scroll');s.scrollTop=${end ? "s.scrollHeight" : "0"};})()`,
              );
              const bounds = await js(`(()=>{
                const d=document.querySelector('.remote-profile-dialog');
                const r=d.getBoundingClientRect(),h=d.querySelector('.remote-profile-header').getBoundingClientRect();
                const body=d.querySelector('.remote-form-scroll'),b=body.getBoundingClientRect(),f=d.querySelector('.modal-footer').getBoundingClientRect();
                const hint=d.querySelector('.credential-section > .hint').getBoundingClientRect();
                return {inViewport:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,
                  pinned:h.top>=r.top&&h.bottom<=b.top+1&&b.bottom<=f.top+1&&f.bottom<=r.bottom,
                  outerOverflow:d.scrollHeight-d.clientHeight,horizontal:body.scrollWidth-body.clientWidth,
                  canScroll:body.scrollHeight>body.clientHeight,hintReachable:hint.bottom<=f.top+1};
              })()`);
              assert(
                bounds.inViewport && bounds.pinned,
                JSON.stringify(bounds),
              );
              assert(
                bounds.outerOverflow <= 1 && bounds.horizontal <= 1,
                JSON.stringify(bounds),
              );
              assert(bounds.canScroll);
              if (end) assert(bounds.hintReachable, JSON.stringify(bounds));
            }
            await js(
              `document.querySelector('.remote-key-picker').textContent=${JSON.stringify(oldPickerText)}`,
            );
            fs.writeFileSync(
              path.join(
                dataDir,
                "remote-key-" +
                  (english ? "en-dark" : "zh-light") +
                  "-" +
                  width +
                  "-" +
                  zoom +
                  ".png",
              ),
              (await win.webContents.capturePage()).toPNG(),
            );
            await click(english ? "Cancel" : "取消");
            await wait("!document.querySelector('.remote-profile-dialog')");
          }
          if (english) {
            await click("Toggle theme");
            await click("Switch to Chinese");
          }
        }
      } finally {
        win.webContents.setZoomFactor(originalZoom);
        win.setSize(...originalSize);
      }
    },
  );
  await check(
    "native remote vault survives recreation using OS encryption without plaintext",
    async () => {
      const profile = {
        id: "vault-fixture",
        name: "fixture",
        host: "127.0.0.1",
        port: 22,
        username: "tester",
        type: "ssh",
        auth: "password",
      };
      await invoke("remote:secret-save", {
        server: profile,
        password: "synthetic-persisted-secret",
      });
      assert.equal(await invoke("remote:secret-status", profile), true);
      const vault = require("../electron/remote-secrets.cjs").createRemoteVault(
        dataDir,
        safeStorage,
        new Set(),
      );
      assert.equal(vault.get(profile).password, "synthetic-persisted-secret");
      assert(
        !fs
          .readFileSync(path.join(dataDir, "remote-secrets.json"), "utf8")
          .includes("synthetic-persisted-secret"),
      );
      await invoke("remote:secret-forget", profile);
      assert.equal(await invoke("remote:secret-status", profile), false);
    },
  );
  await check(
    "RDP password blob round-trips Windows DPAPI without plaintext arguments",
    async () => {
      const { spawnSync } = require("node:child_process");
      const secret = "synthetic-RDP-中文-09";
      const encrypted =
        await require("../electron/rdp-secret.cjs").protectRdpPassword(secret);
      const script =
        "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $s=[Console]::In.ReadToEnd(); $b=New-Object byte[] ($s.Length/2); for($i=0;$i -lt $b.Length;$i++){$b[$i]=[Convert]::ToByte($s.Substring($i*2,2),16)}; $v=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($v))";
      const result = spawnSync(
        path.join(
          process.env.SystemRoot,
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        ),
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(script, "utf16le").toString("base64"),
        ],
        {
          input: encrypted,
          encoding: "utf8",
          windowsHide: true,
          timeout: 15000,
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        Buffer.from(result.stdout, "base64").toString("utf16le"),
        secret,
      );
    },
  );
  await check(
    "activity IPC records only metadata and cancelled clear preserves history",
    async () => {
      const entry = await invoke("activity:add", {
        module: "orders",
        action: "run",
        status: "success",
        password: "MUST-NOT-LOG",
        text: "MUST-NOT-LOG",
      });
      assert.deepEqual(Object.keys(entry).sort(), [
        "action",
        "at",
        "id",
        "module",
        "status",
      ]);
      const count = (await invoke("activity:list")).records.length;
      const old = confirmDialog.showMessageBox;
      try {
        confirmDialog.showMessageBox = async () => ({ response: 0 });
        assert.equal(await invoke("activity:clear"), false);
      } finally {
        confirmDialog.showMessageBox = old;
      }
      assert.equal((await invoke("activity:list")).records.length, count);
      assert(
        !fs
          .readFileSync(path.join(dataDir, "activity-log.json"), "utf8")
          .includes("MUST-NOT-LOG"),
      );
    },
  );
  await click("工作台");
  await waitHeading("工具就位");
};
