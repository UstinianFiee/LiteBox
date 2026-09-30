# LiteBox · 轻匣 V1.0.0 正式版

构建批次：**2026-09-29 R3**。Windows x64；产品版本仍为 **1.0.0**。包含当前源码中的终端粘贴修复和紧凑 UI 调整。未推送 GitHub，也未覆盖任何公开发布的标签。

## 本批更新

- 剪贴板中的隐藏 NUL 字符由终端提示确认清理后粘贴；取消不发送任何内容。保留 64K 上限、多行/控制字符确认和原有安全校验。
- AI 附件、常用记录入口移入输入框内部工具栏，减少突出的大按钮与常驻说明。
- 数据库对象、查询结果及历史日志统一紧凑分页；查询状态与翻页操作合并为底栏。
- 保持中英文、蓝白/黑灰主题、键盘操作和窄窗口适配；继承 R2 的功能与限制。

## 发行文件

目录：`release/v1.0.0-20260929-r3/`。

| 文件 | 体积 | 使用方式 |
| --- | ---: | --- |
| LiteBox-1.0.0-portable.exe | 143.05 MiB | 单文件免安装，每次运行仍需临时展开 |
| LiteBox-1.0.0-x64.zip | 139.07 MiB | 完整解压后运行 LiteBox.exe；建议日常使用 |
| SHA256SUMS.txt | — | 校验发行附件完整性 |

程序未签名。请从可信来源获取，不要关闭或绕过系统安全防护。SHA-256 仅验证文件完整性，不能代替发布者身份认证。不要只复制 ZIP 中的 LiteBox.exe，必须保留完整解压目录。

## 验证结果

91 项单元测试、42 项后端测试、85 项桌面集成检查通过；类型检查和生产前端构建通过。ASAR 61 个源码/构建文件、ZIP 185 个运行文件一致；包内 7 个驱动/模块加载、隔离 SQLite 读查询/取消验证通过。EXE 与 ZIP 均完成隔离启动、响应检查、状态保存及正常退出。详见 TESTING.md。真实生产数据库、RDP 和外部 AI 仍需环境联调。

## 数据与旧包

- 本次未执行旧包清理；不移动、合并或导入用户数据，不终止用户运行中的程序。测试使用新建的独立目录。
- 首次打包时 npm.ps1 忽略输出参数，默认旧目录的程序运行时被重新生成；发现后已停止并改为直接调用 builder，最终交付仅认 R3 目录。中断 ZIP 已移至 artifacts 并标记 incomplete，不能用作发行包。
- 受该默认目录影响范围内的 80 个原有数据文件与既有 SHA-256 基线完全一致，原数据没有丢失；其他目录未进行迁移或删除。原 R2 包仍保留。
- 升级前退出新旧应用并备份数据。新包目录不会自动读取其他目录的资料；选择一个实际使用的 litebox-data 完整复制到新程序旁，不合并多个来源。JSON 导入不含密码、私钥与附件原文件。加密凭据通常需要原 Windows 用户环境。
- 不要上传 release 中的数据目录、artifacts、备份或本机审计记录到 GitHub；发布只上传 EXE、ZIP、SHA256SUMS.txt。

## SHA-256

```text
7d3c80da6930671f265413503974e4d5112b07b68402bfa0887f458415e082af  LiteBox-1.0.0-portable.exe
7a21d2bc9a3aa07abec092a08e90e98a3ae199b28d4bc10f47fa9b69f1dec7a3  LiteBox-1.0.0-x64.zip
```

## English summary

V1.0.0, rebuild batch 2026-09-29 R3, includes clipboard validation fixes and compact composer/pagination controls. Both Windows x64 portable and ZIP packages passed isolated startup and content verification. Existing user data is preserved; no automatic migration, old-package cleanup or GitHub push was performed.
