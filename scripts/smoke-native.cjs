"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { dialog, safeStorage, clipboard } = require("electron");
exports.run = async ({ win, app, dataDir, confirmDialog }) => {
  const checks = [];
  const errors = [];
  const originalOpen = dialog.showOpenDialog,
    originalSave = dialog.showSaveDialog;
  let api;
  let ssh;
  const originalMessage = confirmDialog.showMessageBox;
  const js = (s) => win.webContents.executeJavaScript(s, true);
  const invoke = (c, p) =>
    js(`window.litebox.invoke(${JSON.stringify(c)},${JSON.stringify(p)})`);
  const check = (name, fn) =>
    Promise.resolve()
      .then(fn)
      .then(() => checks.push(name));
  try {
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") errors.push(event.message);
    });
    await once(win.webContents, "did-finish-load");
    await js(
      `new Promise(resolve=>{const wait=()=>document.querySelector('main h1')?resolve(true):setTimeout(wait,30);wait()})`,
    );
    await check(
      "startup animation releases interaction and never replays on navigation",
      async () => {
        const opening = await js(
          "!!document.querySelector('.app-shell.app-opening')",
        );
        if (opening) {
          assert.equal(
            await js(
              "document.querySelector('.app-shell').inert || !document.querySelector('.app-shell.app-opening')",
            ),
            true,
          );
          await new Promise((resolve) => setTimeout(resolve, 360));
          fs.writeFileSync(
            path.join(dataDir, "startup-light.png"),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
        await js(`new Promise((resolve, reject) => {
        let attempts = 0;
        const wait = () => !document.querySelector('.startup-screen') ? resolve(true)
          : ++attempts > 150 ? reject(Error('Startup overlay did not exit')) : setTimeout(wait, 30);
        wait();
      })`);
        assert.equal(
          await js("document.querySelector('.app-shell').inert"),
          false,
        );
        assert.equal(
          await js(
            "getComputedStyle(document.querySelector('.app-shell')).visibility",
          ),
          "visible",
        );
      },
    );
    await check("renderer loaded and bridge isolated", async () => {
      assert.equal(await js("typeof window.litebox.invoke"), "function");
      assert.equal(await js("typeof window.require"), "undefined");
      assert.equal(await js("typeof window.process"), "undefined");
    });
    await check("IPC allowlist rejects unknown channels", () =>
      assert.rejects(invoke("untrusted:action"), /Unsupported/),
    );
    await check(
      "clipboard write IPC preserves exact text without browser permission",
      async () => {
        const original = clipboard.writeText;
        const written = [];
        // Exercise real IPC but do not overwrite the user's system clipboard.
        clipboard.writeText = async (text) => {
          written.push(text);
        };
        try {
          const text = "00001|90071992547409931234\n中文😀";
          assert.equal(await invoke("clipboard:write", text), true);
          assert.deepEqual(written, [text]);
          await invoke("clipboard:write", "");
          assert.deepEqual(written, [text, ""]);
          await assert.rejects(
            invoke("clipboard:write", { text: "invalid" }),
            /Invalid/,
          );
          await assert.rejects(
            invoke("clipboard:write", "bad\0text"),
            /Invalid/,
          );
          assert.equal(written.length, 2);
          const originalRead = clipboard.readText;
          clipboard.readText = async () => "mock terminal clipboard";
          try {
            assert.equal(
              await invoke("clipboard:read"),
              "mock terminal clipboard",
            );
          } finally {
            clipboard.readText = originalRead;
          }
        } finally {
          clipboard.writeText = original;
        }
      },
    );
    await check(
      "clipboard read IPC accepts raw NUL for confirmed cleanup and reports size limits clearly",
      async () => {
        const originalRead = clipboard.readText;
        try {
          for (const text of ["", "中文😀\r\ntext", "NULL\0TOKEN\0"]) {
            clipboard.readText = async () => text;
            assert.equal(await invoke("clipboard:read"), text);
          }
          clipboard.readText = async () => "x".repeat(1024 * 1024 + 1);
          await assert.rejects(
            invoke("clipboard:read"),
            /Clipboard text is too long/,
          );
        } finally {
          clipboard.readText = originalRead;
        }
      },
    );
    for (const method of ["readText", "writeText"]) {
      await check(
        "clipboard " + method + " IPC waits for asynchronous native completion",
        async () => {
          const original = clipboard[method];
          let release, started, timer, pending;
          const gate = new Promise((resolve) => {
            release = resolve;
          });
          const entered = new Promise((resolve) => {
            started = resolve;
          });
          const text = "0001 | terminal 中文😀\r\nnext line";
          let settled = false;
          let written;
          clipboard[method] = async (value) => {
            started();
            await gate;
            if (method === "writeText") written = value;
            return method === "readText" ? text : undefined;
          };
          try {
            pending = invoke(
              method === "readText" ? "clipboard:read" : "clipboard:write",
              text,
            ).then(
              (value) => {
                settled = true;
                return { value };
              },
              (error) => {
                settled = true;
                return { error };
              },
            );
            await Promise.race([
              entered,
              new Promise((_, reject) => {
                timer = setTimeout(
                  () => reject(Error("Native clipboard fixture not reached")),
                  5000,
                );
              }),
            ]);
            clearTimeout(timer);
            await new Promise((resolve) => setTimeout(resolve, 60));
            assert.equal(
              settled,
              false,
              "IPC must not succeed before native clipboard completion",
            );
            assert.equal(written, undefined);
            release();
            const result = await pending;
            assert.equal(result.error, undefined);
            assert.equal(result.value, method === "readText" ? text : true);
            if (method === "writeText") assert.equal(written, text);
          } finally {
            clearTimeout(timer);
            release();
            if (pending) await pending;
            clipboard[method] = original;
          }
        },
      );
      await check(
        "clipboard " + method + " IPC propagates asynchronous native failure",
        async () => {
          const original = clipboard[method];
          clipboard[method] = async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            throw Error("ASYNC_CLIPBOARD_FIXTURE_FAILURE");
          };
          try {
            await assert.rejects(
              invoke(
                method === "readText" ? "clipboard:read" : "clipboard:write",
                "fixture",
              ),
              /ASYNC_CLIPBOARD_FIXTURE_FAILURE/,
            );
          } finally {
            clipboard[method] = original;
          }
        },
      );
    }
    await check("native data directory is isolated", async () =>
      assert.equal((await invoke("app:info")).dataDir, dataDir),
    );
    const click = (label) =>
      js(
        `(()=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)}||b.getAttribute('title')===${JSON.stringify(label)});if(!el)throw Error('Button not found: '+${JSON.stringify(label)});el.click();})()`,
      );
    const waitHeading = (text) =>
      js(
        `new Promise((resolve,reject)=>{let n=0;const wait=()=>document.querySelector('main h1')?.textContent.includes(${JSON.stringify(text)})?resolve(true):++n>100?reject(Error('Page timed out')):setTimeout(wait,30);wait()})`,
      );
    if (process.env.LITEBOX_SMOKE_SUITE === "upgrade") {
      await require("./smoke-upgrade.cjs").run({
        win,
        js,
        click,
        waitHeading,
        check,
        dataDir,
      });
      assert.deepEqual(errors, []);
      fs.writeFileSync(
        path.join(dataDir, "result.json"),
        JSON.stringify({ passed: true, checks, errors }, null, 2),
      );
      app.exit(0);
      return;
    }
    await require("./smoke-confirmations.cjs").run({
      win,
      js,
      click,
      check,
      dataDir,
      confirmDialog,
    });
    await require("./smoke-experience.cjs").run({
      confirmDialog,
      win,
      js,
      click,
      waitHeading,
      check,
      dataDir,
    });
    await check("all tool workspaces mount", async () => {
      for (const label of [
        "文本整理",
        "SQL 处理",
        "格式转换",
        "图片工坊",
        "Markdown 文档",
        "常用片段",
        "远程连接",
        "数据库连接",
        "AI 助手",
        "数据看板",
        "历史日志",
        "设置",
      ]) {
        if (label === "设置")
          await js(
            `document.querySelector('.sidebar-bottom button')?.click() || [...document.querySelectorAll('button')].find(b=>b.textContent.includes('设置'))?.click()`,
          );
        else
          await js(
            `[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes(${JSON.stringify(label)})).click()`,
          );
        await waitHeading(label);
        assert.equal(
          await js("!!document.querySelector('.app-shell.app-opening')"),
          false,
        );
      }
    });
    await click("工作台");
    await waitHeading("工具就位");
    await new Promise((r) => setTimeout(r, 500));
    fs.writeFileSync(
      path.join(dataDir, "home-zh.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await check("English and dark theme toggle", async () => {
      await click("切换到英文");
      await click("Toggle theme");
      assert.match(
        await js('document.querySelector("main").textContent'),
        /Everything ready/,
      );
    });
    await new Promise((r) => setTimeout(r, 500));
    fs.writeFileSync(
      path.join(dataDir, "home-en-dark.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await click("Toggle theme");
    await click("Switch to Chinese");
    await require("./smoke-database.cjs").run({
      confirmDialog,
      win,
      js,
      click,
      waitHeading,
      check,
      dataDir,
    });
    await require("./smoke-sql.cjs").run({
      win,
      js,
      click,
      waitHeading,
      check,
      dataDir,
    });
    await require("./smoke-dashboard.cjs").run({
      win,
      js,
      click,
      waitHeading,
      check,
      dataDir,
    });
    await require("./smoke-motion.cjs").run({
      win,
      js,
      click,
      waitHeading,
      check,
    });
    await require("./smoke-images.cjs").run({
      win,
      js,
      click,
      waitHeading,
      check,
      dataDir,
    });
    const verifyLiveRemote = await require("./smoke-ui.cjs").run({
      win,
      js,
      click,
      waitHeading,
      check,
      dataDir,
    });
    const state = await js(
      `new Promise((resolve,reject)=>{let n=0;const wait=async()=>{const s=await window.litebox.invoke('state:load');s?resolve(s):++n>100?reject(Error('State save timeout')):setTimeout(wait,30)};wait()})`,
    );
    assert(state);
    await check("state persistence strips unrecognized secrets", async () => {
      state.order.input = "00001\n90071992547409931234";
      state.unknownSecret = "test";
      await invoke("state:save", state);
      const saved = JSON.parse(
        fs.readFileSync(path.join(dataDir, "state.json"), "utf8"),
      );
      assert.equal(saved.order.input, state.order.input);
      assert.equal(saved.unknownSecret, undefined);
    });
    const file = path.join(dataDir, "fixture.md");
    fs.writeFileSync(file, "# Original");
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    await check("native open and save", async () => {
      const opened = await invoke("file:open", { extensions: ["md"] });
      assert.equal(opened.text, "# Original");
      await invoke("file:save", {
        path: file,
        text: "# Updated",
        name: "fixture.md",
      });
      assert.equal(fs.readFileSync(file, "utf8"), "# Updated");
    });
    await check("external file edits protected", async () => {
      fs.writeFileSync(file, "# External");
      await assert.rejects(
        invoke("file:save", {
          path: file,
          text: "# Overwrite",
          name: "fixture.md",
        }),
        /changed on disk/,
      );
      assert.equal(fs.readFileSync(file, "utf8"), "# External");
    });
    const exported = path.join(dataDir, "export.txt");
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: exported,
    });
    await check("native text export", async () => {
      await invoke("file:export", { filename: "orders.txt", text: "001|002" });
      assert.equal(fs.readFileSync(exported, "utf8"), "001|002");
    });
    api = http.createServer((req, res) => {
      let body = "";
      req.on("data", (b) => (body += b));
      req.on("end", () => {
        assert.equal(JSON.parse(body).model, "local-mock");
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(
          'data: {"choices":[{"delta":{"content":"本地模拟响应"}}]}\n\ndata: [DONE]\n\n',
        );
      });
    });
    await new Promise((r) => api.listen(0, "127.0.0.1", r));
    const config = {
      endpoint: `http://127.0.0.1:${api.address().port}/v1`,
      model: "local-mock",
      system: "",
    };
    await check("AI key uses OS encryption", async () => {
      assert(safeStorage.isEncryptionAvailable());
      await invoke("ai:configure", {
        ...config,
        key: "fake-key-for-local-test",
      });
      const bytes = fs.readFileSync(path.join(dataDir, "ai-key.bin"));
      assert(!bytes.includes("fake-key-for-local-test"));
      assert.equal(safeStorage.decryptString(bytes), "fake-key-for-local-test");
    });
    await check("AI streaming through native IPC", async () => {
      await js(
        `window.__smokeText='';window.__off=window.litebox.on('ai:chunk',e=>window.__smokeText+=e.text);true`,
      );
      await invoke("ai:chat", {
        id: "smoke",
        config,
        messages: [{ role: "user", content: "synthetic test only" }],
        mode: "debug",
        locale: "zh",
      });
      assert.equal(await js("window.__smokeText"), "本地模拟响应");
      await js("window.__off()");
    });
    await check("AI refuses unsaved endpoint changes", () =>
      assert.rejects(
        invoke("ai:chat", {
          id: "bad",
          config: { ...config, model: "different" },
          messages: [{ role: "user", content: "test" }],
        }),
        /settings changed/,
      ),
    );
    await check("invalid RDP host rejected without launching", () =>
      assert.rejects(
        invoke("rdp:connect", {
          id: "bad",
          name: "bad",
          host: "x & calc",
          port: 3389,
          username: "user",
          type: "rdp",
          group: "",
        }),
        /host/i,
      ),
    );
    await check(
      "SSH invalid key path does not wedge subsequent connects",
      async () => {
        const p = {
          server: {
            id: "bad-key",
            name: "local",
            host: "127.0.0.1",
            port: 1,
            username: "test",
            type: "ssh",
            group: "",
          },
          auth: "key",
          keyPath: "not-authorized",
        };
        await assert.rejects(
          invoke("ssh:connect", p),
          /Select the private key/,
        );
        await assert.rejects(
          invoke("ssh:connect", p),
          /Select the private key/,
        );
      },
    );
    ssh = await require("./mock-ssh.cjs").start();
    confirmDialog.showMessageBox = async () => ({ response: 1 });
    await verifyLiveRemote(ssh.port);
    const profile = {
      id: "mock-ssh",
      name: "Local mock",
      host: "127.0.0.1",
      port: ssh.port,
      username: "tester",
      type: "ssh",
      group: "",
    };
    await check(
      "SSH authenticates against local mock and stores host fingerprint",
      async () => {
        await invoke("ssh:connect", {
          server: profile,
          auth: "password",
          password: "synthetic-password",
          cols: 80,
          rows: 24,
          locale: "en",
        });
        assert.match(
          fs.readFileSync(path.join(dataDir, "known-hosts.json"), "utf8"),
          /SHA256:/,
        );
      },
    );
    await check("SSH interactive input and output through IPC", async () => {
      await js(
        `window.__terminal='';window.__termOff=window.litebox.on('ssh:data',e=>window.__terminal+=e.data);true`,
      );
      await invoke("ssh:write", { id: profile.id, data: "test123\n" });
      await js(
        `new Promise((resolve,reject)=>{let n=0;const wait=()=>window.__terminal.includes('test123')?resolve(true):++n>100?reject(Error('Terminal timeout')):setTimeout(wait,30);wait()})`,
      );
      await js("window.__termOff()");
    });
    await check("SFTP list and text read", async () => {
      const listing = await invoke("sftp:list", { id: profile.id, path: "." });
      assert.equal(listing.files[0].filename, "note.txt");
      assert.equal(
        await invoke("sftp:read", { id: profile.id, path: "/note.txt" }),
        "hello from mock SSH",
      );
    });
    await check("SFTP cancel save keeps original", async () => {
      confirmDialog.showMessageBox = async () => ({ response: 0 });
      const result = await invoke("sftp:save", {
        id: profile.id,
        path: "/note.txt",
        text: "changed",
        locale: "en",
      });
      assert.equal(result.saved, false);
      assert.equal(
        ssh.files.get("/note.txt").toString(),
        "hello from mock SSH",
      );
    });
    await check(
      "SFTP rejects unsafe replacement when atomic rename unavailable",
      async () => {
        confirmDialog.showMessageBox = async () => ({ response: 1 });
        await assert.rejects(
          invoke("sftp:save", {
            id: profile.id,
            path: "/note.txt",
            text: "changed",
            locale: "en",
          }),
          /Atomic replacement/,
        );
        assert.equal(
          ssh.files.get("/note.txt").toString(),
          "hello from mock SSH",
        );
      },
    );
    await check("SFTP file download", async () => {
      const target = path.join(dataDir, "ssh-download.txt");
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: target,
      });
      await invoke("sftp:download", {
        id: profile.id,
        path: "/note.txt",
        name: "note.txt",
      });
      assert.equal(fs.readFileSync(target, "utf8"), "hello from mock SSH");
    });
    await check("SFTP upload new file", async () => {
      const source = path.join(dataDir, "upload.txt");
      fs.writeFileSync(source, "uploaded fixture");
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [source],
      });
      await invoke("sftp:upload", { id: profile.id, path: "/", locale: "en" });
      assert.equal(ssh.files.get("/upload.txt").toString(), "uploaded fixture");
    });
    await invoke("ssh:disconnect", profile.id);
    await check(
      "SSH uses OS-encrypted saved password when connect password is blank",
      async () => {
        await invoke("remote:secret-save", {
          server: profile,
          password: "synthetic-password",
        });
        await invoke("ssh:connect", {
          server: profile,
          auth: "password",
          password: "",
          cols: 80,
          rows: 24,
          locale: "en",
        });
        await invoke("ssh:disconnect", profile.id);
        await invoke("remote:secret-forget", profile);
      },
    );
    await check(
      "SSH uses persisted encrypted private key after vault reload",
      async () => {
        const keyProfile = { ...profile, id: "saved-key-fixture", auth: "key" };
        const keyFile = path.join(dataDir, "synthetic-client-key");
        fs.writeFileSync(keyFile, ssh.clientPrivateKey);
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [keyFile],
        });
        assert.equal(await invoke("ssh:pick-key"), keyFile);
        await invoke("remote:secret-save", {
          server: keyProfile,
          keyPath: keyFile,
          passphrase: "",
        });
        const vault =
          require("../electron/remote-secrets.cjs").createRemoteVault(
            dataDir,
            safeStorage,
            new Set(),
          );
        assert.equal(vault.get(keyProfile).privateKey, ssh.clientPrivateKey);
        assert(
          !fs
            .readFileSync(path.join(dataDir, "remote-secrets.json"), "utf8")
            .includes("BEGIN OPENSSH PRIVATE KEY"),
        );
        await invoke("ssh:connect", {
          server: keyProfile,
          auth: "key",
          keyPath: "",
          cols: 80,
          rows: 24,
          locale: "en",
        });
        await invoke("ssh:disconnect", keyProfile.id);
        await invoke("remote:secret-forget", keyProfile);
      },
    );
    ssh.close();
    await require("./smoke-upgrade.cjs").run({
      win,
      js,
      click,
      waitHeading,
      check,
      dataDir,
    });
    await require("./smoke-compact-ui.cjs").run({ win, js, click, check });
    await check("no renderer console errors", () =>
      assert.deepEqual(errors, []),
    );
    fs.writeFileSync(
      path.join(dataDir, "result.json"),
      JSON.stringify({ passed: true, checks, errors }, null, 2),
    );
    fs.copyFileSync(
      path.join(dataDir, "home-zh.png"),
      path.join(app.getAppPath(), "artifacts", "home-zh.png"),
    );
    fs.copyFileSync(
      path.join(dataDir, "home-en-dark.png"),
      path.join(app.getAppPath(), "artifacts", "home-en-dark.png"),
    );
    for (const name of ["remote-blue.png", "remote-black.png"]) {
      fs.copyFileSync(
        path.join(dataDir, name),
        path.join(app.getAppPath(), "artifacts", name),
      );
    }
    app.exit(0);
  } catch (e) {
    fs.writeFileSync(
      path.join(dataDir, "result.json"),
      JSON.stringify(
        { passed: false, checks, error: e.stack, errors },
        null,
        2,
      ),
    );
    console.error(e);
    app.exit(1);
  } finally {
    dialog.showOpenDialog = originalOpen;
    dialog.showSaveDialog = originalSave;
    api?.close();
    ssh?.close();
    confirmDialog.showMessageBox = originalMessage;
  }
};
