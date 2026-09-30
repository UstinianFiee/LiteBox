# 历史开发验证记录（归档）

此文件是 v1.0.0 定稿前的历史记录，不代表当前版本状态。文中旧发布路径和检查副本可能已清理；当前正式版验证请看 [TESTING.md](TESTING.md)。

# 验证记录 / Verification report

版本：0.1.2。验证日期：2026-09-24。环境：Windows 11 x64（10.0.22621），Node.js 24.1.0，Electron 44.4.5。

这是一版可运行的个人工具箱原型，不是经过长期生产环境验证的运维平台。

## 自动化验证

| 检查                                              | 结果           | 内容                                                                                            |
| ------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| `npm run build`                                   | 通过           | Vue / TypeScript 类型检查，Vite 生产构建                                                        |
| `npm test`                                        | 24 / 24        | 订单号前导零和大整数、混合分隔符、去重、按数量/组数分组、集合比较、转换及错误输入               |
| `npm run test:backend`                            | 11 / 11        | 接口 URL 与主机校验、状态清理、原子本地状态存储、双语提示词、SSE 分片/UTF-8/CRLF/异常处理       |
| `npm run test:desktop`                            | 34 / 34        | 实际 Electron 渲染器、preload 与 IPC、本地文件读写、操作系统密钥加密、本机 AI / SSH / SFTP 集成 |
| `npm audit --registry=https://registry.npmjs.org` | 0 条已报告漏洞 | 对当前完整锁文件执行，包含开发和前端打包依赖；不代表不存在未知漏洞                              |

桌面集成测试会刻意触发文件冲突、未保存 AI 配置、非法 RDP 主机、未授权私钥路径、不支持原子重命名等拒绝操作。因此终端中有预期的错误消息；以最终 `passed: true`、`errors: []` 为判断依据。

## 桌面集成的 34 项检查

1. 渲染器加载，Node 与桥接上下文隔离。
2. IPC 白名单拒绝未知通道。
3. 测试数据目录与实际用户数据隔离。
4. 八个功能工作区均可挂载。
5. 英文与深色主题切换。
6. 状态持久化移除未知/敏感字段。
7. 本地文件原生打开和保存。
8. 外部修改后拒绝直接覆盖。
9. 本地文本导出。
10. API Key 使用 Windows 系统加密。
11. 本机模拟 AI 服务经原生 IPC 流式响应。
12. 拒绝使用未保存的新接口配置发送请求。
13. 非法 RDP 主机在启动远程桌面前被拒绝。
14. 不合法的私钥路径不会导致后续 SSH 连接卡死。
15. SSH 对本机模拟服务器认证并保存主机指纹。
16. SSH 终端经 IPC 收发文本。
17. SFTP 列表和文本读取。
18. 取消保存保留原内容。
19. 不支持原子重命名时拒绝不安全覆盖。
20. SFTP 下载。
21. SFTP 上传新文件。
22. 没有渲染器控制台错误。

另外增加 7 项 UI 回归检查：

23. 蓝白主题、正文 16px、下拉控件高度至少 44px。
24. 统一下拉框的键盘选择和 Escape 关闭。
25. 弹窗内下拉框；切换 RDP / SSH 同步端口默认值。
26. 远程默认大终端、布局切换保留节点、服务器列表可收起。
27. 深色主题使用中性黑灰背景与面板。
28. 820×680 和 1280×720 窗口下，九个页面的中英文布局没有页面级横向溢出；远程页含选中服务器。
29. 真实 xterm 连接本机模拟 SSH 后，切换文件 / 双面板 / 终端以及收起列表，不重建终端节点，文件列表正常显示。

0.1.2 新增 5 项数据看板回归检查：

30. 浅色与深色下，上传图标继承按钮文字颜色，不透明度为 1，尺寸至少 20px。
31. 实际通过原生保存对话框导出 CSV 模板，验证 UTF-8 BOM、中文表头与三行示例数据；下载不自动载入示例。
32. 英文模式下载英文表头模板，填写说明同步翻译。
33. 下载的中文模板经原生文件打开流程重新导入，正确识别分类与数值字段，显示 3 行、总计 374，生成图表。
34. 取消模板保存不会改变已导入的数据。

截图：`artifacts/dashboard-template.png`、`artifacts/dashboard-template-dark.png`。

以上编号是检查项目说明，实际执行顺序见 `artifacts/smoke-*/result.json`。

模拟 SSH 服务器绑定 127.0.0.1 随机端口，使用临时生成的 Ed25519 主机密钥和合成密码；AI 模拟服务也仅监听本机。测试没有连接用户服务器，也没有消耗真实模型额度。

## 界面检查

通过本机浏览器预览和 Electron 截图进行检查：

- 中文浅色与英文深色工作台，导航、收藏、工具卡片与窗口布局。
- 订单号 `00001` 与 `90071992547409931234` 等输入按组正确输出，不丢前导零和精度。
- Markdown 对脚本/事件属性进行清理，预览无脚本执行。
- CSV 样本 A=120、B=80、A=30：导入 3 行，总计 230，图表按 A=150 / B=80 聚合。
- 820 × 680 小窗口无横向页面溢出。
- 截图保存在 `artifacts/home-zh.png` 和 `artifacts/home-en-dark.png`，以及 `artifacts/remote-blue.png`、`artifacts/remote-black.png`、`artifacts/remote-small.png`（不随发行包分发）。

## 仍需要真实环境验证

- Windows RDP：验证了输入安全边界，未用真实远程 Windows 主机完成登录。
- Linux SSH/SFTP：本机协议集成通过；不同服务器、算法策略、密钥类型、跳板机、网络中断和真实文件权限需要另行验证。本版无跳板机 UI。
- SFTP 编辑：验证了读取、取消、无原子扩展时安全拒绝；尚未用真实 OpenSSH 服务器验证成功覆盖已有文件以及属组/ACL 差异。
- AI：本机模拟流式协议通过，未验证用户具体服务商、模型可用性、账单或限流行为。
- 未做长期运行、大规模文件/数据压力、Windows 10、ARM、安装路径极端情况、杀毒兼容性或外部安全审计。
- 本版未签名，系统可能提示未知发布者。没有通过关闭系统防护来验证运行。

发行包启动验证与体积记录附在下方；文件校验见 `release/SHA256SUMS.txt`。

## 发行包验证（v0.1.1）

- `release/v0.1.1/win-unpacked/LiteBox.exe`：实际隐藏启动，渲染器标题变为「工作台 · LiteBox」，保持响应，正常关闭，成功持久化状态；报告 `artifacts/release-0.1.1-unpacked.json`。
- `release/LiteBox-0.1.1-portable.exe`：复制到隔离测试目录后实际启动、正常关闭；数据写在便携 exe 旁而非临时解包目录。报告 `artifacts/release-0.1.1-portable.json`。没有启动或关闭用户的旧版应用，也没有操作旧版数据。
- `node scripts/verify-package.mjs`：32 个源码、前端产物和资源文件与 `app.asar` 逐字节一致，版本 0.1.1；未打入测试脚本或个人数据。
- ZIP CRC 全部通过，ZIP 内 `app.asar` 与解压版一致，无 `litebox-data`；报告 `artifacts/release-0.1.1-zip.json`。
- 旧版 `release/win-unpacked` 及原有数据保留不动。新版解压目录为 `release/v0.1.1/win-unpacked`。测试生成的数据仅位于新版/隔离测试目录，不在发行压缩包内。

| 文件                         |      字节数 |       体积 |
| ---------------------------- | ----------: | ---------: |
| `LiteBox-0.1.1-portable.exe` | 102,044,810 |  97.32 MiB |
| `LiteBox-0.1.1-x64.zip`      | 142,058,677 | 135.48 MiB |
| ZIP 解压内容（无用户数据）   | 338,689,275 | 323.00 MiB |

SHA-256：

```text
06757422b9cb124f774c02c44bf263247c1a2587900c279b26499ab73249a450  LiteBox-0.1.1-portable.exe
92cf881c7e7f8b5b099f823b0ac6aa5cbfb5ec9dba7737619f47c599fc0fba09  LiteBox-0.1.1-x64.zip
```

完整校验列表见 `release/SHA256SUMS.txt`。`artifacts` 下的模拟测试数据和实际运行产生的 `litebox-data` 不属于可分享发行文件。

## 发行包验证（v0.1.2）

- `node scripts/verify-package.mjs`：32 个源码、前端产物和资源文件与 `app.asar` 一致，包内版本为 0.1.2，未包含测试代码和用户数据。
- ZIP CRC 检查通过，内含 `app.asar` 与解压版相同，不含 `litebox-data`。报告：`artifacts/release-0.1.2-zip.json`。
- 桌面集成测试为实际 Electron 运行，共 34 项通过，渲染器错误列表为空。模板下载、重新导入、取消保存、两种主题的图标颜色、中英文与小窗口布局均已验证。
- 本次未另行启动发行包：用户正在使用 0.1.1 解压版，保留该进程与数据，没有为发行检查强制关闭应用。上节的发行包启动记录仅属于 0.1.1。
- 新版位于 `release/LiteBox-0.1.2-portable.exe`、`release/LiteBox-0.1.2-x64.zip`。SHA-256 见 `release/SHA256SUMS.txt`。
- 应用原生导出的中英文模板也已放到 `release/LiteBox-dashboard-template-zh.csv`、`release/LiteBox-dashboard-template-en.csv`，用于直接试用。


## 数据库工作台开发版升级（2026-09-28，未打包）

本节是当前源码验证，不改变上方历史发行包的验证范围。

- `npm test`：80 项通过；`npm run test:backend`：26 项通过。
- `npm run test:desktop`：50 项通过，报告 `artifacts/smoke-G959xH/result.json`，渲染器错误为空。
- 新增真实 SQLite CRUD、写入原生确认与取消、空过滤拒绝、两种结果复制、导入只预览不自动执行、操作系统加密密码存储验证。
- Oracle Thin、MongoDB、Redis 驱动在 Electron 内实际加载；新适配器有模拟驱动契约测试，尚无真实服务端联调。
- 远程终端布局测试等待 FitAddon 异步调整完成后再检查宽度，保留原有宽度断言。
- 详细操作及限制见 `docs/database-upgrade.md`；未执行 electron-builder，旧 EXE / ZIP 保持不变。

## 工作台 / 凭据 / 历史日志升级（2026-09-28，未打包）

本节是后续开发验证，不改变上方历史发行报告。

- `npm run build`：类型检查与静态前端构建通过。
- `npm test`：83 / 83 通过。
- `npm run test:backend`：30 / 30 通过。
- `npm run test:desktop`：58 / 58 通过；最终报告 `artifacts/smoke-TaoJLT/result.json`，渲染器错误列表为空。
- 新增测试覆盖：导航默认折叠/显式展开保留、双语箴言手动切换/暂停、真实操作计数、Escape 退出大屏、AI 输入法回车/会话栏/820px 短窗口、远程 OS 密码加密及重读、RDP DPAPI 往返、日志元数据白名单/取消清空、保存密码与保存私钥的本机 SSH 认证。
- 保留原有数据库、CSV 模板、SQL、剪贴板、原生文件、SSH/SFTP、AI 流式、IPC 隔离检查；负向用例预期的主进程拒绝报错不属于测试失败。
- 修复了预加载事件取消订阅函数返回 Electron 对象造成的跨隔离域克隆错误；取消订阅现在不返回不可克隆对象。
- 浏览器目视检查：工作台动画/双语名言、AI 中文浅色与英文深色、820×680 布局、主导航手动展开、SSH 私钥弹窗、历史动作筛选、看板窗口内大屏与 Escape 退出。浏览器错误日志为空，恢复原中文/浅色与默认视口。
- 本轮图片：上述报告目录内 `home-zh.png`、`home-en-dark.png`、`activity-dashboard.png`、`chat-small.png` 等。

测试不接入用户真实服务器，不使用真实密码/模型额度，不清空用户日志或配置。不宣称真实 RDP 登录、生产 SSH 兼容性或真实 AI 服务商已验证；RDP 策略可能要求重新认证。本轮未执行打包，现有 v0.1.3 EXE/ZIP 保持不变。


## v0.1.4 实际发行检查（2026-09-28）

用户本次明确授权打包。build、83 单元、30 后端、58 桌面集成检查通过。
ZIP CRC、包内 54 个资源一致性、全部数据库驱动加载、SQLite 子进程精确数值与取消通过。
ZIP / portable 在隔离目录实际启动、正常退出、state.json 保存通过。
删除 281 个旧发行文件；4 个 elevate.exe 被策略阻止删除，未绕过。574 个既有数据文件 SHA-256 未变。
报告：artifacts/release-0.1.4-check/release-result.json。旧段落“未打包”描述的是当时状态。

## 私钥连接弹窗布局修复（2026-09-28）

- 复现：私钥模式增加字段后，原 fieldset 滚动层内容溢出，dialog 自身滚动导致标题裁切、底部按钮遮挡表单。
- 修复：标题独立固定，中间普通 div 为唯一滚动层，fieldset 仅管理表单禁用状态；底部操作栏独立固定。dialog 使用动态视口高度并禁止外层溢出。
- 长私钥文件名支持换行和完整路径悬停提示；不改变凭据加密、授权或保存逻辑。
- 浏览器验证：中文浅色、英文深色、小窗口、下拉选择与滚动；未连接真实服务器或读取真实私钥。
- 桌面回归：1380×950、820×680、1024×768 / 125% 缩放，中英/深浅主题，长文件名、表单滚到顶部/底部、标题/按钮边界及提示可达。
- `npm run build` 通过；83 项单元测试通过；59 项桌面集成检查通过，renderer errors 为空。
- 最终报告：`artifacts/smoke-wjsui3/result.json`；截图：同目录 `remote-key-*.png`。
- 当时未打包，后续修复已纳入 v1.0.0；原有 v0.1.x EXE / ZIP 及旧发行检查产物已在正式发布清理中移除，用户数据未删除。

## v1.0.0 正式发行验证（2026-09-28）

本节记录 LiteBox v1.0.0 正式版的最终验证结果；旧 v0.1.x 发行程序与旧发行检查产物已清理，用户数据目录保留。

- `npm test`：89 / 89 通过。
- `npm run test:backend`：30 / 30 通过。
- `npm run build`：类型检查与 Vite 生产构建通过。
- `npm run test:desktop`：桌面集成检查通过，渲染器错误列表为空。
- `node scripts/verify-package.mjs release/v1.0.0/win-unpacked/resources/app.asar`：36 个关键文件一致，包内无用户数据。
- `node scripts/verify-database-package.cjs release/v1.0.0/win-unpacked/LiteBox.exe`：MySQL、PostgreSQL、SQLite、SSH、Oracle、MongoDB、Redis 驱动及 SQLite 精确数值/取消检查通过。
- portable 与 ZIP 解压版均已实际启动、创建独立 `litebox-data`、保存 `state.json` 并正常退出。
- SHA-256：见 `release/v1.0.0/SHA256SUMS.txt`；完整 JSON 报告：`artifacts/release-v1.0.0-check/release-result.json`。
- 正式包未签名，Windows SmartScreen 可能显示提示；未将 API Key、密码、私钥或用户数据写入包内。

正式发行资源：

- `release/v1.0.0/LiteBox-1.0.0-portable.exe`
- `release/v1.0.0/LiteBox-1.0.0-x64.zip`
- `release/v1.0.0/SHA256SUMS.txt`


---

## R3 交付前归档的 R2 记录（历史，不代表最新包）

# 验证记录 / Verification report

版本：**V1.0.0 · 2026-09-29 R2**。Windows 11 x64、Node.js 24.1.0、npm 11.3.0、Electron 44.4.5。历史批次记录保存在 TESTING_HISTORY.md，不混用测试数字或启动时间。

## 源码与界面验证

| 检查                 | 结果    | 范围                                                                                   |
| -------------------- | ------- | -------------------------------------------------------------------------------------- |
| npm test             | 91 / 91 | 9个文件；既有工具及新增本地知识检索                                                    |
| npm run test:backend | 41 / 41 | 协议适配、凭据、确认令牌、SQLite分页及附件校验                                         |
| npm run build        | 通过    | Vue/TypeScript检查、Vite生产构建                                                       |
| npm run test:desktop | 81 / 81 | 实际Electron/IPC/UI、本机模拟SSH/SFTP/AI、临时SQLite                                   |
| 浏览器预览           | 通过    | 蓝白/黑灰、中英文、数据库对齐、768px窄窗AI控件；已恢复中文、黑色主题并取消测试尺寸覆盖 |

全量测试在最终源码格式化后再次运行。桌面报告 errors 为 []。非法参数、拒绝写SQL等预期的拒绝日志不等于测试失败；失败的中间报告未删除，也不冒充最终结果。

### 新增重点回归

- Banner手动暂停/继续、导航与可见性恢复；保持减少动态效果偏好。
- 后端读取完整1205行与1003张表；UI验证62个对象、113行结果、2010字符单元格、返回上一页/修改查询重置及双轴分隔条。
- 105条历史事件分页；记录保留策略仍为最多3000条，不是永久无限保留。
- 模拟SSH的红/绿ANSI输出、实际选中复制、粘贴、危险换行取消、右键推送AI草稿；不会自动请求模型，不断开原SSH。
- 图片和文本附件持久化；发送确认前请求数为0；仅选中片段进入请求，普通提问不泄露未勾选知识。
- 修复流式事件晚于IPC完成造成的空回答：最终回复作为权威结果，忽略已完成请求的迟到分片。
- 中英文、浅深主题与820/1280窗口的既有远程、私钥、确认框、数据库、会话保持回归继续通过。

## 包验证与清理

- ASAR：61个源码/构建文件逐字节一致，版本1.0.0，不含用户数据/测试夹具。
- ZIP：185个文件与本次 win-unpacked、隔离解压副本逐项SHA-256一致，不含用户数据。
- 包内数据库/SSH驱动全部加载；SQLite子进程、精确整数与取消通过。
- 单文件EXE、完整解压ZIP均在新建隔离目录启动、窗口响应、正常关闭、状态持久化。
- 本次EXE 143.05MiB，ZIP 139.07MiB。单次观测首次标题窗口约10.18s / 2.18s；含1秒轮询与进程枚举，不是冷启动或可交互时间，不承诺性能提升比例。
- **旧包清理未完成**：执行策略在进程创建前拒绝删除命令，实际删除0文件，没有换工具/脚本绕过。375个旧程序候选与186个本次验证副本仍在；不能声称只保留了新版。
- 原有758个应用数据文件及758个额外备份均SHA-256复核一致；清理范围内合计1029个独立保留文件无变化；新版EXE/ZIP校验未变。所有用户数据、未知文件、既往受限helper和空目录保留。

当前交付目录：release/v1.0.0-20260929-r2/。完整结果见本批次 release-result.json；cleanup-result.json 独立记录未完成状态。测试隔离副本在验证后仍保留，原因同上，不是面向用户的另一发行版。

## 范围与边界

未连接用户生产服务器、真实网络数据库、RDP或付费AI模型；这些仍需按实际环境联调。SQLite及本机协议夹具通过不代表所有服务端版本均兼容。

数据库分页重新执行查询，不是事务快照；建议稳定唯一ORDER BY。单页约2MiB软界限、单记录32MiB硬界限，超过明确报错，不静默截断。复制/导出只含当前页。图片依赖视觉模型；附件支持图片与UTF-8文本，暂不解析PDF/Word。知识检索是本地关键词方法，不是向量数据库，也不保证对所有文档注入攻击免疫。

## 报告

本批次报告：artifacts/upgrade-v1.0.0-20260929-r2/。desktop-result.json 包含最终81项明细，test-summary.json 指向原始桌面报告和截图。构建/单元/后端/桌面最终日志位于 artifacts/*-upgrade-final.log。

These are local regression results, not certification for all infrastructure or AI providers. Release verification and data-preservation audit are recorded separately from historical builds.

