const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { dialog } = require("electron");
exports.run = async ({ win, js, click, waitHeading, check, dataDir }) => {
  const originalSave = dialog.showSaveDialog,
    originalOpen = dialog.showOpenDialog;
  const wait = (condition) =>
    js(
      `new Promise((resolve,reject)=>{let n=0;const poll=()=>(${condition})?resolve(true):++n>150?reject(Error('Dashboard wait failed')):setTimeout(poll,20);poll()})`,
    );
  const waitFile = async (file) => {
    for (
      let i = 0;
      i < 100 && (!fs.existsSync(file) || fs.statSync(file).size === 0);
      i++
    )
      await new Promise((r) => setTimeout(r, 20));
    assert(fs.existsSync(file));
  };
  const shot = async (name) => {
    await new Promise((r) => setTimeout(r, 350));
    fs.writeFileSync(
      path.join(dataDir, name),
      (await win.webContents.capturePage()).toPNG(),
    );
  };
  try {
    await click("数据看板");
    await waitHeading("数据看板");
    await click("CSV 数据分析");
    await wait(`!!document.querySelector(".dashboard-empty")`);
    await check(
      "CSV upload action icon inherits high-contrast label color in both themes",
      async () => {
        for (const dark of [false, true]) {
          if (dark) await click("切换明暗主题");
          await new Promise((r) => setTimeout(r, 250));
          const actual = await js(
            `(()=>{const b=document.querySelector('.dashboard-empty .button.primary'),s=b.querySelector('svg');return {button:getComputedStyle(b).color,icon:getComputedStyle(s).color,opacity:getComputedStyle(s).opacity,size:s.getBoundingClientRect().width}})()`,
          );
          assert.equal(actual.icon, actual.button);
          assert.equal(actual.opacity, "1");
          assert(actual.size >= 20);
        }
        await shot("dashboard-template-dark.png");
        await click("切换明暗主题");
      },
    );
    await shot("dashboard-template.png");
    await check(
      "CSV template is downloadable UTF-8 BOM with headers and three example rows",
      async () => {
        const file = path.join(dataDir, "dashboard-template-zh.csv");
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: file,
        });
        await click("下载 CSV 模板");
        await waitFile(file);
        const bytes = fs.readFileSync(file);
        assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
        assert.equal(
          bytes.toString("utf8"),
          "\uFEFF日期,订单数\r\n2026-09-01,120\r\n2026-09-02,156\r\n2026-09-03,98",
        );
        assert(await js(`!!document.querySelector('.dashboard-empty')`));
        assert(await js(`document.querySelector('.csv-guide').open`));
      },
    );
    await check("English CSV template and guidance are localized", async () => {
      await click("切换到英文");
      const file = path.join(dataDir, "dashboard-template-en.csv");
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      await click("Download CSV template");
      await waitFile(file);
      assert(fs.readFileSync(file, "utf8").startsWith("\uFEFFdate,orders\r\n"));
      assert.match(
        await js(`document.querySelector('.csv-guide').textContent`),
        /CSV UTF-8/,
      );
      await click("Switch to Chinese");
    });
    await check(
      "downloaded CSV round-trips through native import and sums to 374",
      async () => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [path.join(dataDir, "dashboard-template-zh.csv")],
        });
        await click("选择 CSV 文件");
        await wait(`!!document.querySelector('.metric-grid')`);
        assert.equal(
          await js(
            `document.querySelectorAll('.metric-card strong')[0].textContent.trim()`,
          ),
          "3",
        );
        assert.equal(
          await js(
            `document.querySelectorAll('.metric-card strong')[1].textContent.trim()`,
          ),
          "374",
        );
        assert.match(
          await js(
            `document.querySelector('[aria-label="分类维度"]').textContent`,
          ),
          /日期/,
        );
        assert.match(
          await js(
            `document.querySelector('[aria-label="数值指标"]').textContent`,
          ),
          /订单数/,
        );
        assert(await js(`!!document.querySelector('.chart-canvas canvas')`));
        win.setContentSize(820, 680);
        await click("切换到英文");
        await new Promise((r) => setTimeout(r, 150));
        assert(
          await js(
            `document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth+2`,
          ),
        );
        await click("Switch to Chinese");
        win.setContentSize(1380, 950);
      },
    );
    await check(
      "canceling template save preserves existing imported dashboard",
      async () => {
        dialog.showSaveDialog = async () => ({ canceled: true });
        await click("下载 CSV 模板");
        await new Promise((r) => setTimeout(r, 150));
        assert.equal(
          await js(
            `document.querySelectorAll('.metric-card strong')[1].textContent.trim()`,
          ),
          "374",
        );
      },
    );
    await click("清除数据");
    await click("工作台");
    for (const name of [
      "dashboard-template.png",
      "dashboard-template-dark.png",
    ])
      fs.copyFileSync(path.join(dataDir, name), path.join("artifacts", name));
  } finally {
    dialog.showSaveDialog = originalSave;
    dialog.showOpenDialog = originalOpen;
  }
};
