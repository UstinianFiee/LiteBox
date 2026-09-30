# 轻匣 LiteBox

一个面向个人的 Windows 免安装工具箱。把文本整理、图片处理、格式转换、Markdown、远程连接、AI 和数据看板放在同一个安静、统一的工作台里。

**v1.0.0 · Stable · 简体中文 / English · 浅色 / 深色 · 本地优先**

- [开源说明](docs/OPEN_SOURCE.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- [GitHub 推送与发布指南](docs/GITHUB_GUIDE.md)
- [变更记录](CHANGELOG.md)
- [v1.0.0 发布说明](docs/RELEASE_v1.0.0.md)
- [正式版验证记录](docs/TESTING.md)
- [浏览器测试与打包操作手册](docs/BUILD_AND_TEST.md)

## 获取最新源码

源码仓库：https://github.com/UstinianFiee/LiteBox

```powershell
git clone https://github.com/UstinianFiee/LiteBox.git
cd LiteBox
npm ci
npm run dev:web
```

**源码与安装包状态：** 当前源码包含剪贴板异步读取和写入修复；已有 V1.0.0 R3 EXE/ZIP 不包含这项修复。本次仅更新源码，不创建新安装包或 GitHub Release。原生剪贴板需在桌面模式验证：`npm run build` 后运行 `npm start`。详见 [剪贴板修复说明](docs/CLIPBOARD_FIX_20260929.md)。

## 开发默认使用浏览器验证

在 PowerShell 进入源码目录并启动：

```powershell
cd E:\tr\workbuddyProject\DevOps
npm run dev:web
```

浏览器打开 `http://127.0.0.1:5173/`。保持终端运行，修改代码会热更新；按 **Ctrl+C** 停止服务。本机已有依赖，无需重复安装；首次在新机器拉取源码时先运行 `npm ci`（本项目验证环境为 Node.js 24.1.0 / npm 11.3.0，CI 使用 Node.js 24）。

- **可以验证**：中英文、主题、布局、文本分组与复制、图片压缩与转换、格式转换、Markdown 编辑预览、常用片段、操作看板、历史日志与 CSV 分析。
- **需要桌面环境**：真实 SSH / SFTP / RDP、数据库连接、AI 请求与密钥保存、原生文件覆盖保存。浏览器版不把密钥放进前端，也不伪装成已连接服务器。
- 浏览器数据保存在当前浏览器、当前地址下，与桌面 `litebox-data` 独立；切换 `localhost` 与 `127.0.0.1` 不会共享数据。
- 不要直接双击 `dist/index.html`；请通过上面的本机服务访问。如果端口 5173 已占用，先使用已有预览或在它的终端按 Ctrl+C，不要误停其他进程。
- **工作流程：改代码 → 浏览器验证 → 必要的未打包桌面测试 → 用户明确要求后才打包。** `npm run build` 只做类型检查和静态前端构建，不生成 EXE/ZIP；未收到新的打包请求时，不执行 `npm run pack` / `npm run dist`。

## v1.0.0 正式版（2026-09-29 R2）

LiteBox v1.0.0 是首个正式稳定版本，包含文本整理、图片工坊、SQL 生成、格式转换、Markdown、远程连接、数据库工作台、AI 助手、数据看板和历史日志等功能。

- `release/v1.0.0-20260929-r2/LiteBox-1.0.0-portable.exe`：单文件免安装版。
- `release/v1.0.0-20260929-r2/LiteBox-1.0.0-x64.zip`：完整 ZIP 版，解压后运行 `LiteBox.exe`。
- `release/v1.0.0-20260929-r2/SHA256SUMS.txt`：正式包 SHA-256 校验值。
- `artifacts/upgrade-v1.0.0-20260929-r2/release-result.json`：启动、数据隔离和功能回归报告。

**本次为2026-09-29 R2功能更新，版本仍为V1.0.0。新版已验证；旧包删除被环境策略拦截，实际删除0文件，尚未完成清理。应用数据及额外核验备份保留，详情见docs/package-cleanup.md。**

正式包为未签名构建；发布前请核对 SHA-256，并只从可信来源获取文件。
旧的 `v0.1.*` 发布资源已清理，用户数据目录不在清理范围内。

本次优化重建：业务确认全部使用主题弹窗，终端与资产卡片高度对齐；按需加载大模块、缩短开场等待。单文件仍需展开，日常使用推荐解压 ZIP。

本次新增：数据库对象/记录分页与双向分隔栏、SSH 复制粘贴和右键转 AI 草稿、图片/文本附件、常用片段知识检索、日志分页及动画恢复。详见 [本次功能与数据迁移说明](docs/UPGRADE_20260929.md)。

首个正式版新增/完善：

- “订单号处理”更名为更通用的“文本整理 / Text tidy”。
- 新增“图片工坊 / Image studio”：本机批量压缩，读取 JPG/PNG/WebP/BMP/GIF、导出 JPG/PNG/WebP，等比缩放、画质预览与下载。
- 统一蓝白浅色、黑色深色、底部边框输入动效和页面微动效。
- 完善数据库连接、远程连接持久化、AI 历史会话、数据看板和历史日志。

### 数据看板易用性

- 修复空状态按钮的上传图标低对比度，图标加大到 20px，与文字保持同色。
- 内置中英文 CSV 模板下载（UTF-8 BOM，便于 Excel / WPS 识别），包含表头和三行明确标注的示例数据。
- 增加模板表格预览、填写步骤、字段要求、数值格式及导入后的字段选择说明；导入数据后仍可下载模板和查看说明。

### 统一界面

- 蓝白浅色、黑灰深色，全模块统一；减少装饰与动态效果。
- 正文 16px，常用控件最小高度 44px，代码与终端更易读。
- 远程连接默认左侧资产树、中间大终端、右侧文件管理；终端 / 文件管理 / 双面板切换不重建 SSH 会话；可收起服务器列表。小窗口以换行和堆叠代替压缩字体。
- 统一下拉框，支持方向键、Home / End、Enter 和 Escape，弹窗内也能正常使用。

## 功能

| 模块       | 本版能力                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 工作台     | 工具搜索（Ctrl+K）、收藏、最近使用、使用统计                                                                                                                |
| 文本整理   | 默认用 `\|` 拼接；按每组数量或总组数分组；去重、引号、自定义分隔符、复制/导出；交集与差集；保留前导零与超长编号                                             |
| SQL 处理   | 将多行单号填入 SQL IN 条件；引号转义、空行过滤、可选去重；复制、导出 .sql、自动保存草稿；不连接数据库                                                       |
| 格式转换   | JSON 格式化/压缩、JSON ↔ YAML、Base64 编解码、URL 编解码、时间戳、行去重、UUID，共 11 项                                                                    |
| 图片工坊   | 本机批量处理 JPG / PNG / WebP / BMP / GIF；导出 JPG / PNG / WebP；画质调节、等比缩小、透明背景处理、前后预览与单张下载                                      |
| Markdown   | 编辑/预览/分栏；打开本地文本、保存/另存、导出 HTML、本地草稿                                                                                                |
| 远程连接   | 服务器配置；SSH 交互终端；SFTP 列表、上传、下载、小文本编辑；调用系统 Windows 远程桌面                                                                      |
| 数据库连接 | MySQL / MariaDB、PostgreSQL、SQLite、Oracle、MongoDB、Redis；加密密码、对象浏览、安全查询、确认式 CRUD、CSV / TSV / JSON 导入及 CSV / TSV / JSON / SQL 导出 |
| AI 助手    | 兼容 Chat Completions 的流式聊天；日常问答、报错分析、代码、写作模式；停止生成、本地历史与导出                                                              |
| 数据看板   | 默认显示实际使用记录统计与大屏；另支持 CSV 导入、聚合分析、图表与模板下载                                                                                   |
| 历史日志   | 本机使用日志、模块与状态筛选、CSV/JSON 导出；不记录密码、SQL/聊天正文或终端内容                                                                             |
| 常用片段   | 保存、搜索和复制命令、SQL、文本；不会执行片段                                                                                                               |
| 设置       | 中英切换、明暗主题、AI 配置、数据位置、备份恢复、开源许可                                                                                                   |

### 图片工坊（v1.0.0 正式版已包含）

- 从侧栏或工作台进入「图片工坊 / Image studio」，支持拖放或批量选择。
- 默认质量 90%，保留分辨率和支持的原格式；BMP / GIF 默认输出 PNG。PNG 不使用质量参数；希望减小 PNG 体积时可尝试 WebP，并预览细节。
- 可输出 JPG、PNG、WebP；JPG 的透明区域可填白色或黑色。按最长边等比缩小，不放大原图。
- 支持原图 / 结果并排预览、体积和尺寸对比、逐张下载。结果可能比原图大，界面会提示，并提供原图下载。
- 本机执行，不上传图片，不增加编解码依赖。图片仅在本次会话内保留，切换功能不丢失；刷新页面或退出应用会清空。
- 最多 20 张、单张 20 MB、总计 100 MB；处理限制为 2400 万像素、单边 12000 像素。损坏图片单独报错，不中断其他图片。
- **仅导出静态图片，动画只取单帧。重新编码不保留原始 EXIF 等元数据，颜色可能有轻微差异；不承诺无损缩小。** 开始前需勾选确认。原始文件不被覆盖。
- 更改参数会清除旧结果，需重新处理；可停止后续图片。日志仅记录操作类型，不记录图片内容或文件名。

### 文本整理示例（也适用于订单号）

输入：

```text
00001
00002
90071992547409931234
00003
```

每组数量设置为 2，分隔符为 `|`：

```text
00001|00002
90071992547409931234|00003
```

文本整理始终按字符串处理，不会因数字精度丢失而改变。JSON 格式化也保留大整数原文；YAML 转 JSON 时仅将超出安全整数范围的整数转为字符串。JSON 转 YAML 对无法安全表示的整数拒绝转换，而非静默截断。普通小数转换不承诺任意精度。

### SQL 处理（浏览器可用）

侧栏打开「SQL 处理」：上方填 SQL 模板，下方粘贴单号（默认每行一个），点击「生成 SQL」或按 Ctrl+Enter，再「复制 SQL」或「导出 .sql」。可以直接点击「载入订单示例」查看 44 个订单号的完整结果。

推荐模板：

```sql
SELECT XMDCDOCNO AS 订单单号, XMDCSEQ AS 项次
FROM XMDC_T
WHERE XMDCDOCNO IN ({{values}});
```

也可粘贴以 `IN`、`IN ''`、`IN ()` 或 `IN ('')` 结尾的模板。带其他条件或 ORDER BY 时，使用 `{{values}}` 指定唯一的填充位置；已有非空 IN 条件不会被静默覆盖。Markdown 导致的未加引号表名 `XMDC\_T` 会还原为 `XMDC_T` 并提示。

单号始终按字符串处理，保留前导零、长编号与输入顺序，过滤空行；单引号变为 SQL 的两个单引号。默认不去重、不按空格拆值，可选启用逗号 / Tab / 竖线分隔。不需要自己添加引号。编辑输入会清空旧结果，避免复制过期 SQL。草稿参与本地保存和桌面备份；旧备份可继续使用。

仅生成文本，不运行 SQL、不连接任何数据库。模板处理不是完整 SQL 解析或语法验证器，也不保证所有数据库方言都兼容。反斜杠和控制字符会被拒绝而不是猜测转义方式；大批量值请按自己数据库限制分批，执行前核对表名、字段和条件。

### AI 设置

在「设置 → AI 模型服务」填写：

- **接口基础地址**：由服务商提供，例如 `https://api.example.com/v1`，程序追加 `/chat/completions`。仅支持 HTTPS；本机 `localhost` / `127.0.0.1` / `::1` 可用 HTTP。
- **模型名称**：填写服务商实际提供的模型 ID。
- **API Key**：由你自己的服务商提供；本机无需鉴权的服务可以留空。
- 点击 **保存 AI 配置** 后再去 AI 助手提问。修改服务地址会移除旧地址对应密钥，避免跨服务发送。

不自带账号、模型额度或云服务。第三方接口必须兼容本版的 Chat Completions 流式格式，并非所有 AI 协议都可直接接入。联网调用可能收费；发送前主动删去日志中的密码、令牌、个人信息与客户数据。不会自动收集远程文件或把命令交给服务器执行。

### 远程连接

- **Linux**：新建 SSH 配置，填写主机、端口、用户名。可以选择密码或私钥认证，勾选「记住凭据」后加密保存密码，或私钥内容及口令；不勾选则连接时临时输入。凭据不进入配置备份。首次连接需核对主机 SHA-256 指纹；已记录指纹发生改变时拒绝连接。
- **SFTP**：支持目录浏览、单文件上传/下载、1 MB 内的 UTF-8 文本编辑。编辑前后做变更检测，并在保存前确认。
- **Windows**：RDP 使用系统 `mstsc.exe` 打开独立窗口，可保存加密密码并通过 Windows DPAPI 交给远程桌面使用；服务器安全策略仍可能要求重新认证。不是内嵌桌面，也不是无人值守控制工具。
- 最多打开 8 个资产标签，当前后端同时只允许一个活跃 SSH 连接；切换标签保持现有 SSH 与文件面板；切换功能保留会话，手动断开、关闭连接标签或退出应用后结束。连接终端后输入的命令会真实执行，请仅操作自己拥有或获授权的系统。

**SFTP 保存边界**：覆盖已有文件依赖服务端支持 OpenSSH 原子重命名扩展；不支持时拒绝保存，不回退到直接截断原文件。临时文件会尽量保留模式与属主/属组，但要求服务端允许相关操作，不保留 ACL、扩展属性或硬链接关系。变更检测不是服务端文件锁，也无法完全排除外部进程同时写入。关键配置请先备份；保存超时后重新读取以确认最终状态。

### 数据库连接（Navicat 风格轻量工作台）

- 六种连接类型：**MySQL / MariaDB、PostgreSQL、SQLite、Oracle、MongoDB、Redis**。左侧对象树，右侧查询、结果、复制和导出；蓝白 / 黑灰、中英文统一。
- 新建配置 → 测试连接 → 保存 → 连接。勾选「加密记住密码」后由桌面主进程通过系统 `safeStorage` 加密，保存到独立的 `database-secrets.json`；不进入普通配置、配置备份或浏览器存储。留空可复用同一目标的密码；主机、端口、用户、数据库、TLS 或认证库改变后不复用旧密码；「忘记密码」清除记录。跨系统账户或机器复制数据目录后可能需要重新输入。
- 浏览器支持配置编辑、明确标注的虚构示例、结果复制 / 导出、导入预览；**不连接数据库、不保存密码、不执行写入**。真实连接请停止 `npm run dev:web` 后运行 `npm run dev`，无需打包。
- Oracle 使用官方驱动 Thin 模式，填写 **Service Name**，不需要安装 Instant Client；暂不支持 SID、钱包或自定义 CA。MongoDB 填主机 / 端口、数据库及认证数据库（默认 admin）；Redis 用户名可空，数据库编号默认 0。不支持 MongoDB SRV、多地址编辑或 Redis Cluster / Sentinel。
- SQLite 只打开通过原生文件选择器授权的现有文件，不创建数据库；普通查询只读打开，确认数据修改时才临时以可写方式打开，之后恢复只读。重启需重新授权。
- SQL 查询编辑器仍只接受单条 SELECT / WITH。Oracle 使用 FETCH FIRST 限制条数；MongoDB 使用 JSON find 描述（如 `{"action":"find","collection":"orders","filter":{},"limit":200}`），返回 Extended JSON 文档；Redis 使用 JSON 命令数组（如 `["GET","key"]` 或 `["SCAN","0"]`），开放 GET / MGET / TYPE / TTL / EXISTS / HGET / LRANGE / SCAN。Redis 对象树显示首批扫描结果，更多键请根据查询返回的游标继续 SCAN。
- **新增 / 修改 / 删除**在独立的数据弹窗中进行，SQL 使用参数绑定而非拼接值。修改、删除必须给出非空匹配条件；每次写入先勾选确认，再经原生警告对话框审核目标并提交。SQL 单批 1–500 条、事务失败回滚，影响超过 500 行会回滚；MySQL 仅允许 InnoDB 表。MongoDB 每次新增一条文档，修改 / 删除用单文档操作且拒绝已匹配多条的条件；Redis 每次操作一个字符串键（新增 NX、修改 XX 并保留 TTL、删除精确键）。不提供 DDL、随意执行写 SQL 或事务编辑器。
- **导入 CSV / TSV / JSON**：CSV / TSV 首行为字段名，空白保留为空字符串；JSON 可表达 null，支持对象数组或 `{columns, rows}`。文件上限 2 MiB、500 条；有模板、前三条预览、JSON 编辑区，选择文件不会自动写入。MongoDB / Redis 受上述单条写入限制，不支持批量导入。字段名必须按真实表调整；超精度数字应以字符串或 MongoDB Extended JSON 表达，不默默四舍五入。
- **导出 CSV / TSV / JSON / SQL INSERT**，只导出当前已加载结果，不是整库备份。SQL 导出需要选中关系型表、列名唯一，请自行核对查询列与目标字段。JSON 矩阵保留 NULL、重复列名、精确数值文本；重复列名不可直接重新导入。MongoDB JSON 导出为 Extended JSON 文档数组。CSV / TSV 为 UTF-8 BOM，并对电子表格公式添加保护前缀；需要无损往返时优先 JSON。
- **复制表头+内容 / 仅复制内容**采用制表符分隔，NULL 显示为 `NULL`，多行单元格加引号；原样复制可能含公式开头文本，粘贴到电子表格时请按文本处理。
- 查询返回最多 1000 行 / 2 MiB，超限标注；25 秒操作超时或停止会断开连接；切换功能保留连接，退出应用或手动断开后结束。**写入取消 / 超时后不保证远端没有提交，必须核对真实数据后再重试。**只读过滤不是完整 SQL 沙箱；生产库使用最小权限账户，写入前备份。
- 本轮仅更新开发源码与静态构建，**未重新打包**。SQLite 有真实临时数据库集成验证；Oracle / MongoDB / Redis 有驱动契约测试，但尚未用真实服务器验证。详见 `docs/database-upgrade.md`。

## 工作台与使用记录（开发版）

- 左侧主菜单每次启动默认收起，点击顶部展开按钮即可；当前运行中跨页面保留展开状态。
- 工作台增加轻量 SVG 动画横幅和中英对照名言轮播，可暂停、上一句/下一句；系统减少动画设置生效。英文为应用内译文。
- 数据看板默认使用实际操作日志：今日操作、保留操作、活跃模块、失败次数、近七天趋势、模块分布、最近记录；支持窗口内大屏与 Escape 退出。原 CSV 分析保留为独立页签。
- 「历史日志」按模块、结果、时间、动作筛选，支持 CSV/JSON 导出和确认清空。保存最近 3000 条，不补造升级前的明细。
- 日志只保存时间、模块、动作、结果及记录 ID，不保存密码、私钥、SQL/聊天正文、终端输入、文件内容或服务器地址。不记录每个按键或所有自动保存；通用剪贴板/文件事件归入应用模块。
- AI 页面采用独立会话列表、时间分组/搜索、宽版输入框、模式按钮、逐条复制和流式停止；中英文输入法选词回车不触发发送。
- 详细行为、凭据迁移限制和验证范围见 `docs/experience-upgrade.md`。这轮没有重新生成 EXE/ZIP。

## 数据与隐私

- 本地配置、草稿、片段、聊天、CSV 看板数据和服务器地址都可能包含敏感信息，默认并非整库加密；不要把 `litebox-data` 提交到公共仓库。
- AI Key 单独使用 Windows 当前用户加密，不出现在普通状态 JSON 和导出的备份中。换用户或电脑后需要重新填写。
- 导出备份不包含密钥、SSH 密码、私钥文件或指纹信任记录，但包含聊天、草稿等内容；应按敏感文件保管。
- 卸载无需卸载器：退出后自行删除程序目录；如需删除个人数据，也需删除对应 `litebox-data`。测试产生的数据仅在源码目录 `artifacts` 下。
- Markdown 预览经过清理，禁用脚本、远程图片与链接跳转；本版不支持 Markdown 图片预览。
- Electron 窗口启用沙箱和上下文隔离；预加载层只公开允许的 IPC；主进程校验调用来源、文件授权与参数。没有遥测、后台运维、命令自动执行或自动更新服务。

## 本版不做的事情

不提供 Word / PDF / 视频的万能转换、实时服务器监控、任意写 SQL 脚本/建表/迁移、多人协作、递归远程删除、内嵌 RDP、AI 自动修复或定时任务。数据看板默认展示本机实际使用日志的统计，也保留 CSV 分析；不是在线服务器指标。

文本导入上限 5 MB；远程文本编辑上限 1 MB；传输有 10 分钟超时。大 CSV 和超大文本不是本版定位。首次保存或重启后重新编辑本地文件时，可能需要重新通过文件对话框授权。

## 源码开发

项目使用 Electron + Vue 3 + TypeScript + Vite。前端组件按页面异步加载，桌面能力由受限 IPC 提供；静态前端预览不会伪装成拥有远程或文件系统能力。

```powershell
npm ci
npm run dev:web
```

默认使用 `npm run dev:web`。只有需要验证原生功能时才使用 `npm run dev`（同时启动 Vite 和未打包的 Electron，不生成安装包）；若已有 `dev:web` 占用 5173，请先在它的终端按 Ctrl+C。

```powershell
npm run dev:web       # 仅界面预览，桌面能力不可用
npm run build         # 类型检查 + 前端构建
npm test              # 文本处理和转换单元测试
npm run test:backend  # 参数校验、存储、AI SSE 测试
npm run test:desktop  # Electron / IPC / 本机 SSH、SFTP、AI 集成测试（先 build）
npm run licenses     # 生成依赖许可汇总
npm run dist         # 仅在用户明确要求发布时：构建 Windows 便携包
```

Electron 运行库未下载时执行 `node node_modules/electron/install.js`。`dist` 会复用 `node_modules/electron/dist`；electron-builder 首次运行也可能需要下载打包辅助工具。受限网络可以在确认镜像来源可信后配置 `ELECTRON_MIRROR` 和 `ELECTRON_BUILDER_BINARIES_MIRROR`，仓库没有强制替换默认下载源。

测试脚本使用临时、本机模拟服务，不需要真实服务器凭据或付费 API；详见 `docs/TESTING.md`。开发数据默认保存在 `.litebox-data`，与发行版隔离。

```text
src/                 Vue 页面、主题、双语文案、工具逻辑
  pages/             各工具模块
  lib/               状态、类型、目录、转换与 Markdown 清理
electron/            主进程、预加载、SSH/SFTP、AI、存储与校验
scripts/             开发、许可生成、桌面测试与本机模拟服务器
tests/               单元测试
docs/                使用与验证说明
build/               应用图标
release/             生成的发行文件（不纳入版本控制）
```

## 开源致谢

应用代码使用 MIT 许可，见 `LICENSE`。使用而非拷贝整个第三方工具箱：

- Electron — https://github.com/electron/electron
- Vue — https://github.com/vuejs/core
- Vite — https://github.com/vitejs/vite
- ssh2 — https://github.com/mscdex/ssh2
- xterm.js — https://github.com/xtermjs/xterm.js
- Apache ECharts — https://github.com/apache/echarts
- marked — https://github.com/markedjs/marked
- DOMPurify — https://github.com/cure53/DOMPurify
- PapaParse — https://github.com/mholt/PapaParse
- YAML — https://github.com/eemeli/yaml
- lossless-json — https://github.com/josdejong/lossless-json
- Lucide — https://github.com/lucide-icons/lucide

完整依赖许可正文由脚本从实际安装包提取至 `THIRD_PARTY_NOTICES.md`，包括构建/测试依赖；Electron / Chromium 许可随运行库一并发行。

---

## English quick start

LiteBox is a local-first, bilingual Windows x64 desktop toolbox. Development is now browser-first: run `npm run dev:web` from the project directory, then open `http://127.0.0.1:5173/`. Run `npm ci` only if dependencies are missing. Press Ctrl+C in the terminal to stop the preview. Do not generate desktop packages until explicitly requested.

Browser preview supports local text tools, Markdown, snippets and CSV dashboards. Real database connections, SSH/SFTP/RDP, AI requests and native file operations require the unbundled Electron development app. Browser data is separate from desktop `litebox-data`. The v1.0.0 packages include the clipboard fixes, Text tidy and Image studio. Previous v0.1.x program packages were removed; retained release data locations are documented in `docs/package-cleanup.md`.

Features include general-purpose Text tidy, local Image studio (JPG/PNG/WebP export), a SQL IN builder, 11 text converters, Markdown, snippets, SSH/SFTP, system RDP, databases, AI conversation history and activity/CSV dashboards. Switch the interface language and theme from the sidebar or Settings.

The AI provider and credentials are yours to supply. API keys are encrypted for the current Windows user and excluded from backups. Chat history and other local data are not fully encrypted. Remote passwords or SSH private keys/passphrases can optionally be OS-encrypted and persisted; they are excluded from configuration backups. Only connect to systems you are authorized to access.

This unsigned v1.0.0 build is intentionally scoped: up to eight asset tabs (one live SSH connection; switching tools keeps it alive until explicitly disconnected or the app exits), read-only query editors with separate confirmed CRUD forms, no automatic AI execution, no live infrastructure monitoring, and no universal document conversion. Local mock-service tests do not establish compatibility with every real server or model provider. See the testing report for what was actually verified.

### Database workspace (English)

The development workspace supports MySQL/MariaDB, PostgreSQL, SQLite, Oracle Thin, MongoDB and Redis profiles. Saved passwords are OS-encrypted in the main process, bound to the connection destination, and excluded from configuration backups. Browser mode supports previews and local transfers only; use `npm run dev` for real connections without packaging.

Queries remain read-only. Dedicated insert/update/delete dialogs use parameter bindings and explicit native confirmation. SQL mutations are transactional and capped at 500 rows (MySQL requires InnoDB); MongoDB and Redis writes are single-document / single-string-key operations. Import CSV/TSV/JSON with preview (2 MiB / 500 rows; one record for MongoDB/Redis). Export the loaded result as CSV/TSV/JSON or SQL INSERT; copy with or without headers. JSON preserves exact text and nulls. Redis exposes a limited command allowlist; MongoDB uses JSON find descriptions and Extended JSON documents.

Cancellation/timeouts can leave a write outcome uncertain: verify before retrying. No DDL, arbitrary write-SQL scripts, SSH tunnels or full Navicat feature parity. SQLite CRUD and OS credential persistence are verified locally; live Oracle/MongoDB/Redis/MySQL/PostgreSQL servers still require testing. These changes are included in v1.0.0; see the release verification above.

### Workspace and activity (English)

The main navigation starts collapsed. Home includes a lightweight animated SVG banner and bilingual wisdom with pause/previous/next controls. Activity dashboard uses real, retained usage metadata, includes a window-filling view and preserves CSV analysis in a separate tab. History keeps up to 3,000 records, offers filters and CSV/JSON export, and never logs passwords, keys, SQL/chat content or terminal input. Browser and desktop histories remain separate. The AI workspace has a searchable grouped conversation list, a larger composer and IME-safe Enter handling. These changes are included in the v1.0.0 portable and ZIP packages.
