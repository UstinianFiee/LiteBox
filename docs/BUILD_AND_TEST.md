# 轻匣 V1.0 · 浏览器测试与打包操作手册

更新日期：2026-09-29。适用于 Windows x64、当前源码版本 1.0.0。

## 本次交付与清理状态

本次为 **2026-09-29 R2 功能更新**，产品版本仍为 V1.0.0；目标目录为 **release/v1.0.0-20260929-r2/**。EXE、ZIP、SHA256SUMS.txt 的实际验证结果见 [验证记录](TESTING.md)，旧包清理结果见 [清理审计](package-cleanup.md)。历史批次的测试数字、体积与启动时间不代表本次构建。

新版验证完成后才删除旧程序资源。所有 litebox-data、.litebox-data、legacy-data-v1.0.0、未知用户文件和备份保留，不整体删除 release/artifacts。先退出旧版，再打开新版。单文件与解压版都免安装；频繁使用推荐完整解压 ZIP，portable 每次仍需展开。

**当前实际状态：新版已验证；旧包删除被执行策略拦截，实际删除0文件。原有数据、额外备份和旧程序均仍保留；没有绕过限制。**

## 1. 环境与启动浏览器预览

本项目验证环境：Node.js 24.1.0、npm 11.3.0；依赖版本由 package-lock.json 固定。
在源码根目录打开 PowerShell：

```powershell
cd E:\tr\workbuddyProject\DevOps
# 首次拉取源码，或 lockfile 更新后安装；已有依赖无需每次运行
npm ci
npm run dev:web
```

打开 `http://127.0.0.1:5173/`，保持终端运行，修改前端会热更新。按 **Ctrl+C** 停止。
若端口已占用，先打开该地址确认是不是已有预览，不要随意结束其他进程。
不要直接双击 `dist/index.html`；也不要混用 localhost 和 127.0.0.1，两者的浏览器数据不共享。

### 浏览器可以测什么

- 蓝白/黑灰主题、中英切换、菜单收展、统一弹窗、输入框及下拉框。
- 文本整理、SQL 生成、图片压缩转换、Markdown、普通格式转换、片段、日志与看板。
- 远程和数据库**配置界面及布局**，不能据此认为真实连接已通过。
- 浏览器数据与桌面 EXE 旁的 litebox-data 独立。用测试资料，不要导入生产密码/私钥。

### 这次修改的手工回归

1. 切到远程连接，选择一条测试资产，不连接生产服务器。比较资产列表和右侧卡片底部。
2. 检查终端、文件、双面板三种视图，展开/收起资产和主菜单；窗口缩放后终端随可用高度伸展。
3. 建议检查 1440×960、1280×720、820×620；短窗口工作区内部滚动，确保底部控件能滚动到，不压缩字号。
4. 删除测试连接或清空日志时先检查弹窗，再按“取消”或 Escape，数据应保留。只在独立测试数据上确认删除。
5. 两套主题和两种语言均检查；确认框默认焦点在取消，Tab 在弹窗内移动，长详情可滚动和选择。
6. 浏览器开发者工具 Console 不应出现未处理错误。窗口缩放、工具切换不能出现页面横向溢出。

## 2. 未打包桌面测试（真实原生能力）

浏览器不能执行 SSH/SFTP/RDP、真实数据库、系统凭据加密或桌面 AI IPC。
需要人工联调时在源码根目录运行：

```powershell
npm run dev
```

这是开发模式，不生成安装包。开发器使用 5173 端口；若已有独立 Vite 预览占用，先在其终端 Ctrl+C 停止。
自动集成验证用合成密码、本机随机端口的模拟 SSH/SFTP/AI 和临时 SQLite，不连接用户真实服务器：

```powershell
npm test
npm run test:backend
npm run build
npm run test:desktop
```

`build` 只做类型检查和前端静态构建。`test:desktop` 的报告/截图保存在新建的 `artifacts/smoke-*`。
请看 result.json 的 passed/checks/errors；非法参数、未授权文件、拒绝写 SQL 等预期错误日志不等于测试失败。
不要并行运行多个桌面测试实例。系统可能正在扫描刚写入的测试文件；出现 EPERM 时先保留报告排查，不要把失败报告当作通过。

原生回归包括：首次 SSH 指纹确认、指纹变化阻止连接、SFTP 覆盖确认、数据库写入确认、日志清空；确认/取消/关闭/超时；切换功能后原有连接继续可用。仅在本机夹具或用户授权的测试服务上执行。

## 3. 生成 V1.0 免安装发行包

**只有明确要发布时才执行。先保存工作、退出 LiteBox、备份所有用户数据。**
版本来自 package.json，目前保持 1.0.0。普通命令会写入 release/v1.0.0；为了不在验证前覆盖最后一个可用版本，建议先写一个不存在的暂存目录：

```powershell
npm run build
# 上一步成功后继续，失败就停止
npm run licenses
node .\node_modules\electron-builder\cli.js --win portable zip --x64 --config.electronDist=node_modules/electron/dist --config.directories.output=release/v1.0.0-20260929-r2
```

Windows PowerShell 中直接调用 builder 的 JavaScript 入口，避免 npm.ps1 吞掉 `--` 后的输出目录参数。必须检查日志中的 appOutDir 确实指向暂存目录。日期目录仅为本次示例；后续发布选一个新的空暂存目录。以上命令依次 build、生成第三方许可、electron-builder 打包 Windows x64 portable + ZIP。
如果暂存目录已有内容，先检查，不要整目录删除。打包需要足够磁盘空间，并可能下载 Electron/构建工具；不要用关闭安全软件的方式解决问题。

产物：

- `LiteBox-1.0.0-portable.exe`：单文件免安装，每次运行仍需临时展开。
- `LiteBox-1.0.0-x64.zip`：完整解压后运行 LiteBox.exe；日常反复使用推荐这个，不要从压缩软件中直接运行。
- `win-unpacked/`：包内容验证目录；不能只复制里面的 LiteBox.exe，运行需要完整目录。

### 本次启动优化

- 远程/数据库前端按需加载，SSH 驱动首次连接时才加载。
- 开场装饰最短等待从 950ms 减到 320ms，保留减少动画、Esc 和超时保护。
- portable 使用 electron-builder 的 useZip 路径（NSIS zlib 压缩），减少展开开销，代价是单文件体积可能增大。
- 没有关闭沙箱、关闭杀毒或新增绕过校验的长期解压缓存。磁盘、实时扫描和机器负载都会影响启动。

## 4. 包内容与运行验证

```powershell
node scripts/verify-package.mjs release/v1.0.0-20260929-r2/win-unpacked/resources/app.asar
node scripts/verify-database-package.cjs release/v1.0.0-20260929-r2/win-unpacked/LiteBox.exe
```

第一项比较源码/前端构建与 ASAR，排除用户数据；第二项使用包内 Electron 加载数据库/SSH 驱动并验证临时 SQLite 子进程。
还必须将 portable **复制到新的空测试文件夹**，或将 ZIP **完整解压到另一个新测试文件夹**，分别运行：

```powershell
.\scripts\verify-release.ps1 `
  -Executable 'E:\LiteBox-test\portable\LiteBox-1.0.0-portable.exe' `
  -DataDirectory 'E:\LiteBox-test\portable\litebox-data' `
  -Report 'E:\LiteBox-test\portable-result.json'
```

路径只是示例，先创建测试目录、放入被测程序；ZIP 的 Executable 改为其解压目录的 LiteBox.exe。
`DataDirectory` 只校验位置，**不重定向数据目录**。不要指向真实工作数据。
脚本检测标题窗口/响应、正常关闭和状态写盘；默认若用户正在运行 LiteBox 会拒绝测试，不应强杀用户进程。只有新建且尚无 litebox-data 的隔离测试目录，可显式追加 `-AllowConcurrentIsolatedLaunch`；脚本校验数据目录必须在被测 EXE 旁，且仅关闭本次创建的进程。此开关不能用于升级/清理正在运行的旧版。
报告 windowAppearedSeconds 为“启动到首次观察到标题窗口”，含轮询及进程枚举开销，不是精确可交互时间，也不是严格冷启动基准。

## 5. 验证后清理旧程序与生成校验值

1. 新目录发行包全部验证通过后，保留新目录，仅移除已核实的旧 EXE/ZIP 和白名单程序文件；不要覆盖旧数据目录。
2. 清理范围仅限已确认的旧程序文件与测试程序副本。**不得删除整个 release、整个 win-unpacked 或测试目录**，其中可能有用户文件。
3. 永远保留任意位置的 litebox-data、.litebox-data、legacy-data-v1.0.0 和用户文件。记录清理前后数据 SHA-256，并保留原有备份。
4. 已被策略拒绝删除的路径不要换工具绕过。无法清理的项应明确报告。
5. 测试目录下旧 EXE/ZIP 可在核实后删去，合成数据也按本项目约定保留；历史测试报告保留并注明日期。
6. 最终对 **实际交付的** 两个文件重新生成 SHA256SUMS.txt，并同步发布说明与验证记录。

```powershell
$files = @('release/v1.0.0-20260929-r2/LiteBox-1.0.0-portable.exe', 'release/v1.0.0-20260929-r2/LiteBox-1.0.0-x64.zip')
$lines = foreach ($file in $files) {
  $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower()
  "$hash  $(Split-Path -Leaf $file)"
}
$lines | Set-Content -Encoding ascii release/v1.0.0-20260929-r2/SHA256SUMS.txt
```

## 6. 发布与已知限制

版本号按本次要求仍为 V1.0.0，2026-09-29 是重新构建日期。若 1.0.0 已公开发布，**不要静默改写已有 Git 标签和校验值**；优先新版本号，或清楚标注重建批次与新摘要，再由维护者决定发布。
参见 [GitHub 指南](GITHUB_GUIDE.md)、[验证记录](TESTING.md)、[发布说明](RELEASE_v1.0.0.md)、[数据保留/清理记录](package-cleanup.md)。

业务确认使用应用主题弹窗。原生打开/保存文件选择器以及界面加载失败前的致命启动错误提示仍由系统显示，这是有意保留的可访问性/安全降级。
正式包目前未代码签名。已验证的本机模拟不代表所有真实数据库版本、RDP 策略、外部 AI 服务商、机器性能都通过生产验证。

## English quick start

Use `npm ci` once, then `npm run dev:web` and open `http://127.0.0.1:5173/`. Ctrl+C stops preview. Browser storage is separate from desktop data; SSH, databases, native credentials and AI requests require Electron.
Run `npm test`, `npm run test:backend`, `npm run build`, then `npm run test:desktop` before an authorized build. Build into a new staging directory, verify ASAR/drivers and launch isolated EXE/ZIP copies, then promote only verified program assets. Never delete user-data directories. Prefer extracted ZIP for repeated daily launches; portable EXE still extracts per run. Verify final SHA-256 values and do not silently replace a published Git tag.

## 7. R2 新功能回归

参见 [本次功能与数据迁移说明](UPGRADE_20260929.md)。检查数据库对象与记录跨页、上一页返回、修改查询重置、长文本无省略、分隔条拖动/键盘调整；SSH 选中复制、安全粘贴、右键仅填入 AI 草稿；附件发送前确认、知识检索默认关闭和逐条选择；日志筛选后分页重置；横幅暂停/继续和切换恢复。

`npm run test:desktop` 已包含这些隔离回归。排查这组检查时，构建后可用：

```powershell
$env:LITEBOX_SMOKE_SUITE = 'upgrade'
npm run test:desktop
Remove-Item Env:LITEBOX_SMOKE_SUITE
```

该聚焦测试不替代全量桌面测试；终端右键/粘贴在全量 SSH 集成中验证。不要同时运行多个桌面测试。
