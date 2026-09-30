轻匣 LiteBox 1.0.0 / Portable desktop toolbox

免安装使用 / No installation required:
- 推荐解压 ZIP 后双击 LiteBox.exe；保留同目录全部运行文件。
- 单文件 portable.exe 每次运行仍需临时展开，本次已优化展开方式；日常频繁启动推荐完整解压 ZIP 后运行。
- 数据保存在程序旁 litebox-data；请放在当前用户可写的目录。
- 本版本未进行商业代码签名。只运行你信任的构建，不要关闭系统安全防护。

本版包含 / Included:
文本整理（订单号、编号、名单等）与集合对比、SQL IN 生成、图片压缩与格式转换、文本格式转换、Markdown 编辑预览、片段库；
图片支持读取 JPG/PNG/WebP/BMP/GIF、导出 JPG/PNG/WebP；仅导出静态单帧，重编码不保留 EXIF，不承诺无损压缩；
SSH 终端、SFTP 文件管理、Windows RDP；AI 流式聊天与会话管理；
MySQL/MariaDB、PostgreSQL、SQLite、Oracle Thin、MongoDB、Redis 数据库工作台；
查询结果复制（含表头/仅内容）、CSV/TSV/JSON 导入与导出、关系表 SQL INSERT 导出；
带确认的结构化增删改查、数据库与远程连接凭据加密保存；
操作记录看板与大屏、历史日志筛选及导出，保留原 CSV 看板与模板；
默认收起菜单、动画横幅、中英名言轮播、优化 AI 页面、蓝白/黑灰主题及中英切换。

凭据与数据 / Credentials and data:
- 在连接配置中勾选记住凭据；相同连接留空可继续使用已保存项。
- SSH 支持密码或私钥（含口令）；RDP 使用密码。凭据与连接目标绑定。
- API Key、数据库密码、远程凭据使用当前 Windows 用户的系统加密。
- 普通配置备份不含密码/密钥。换电脑或系统用户需重新填写；并非所有本地数据均已加密。
- 升级前退出旧版并备份原 litebox-data；不同位置的数据不要盲目合并或覆盖。
- 本次发布不自动搬迁旧数据。旧数据文件夹即使位于旧版本目录也应保留。
- ZIP 版可将所需的一个旧 litebox-data 完整复制到新 LiteBox.exe 同目录，保留原备份。
- 日志只记录时间、模块、动作和结果等元数据，不记录密码、SQL、聊天及终端正文；最多 3000 条。

限制 / Limits:
- 最多 8 个远程资产标签，当前只有一条活跃 SSH 连接；切换功能保留会话，手动断开、关闭连接标签或退出应用后结束。
- RDP 系统策略可能仍要求输入密码。主机指纹改变应先与管理员核实。
- Oracle 使用 Thin 驱动；MongoDB 为主机/端口配置；Redis 为受限命令，不是任意命令控制台。
- 查询编辑器不执行任意写 SQL；使用界面确认的结构化增删改查。无 DDL、SSH 隧道或全库备份。
- 导出与复制仅包含当前页结果；导入 CSV/TSV 首行为字段名，JSON 可用对象数组。
- 写入取消/超时后的结果可能不确定，重试前请核实。只连接自己拥有或获授权的系统。
- Markdown 安全预览禁用远程图片与链接跳转；无 Word/PDF 通用转换，无实时服务器监控。
- AI 需要自行配置服务地址、模型和密钥，服务商可能收费。
- 本机 SSH/SFTP/AI 模拟、临时 SQLite、系统凭据加密已测试；真实网络数据库、RDP 及 AI 服务商未联调。

Passwords/private keys are OS-encrypted for the current Windows account and excluded
from ordinary configuration backups. Keep all existing litebox-data folders safe.
Structured database writes require confirmation. Exports and copy actions cover the current page only.
Live remote databases, RDP login and external AI providers require environment-specific testing.


正式版 / Stable release: v1.0.0
Release date: 2026-09-28 / Rebuilt: 2026-09-29

2026-09-29 重建更新 / Rebuild updates:
- SSH 指纹、远程覆盖、数据库写入、清空日志统一为主题确认框，默认取消。
- 远程终端随工作区高度伸展，资产列表底部对齐；短窗口内部分区滚动。
- 按需加载远程/数据库界面与 SSH 驱动，缩短装饰动画等待，优化 portable 展开方式。
- 原生文件选择器与界面加载前的致命错误提示仍使用系统对话框。
- 源码目录 docs/BUILD_AND_TEST.md 提供浏览器测试、桌面验证、打包与数据保留流程。

2026-09-29 R2 功能更新 / Feature update:
- 数据库对象与查询结果分页，默认50条，可选25/50/100/200；左右/上下分隔条支持鼠标拖动与方向键。完整显示字段，不静默截断。
- SSH 选中文本后 Ctrl+Shift+C 复制，Ctrl+Shift+V 粘贴；含换行/控制字符会先确认。右键推送到 AI 仅生成草稿，需手动发送。ANSI 16色随主题适配。
- AI 支持 PNG/JPEG/WebP/GIF 图片和 UTF-8 文本/日志/代码附件；图片需模型支持视觉。每条最多5个，总计12MiB；图片单个6MiB、文本单个512KiB。暂不解析PDF/Word。
- 勾选参考常用记录后在本地检索常用片段，最多发送3条已选摘录；默认关闭，可逐条取消。
- 附件原文件保存在 litebox-data/ai-attachments；普通JSON备份不含原文件，完整迁移须复制整个数据目录。
- 查询分页会重新执行只读查询，并非数据库快照；建议 ORDER BY 唯一稳定字段。日志分页不改变最多3000条的保留策略。
- 首页动画恢复、减少动态效果支持、滚动条闲置隐藏、底部对齐和窄窗口适配。
See source docs/UPGRADE_20260929.md for limits, privacy and migration details.

2026-09-29 R3 重建更新 / Rebuild updates:
- 修复终端粘贴隐藏空字符导致的通用报错；经确认后清理并粘贴，保留64K限制和安全确认。
- AI附件和常用记录入口合入输入框；数据库与历史日志使用紧凑分页底栏，下拉尺寸同步统一。
- 支持中英文、明暗主题和窄窗口；产品版本保持1.0.0。
R3 includes safer clipboard error handling and compact composer/pagination controls.
