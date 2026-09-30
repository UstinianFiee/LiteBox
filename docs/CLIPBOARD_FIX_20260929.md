# 终端粘贴修复说明（2026-09-29）

**最新状态（2026-09-29）：当前修复的是异步剪贴板接口调用，尚未打包；现有 R3 EXE/ZIP 不包含此修复。** R3 仅包含此前的 NUL 字符处理和界面调整，仍会出现普通文本无法粘贴的问题。以下前半部分保留此前 NUL 修复的历史记录；最新修复见文末。

## 问题与原因

报错：

`Error invoking remote method 'clipboard:read': Error: Invalid clipboard text / 参数无效`

原剪贴板读取使用通用字符串校验；含隐藏空字符（NUL，U+0000）或超过读取长度限制时都会返回同一错误。没有读取用户的实际剪贴板内容，因此未断言本次用户输入具体触发哪一种情况。

## 修复范围

- 为剪贴板读取增加独立校验；读取阶段保留原始文本，让终端处理隐藏空字符。
- 检测到 NUL 后展示符合当前主题的确认弹窗，说明移除数量并预览清理后的内容。用户取消时不发送任何命令；确认后才粘贴清理后的内容。
- 全部为 NUL 时提示没有可粘贴文本；超长内容提示缩小复制范围，不静默截断。
- 终端每次仍最多接受 65,536 个 JavaScript 字符串单元；读取边界上限仍为 1,048,576 个。
- 保留多行及控制字符确认、SSH 输入校验、IPC 来源校验与权限限制；不修改密码或远程连接。

## 已完成验证

- `npm run test:backend`：42 项通过。
- `npm test`：91 项通过。
- `npm run build`：类型检查与前端静态构建通过，不是打包。
- `npm run test:desktop`：82 项原生检查通过，结果 errors 为空。
- 覆盖正常中文/换行、嵌入/尾随 NUL、读取超限、取消不发送、确认后清理粘贴，以及原生 paste 事件路径。
- 使用独立测试数据和模拟 SSH 服务；上述剪贴板 IPC/终端用例使用测试替身，未连接生产服务器。历史数据库复制用例曾使用系统剪贴板；本次已改为内存替身，不能将历史完整套件描述为从未接触系统剪贴板。

测试日志：

- `artifacts/clipboard-fix-backend.log`
- `artifacts/clipboard-fix-unit.log`
- `artifacts/clipboard-fix-build.log`
- `artifacts/clipboard-fix-desktop.log`

## 历史生效范围（最初源码修复阶段）

此次仅修复源码并重新构建前端，未生成、替换或清理 EXE/ZIP；保留所有应用数据，未停止用户运行中的应用。现有 `release/v1.0.0-20260929-r2` 安装包与免安装程序仍为原版本，不包含本次修复。

浏览器预览使用 `npm run dev:web`，地址 `http://127.0.0.1:5173/`；浏览器不能验证 Electron 原生剪贴板 IPC。需要本地验证修复时，在项目目录运行 `npm run test:desktop`（隔离测试），或在安排好现有应用使用后运行未打包开发模式 `npm run dev`。正式更新免安装版需单独执行新的打包流程，并再次保留应用数据。

## 最新修复：等待异步剪贴板 API（未打包）

当前安装的 Electron 44.4.5 类型定义为 `readText(): Promise<string>`、`writeText(text): Promise<void>`。原主进程在读取时没有等待 Promise 完成，直接校验 Promise 对象，因此普通终端文字也会被判为“无法读取剪贴板纯文本”；不是用户复制方式有问题。此前同步剪贴板测试替身没有覆盖这一行为。

- 读取：等待原生结果后再做纯文本/长度校验。
- 写入：等待原生写入完成后才返回成功；异步失败正常返回错误，不再提前报成功。
- 测试：增加延迟完成、异步失败和终端选中文本→复制→粘贴的端到端 IPC 回归；剪贴板替身改为 Promise，数据库复制检查改用内存数据。
- 保留空文本、中文/emoji、多行和 NUL 安全确认、取消不发送及长度限制；不扩大 Electron 权限。
- 本次仅修改源码和测试，不生成、覆盖或删除 EXE/ZIP，不改动应用数据、凭据及备份。已有 R3 免安装程序不会自动获得源码修复。

### 本地验证方式

在项目目录 `E:\tr\workbuddyProject\DevOps` 运行：

`npm run build` 后运行 `npm run test:desktop`，使用隔离数据及本地模拟服务器验证原生功能，不是正式打包。需要手动试用时可运行 `npm run dev`；该模式会使用正常开发应用数据，请勿与另一开发实例同时操作数据。纯浏览器 `npm run dev:web` 无法验证 Electron 原生剪贴板 IPC。

本次异步修复验证结果（2026-09-29）：`npm test` 91/91、`npm run test:backend` 42/42、`npm run build` 通过、`npm run test:desktop` 89 项通过且 `errors: []`。桌面回归覆盖延迟完成/异步失败、终端选中文本→异步复制→异步读取→粘贴、NUL/多行确认和数据库内存剪贴板隔离。

本次测试日志：

- `artifacts/clipboard-async-unit.log`
- `artifacts/clipboard-async-backend.log`
- `artifacts/clipboard-async-build.log`
- `artifacts/clipboard-async-desktop.log`
