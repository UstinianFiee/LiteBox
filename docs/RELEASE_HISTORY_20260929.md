# LiteBox v1.0.0 · 轻匣正式版

首次发布日期：2026-09-28；本次优化重建：2026-09-29 · Windows x64 · 免安装 · 简体中文 / English

**本次附件目录：`release/v1.0.0-20260929/`。版本号仍为 1.0.0，二进制和校验值已改变。2026-09-29 追加清理已删除旧发行包及旧测试程序 562 个文件；用户数据、历史报告、非白名单辅助文件和空目录保留，新版附件校验未变。仅上传本次附件，不上传保留的数据目录。**

这是轻匣首个正式发行版本。将日常文本、图片、数据库、远程连接与 AI 工具集中到统一的本地优先工作台。

## 2026-09-29 优化

- SSH 指纹、指纹变化警告、文件覆盖、数据库修改和日志清空使用主题确认框；默认取消、长详情可复制和滚动，支持中英文。
- 远程终端按可用高度伸展，资产卡片与右侧工作区底部对齐；修复 xterm 内边距导致末行被裁切的问题。短窗口内部滚动，底部操作可到达。
- 远程/数据库页面、SSH 驱动按需加载；缩短启动装饰等待。portable 改用 NSIS zlib 展开路径，不增加长期解压缓存。
- 本机单次启动到首次观察到标题窗口：旧单文件 11.55s，新单文件 10.29s，ZIP 解压版 2.21s。含轮询开销，非冷启动/可交互基准；旧版同时打开及缓存/系统负载也会影响结果，不能承诺相同比例提升。
- 新单文件约 143.04 MiB（原 99.55 MiB），ZIP 约 139.06 MiB。该打包配置以体积换取展开速度；频繁使用优先完整解压 ZIP。

## 本版亮点

- **文本整理 / Text tidy**：原订单号处理更名；支持编号、名单等通用文本的分隔、分组、去重、集合比较与复制导出，保留前导零及超长编号。
- **图片工坊 / Image studio**：本地批量压缩、格式转换、等比缩小、体积和预览对比。读取 JPG/PNG/WebP/BMP/GIF，输出 JPG/PNG/WebP，原图不被覆盖。
- **远程与数据库**：SSH/SFTP、系统 Windows RDP；MySQL/MariaDB、PostgreSQL、SQLite、Oracle Thin、MongoDB、Redis；加密保存凭据、确认式结构化 CRUD、数据导入导出、查询结果按需复制表头。
- **连接保持**：应用内切换功能保留已建立的 SSH/数据库会话；退出应用不保留网络连接。
- **AI 与记录**：流式聊天、报错分析、会话历史管理；本机使用日志与操作大屏。
- **一致体验**：蓝白浅色/黑灰深色，中英切换，默认折叠菜单，统一弹窗和下拉框，底部边框焦点动画及减少动态效果支持。
- 保留 SQL IN 生成、格式转换、Markdown、常用片段和 CSV 看板。

## 选择附件

| 文件 | 使用方法 |
| --- | --- |
| `LiteBox-1.0.0-portable.exe` | 单文件启动，会临时解压运行，每次仍需临时展开 |
| `LiteBox-1.0.0-x64.zip` | 解压到可写目录，双击 LiteBox.exe，保留同目录全部运行文件 |
| `SHA256SUMS.txt` | 与下载文件的 SHA-256 对比 |

本版本未进行代码签名。请从可信来源获取文件，不要为运行程序关闭系统安全防护。

## 升级与数据

退出旧版并先备份 `litebox-data`。新版使用自身 EXE 旁的数据目录，不会自动合并多个旧目录。需要沿用旧数据时，完整复制你选定的一个 `litebox-data` 到新程序旁，保留原备份；不要覆盖一个已有数据且未经备份的目标目录。

凭据使用当前 Windows 用户的系统加密，普通配置备份不含密码/私钥；更换电脑或 Windows 用户后通常需要重新填写凭据。聊天正文等其他本地数据并非全部加密。

发布清理只针对旧程序资源，不要把用户数据、历史备份或整个 release 目录上传为 Release 附件。

## 验证结果与边界

- 89 项单元测试、37 项后端测试、73 项桌面集成检查通过。
- 包内文件一致性、打包驱动加载、SQLite 子进程以及 portable/ZIP 隔离启动验证通过。
- 已测试本机模拟 SSH/SFTP/AI 和临时 SQLite；没有使用真实生产服务器或付费模型额度。实际网络数据库、RDP、AI 服务商仍需按环境联调。
- 图片仅输出静态单帧，重编码不保留 EXIF，不承诺无损或所有图片体积都下降。
- 当前最多八个远程资产标签、一条活跃 SSH；没有任意写 SQL、DDL、SSH 隧道、全库备份或实时服务器监控。写入超时/取消后先核对目标数据，再决定是否重试。

---

## English summary

Rebuilt on 2026-09-29 with themed business confirmations, viewport-filling remote panels, lazy modules and faster decorative startup. Current files live in `release/v1.0.0-20260929/`. Removal of the previous build is pending because it is running and deletion was blocked by the execution policy. No user data was removed.

LiteBox v1.0.0 is the first stable Windows x64 portable release. It includes Text tidy, local Image studio, SQL and conversion tools, Markdown, SSH/SFTP and system RDP, database profiles and confirmed CRUD, AI conversation history, and activity dashboards. Chinese/English and light/dark themes are supported.

Choose the portable EXE or extract the ZIP and run LiteBox.exe. Back up your data before upgrading. The build is unsigned; obtain it from a trusted source and compare the SHA-256 checksums. Re-encoded images are static and may lose metadata; compression is not guaranteed lossless. Local tests do not certify compatibility with every production service.

## SHA-256 校验值 / Checksums

以下校验值对应本次最终正式版产物，也保存在发行附件 `SHA256SUMS.txt` 中。校验值用于检查文件一致性，不能替代发布者身份验证。

```text
ef969e03a764fae0b169384aa9a840d9e5f21f981d179a2ac30637cbf13a328e  LiteBox-1.0.0-portable.exe
657e4d4758d3599ba74081494496e31ca0708f39619c120f9e09fcd54857cf45  LiteBox-1.0.0-x64.zip
```


---

## R3 交付前归档的 R2 记录（历史，不代表最新包）

# LiteBox · 轻匣 V1.0.0 正式版

构建批次：**2026-09-29 R2**。Windows x64，免安装；产品版本保持1.0.0。不要将此次同版本重建悄悄覆盖到已经公开发布的标签。当前未执行GitHub推送。

## 本次更新

- 首页Banner在导航、可见性恢复后继续动画，保留手动暂停与减少动态效果；闲置滚动条隐藏、卡片底部对齐、窄窗口自适应。
- 数据库对象、结构、查询结果分页；完整字段，不再静默截断；左右/上下分隔条可拖动，也支持键盘。默认50条，可选25/50/100/200。
- SSH选中复制、安全粘贴、右键将报错送入AI草稿；ANSI16色适配主题。不会自动发送AI或执行建议命令。
- AI图片/文本附件、发送前确认、可选常用片段知识检索；知识默认关闭，可查看/取消引用。
- 历史日志分页；保留最多3000条的既有策略。
- 修复AI嵌套Vue代理IPC序列化，以及流式分片晚于完成响应造成的空回答。

功能、限制与迁移详见 [R2说明](UPGRADE_20260929.md)。浏览器启动/原生验证/打包步骤见 [操作手册](BUILD_AND_TEST.md)。

## 发行文件

目录：release/v1.0.0-20260929-r2/

| 文件                       |      体积 | 用法                                        |
| -------------------------- | --------: | ------------------------------------------- |
| LiteBox-1.0.0-portable.exe | 143.05MiB | 双击免安装，每次仍需展开                    |
| LiteBox-1.0.0-x64.zip      | 139.07MiB | 完整解压后运行LiteBox.exe，日常反复使用推荐 |
| SHA256SUMS.txt             |         — | 校验发行附件完整性                          |

程序未签名；只从可信来源获取。校验值不能代替发布者身份认证。不需要绕过系统安全功能。不要只复制ZIP内的LiteBox.exe，需保留整个解压目录。

## 测试结果

91项单元、41项后端、81项桌面集成检查通过；中英/明暗/窄窗浏览器验证通过。ASAR61文件、ZIP185文件一致，包内驱动/SQLite以及EXE和ZIP隔离启动通过。真实生产数据库、RDP及外部AI仍需环境联调。详情见 [验证记录](TESTING.md)。

## 数据保留与清理状态

**新版已完成，但旧程序包清理被执行策略拦截，尚未完成。** 删除命令未启动，实际删除0文件；375个旧程序候选及186个本次隔离验证副本仍保留，未用其他工具绕过。

原有应用数据全数保留在原位置，另有758文件的核验备份：artifacts/upgrade-v1.0.0-20260929-r2/user-data-backup/。本批次原始数据及备份摘要一致，未自动迁移或合并配置。具体原路径见 data-before.json；清理候选和保护清单见同目录审计文件与 [清理记录](package-cleanup.md)。

升级前退出新旧应用。常规JSON可在“设置”导入；它不包含密码/私钥/附件原文件。完整迁移需要选择一个实际使用的数据来源，将整个litebox-data复制到新程序旁，不合并多个旧目录。凭据通常仅在原Windows用户环境可解密，普通聊天和附件并非全部加密。不要上传数据目录或这些本机审计报告到GitHub。

## 使用边界

数据库复制/导出只含当前页；分页重跑查询、非快照，建议稳定唯一ORDER BY。每页约2MiB软界限，单记录32MiB以上明确提示，不静默截断。终端语法颜色来自服务端ANSI，RDP仍为系统远程桌面。

AI附件暂支持PNG/JPEG/WebP/GIF与UTF-8文本/日志/代码，不解析PDF/Word。视觉功能需要模型支持；每条最多5个附件/合计12MiB，单图片6MiB、单文本512KiB。引用片段最多3条，是本地词法检索而非向量库；发送前请检查敏感信息。

## SHA-256

```text
f902b90ad266832baed8cda92a33080d7b9690ed5a79b13ac113aa4e23bcff85  LiteBox-1.0.0-portable.exe
ce93a6332564b16f824703dae939b1ef3c20724d0ed747fa79997d773f0cc085  LiteBox-1.0.0-x64.zip
```

## English summary

V1.0.0, build batch 2026-09-29 R2, adds paged database/history views, resizable panes, terminal copy/paste and AI drafts, image/text attachments and opt-in snippet retrieval, with responsive layout and banner recovery fixes. Local tests and release verification passed. Old-package deletion was blocked before execution; no files were deleted and all user data plus an additional verified backup remain intact. No GitHub push was performed. See the upgrade guide for limits and migration.

