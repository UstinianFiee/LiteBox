# LiteBox v1.0.0 开源说明 / Open-source project guide

## 项目定位

LiteBox（轻匣）是一个面向个人与小型团队的 Windows 便携式本地优先工具箱。它把文本整理、图片处理、格式转换、Markdown、远程连接、数据库工作台、AI 助手、数据看板和历史日志放在统一界面中。

- 项目版本：`v1.0.0`
- 许可证：MIT，详见仓库根目录 `LICENSE`
- 发布平台：Windows x64 portable / ZIP
- 主要技术：Vue 3 + TypeScript + Vite + Electron
- 默认原则：本机优先、最小权限、显式确认、可审计、可恢复

## 开源范围

仓库包含：

- `src/`：Vue 前端与本地工具逻辑
- `electron/`：主进程、IPC、凭据存储和数据库适配
- `tests/`、`scripts/`：自动化测试与发布验证
- `docs/`：使用、发布、安全和贡献文档
- `LICENSE`、`THIRD_PARTY_NOTICES.md`：法律及第三方声明

仓库不包含：

- API Key、密码、私钥、聊天内容、数据库文件和服务器配置
- `litebox-data` / `.litebox-data` 用户数据目录
- `dist/`、`release/`、`artifacts/` 等构建产物
- 个人环境文件、日志和临时测试文件

## 安全边界

1. API Key、数据库密码、远程密码和私钥不会写入普通配置备份；在 Windows 桌面端使用当前用户的系统加密能力保存。
2. 图片工坊在本地完成图片读取、编码和下载，不上传图片。
3. 数据库写入需要结构化操作和明确确认；查询编辑器默认只允许受限只读查询。
4. IPC 使用白名单和参数校验；渲染进程不直接访问 Node.js 或文件系统。
5. 日志只记录时间、模块、动作和结果等元数据，不记录密码、SQL、聊天正文、终端输出和图片内容。
6. 远程连接、数据库、AI 和外部文件操作必须只用于用户拥有或明确获授权的目标。

## 已知限制

- 未进行商业代码签名，Windows SmartScreen 可能显示提示。
- 真实 Oracle、MongoDB、Redis、MySQL、PostgreSQL、RDP、AI 服务商环境仍需用户自行联调。
- 图片重新编码可能丢失 EXIF 等元数据；动画图片导出为静态单帧；不承诺无损压缩。
- 当前不提供 DDL、SSH 隧道、全库备份、实时服务器监控或通用 Word/PDF 转换。
- 写入、上传、远程命令或 AI 请求的结果可能受目标环境影响，不能以本地测试替代生产验证。

## 本地开发

验证环境为 Windows 11 x64、Node.js 24.1.0、npm 11.3.0；CI 使用 Node.js 24。新机器先安装 Node.js 与 Git。

```powershell
npm ci
npm run dev:web
# 浏览器访问 http://127.0.0.1:5173/
```

需要桌面能力时：

```powershell
npm run build
npm start
```

常用检查：

```powershell
npm test
npm run test:backend
npm run build
npm run test:desktop
```

## 提交规范

- 使用清晰的小步提交：`feat: add image studio`、`fix: preserve remote session`、`docs: update release guide`
- 一个提交只解决一类问题；避免把格式化、功能和无关重构混在一起。
- 提交前运行与改动相关的测试，涉及 UI 时同时验证中文、英文、浅色、深色和 820px / 1280px 布局。
- 不提交真实密钥、用户数据、服务器地址、截图中的敏感信息或打包产物。
- Pull Request 说明动机、行为变化、测试命令、兼容性影响和已知限制。

## 版本与发布

版本遵循 SemVer：`MAJOR` 为不兼容变化，`MINOR` 为向后兼容的新功能，`PATCH` 为向后兼容的修复。

正式发布必须：

1. 同步 `package.json`、`package-lock.json`、`src/lib/store.ts` 浏览器版版本号、`build.directories.output`、README、便携版说明和 `CHANGELOG.md`。
2. 运行单元、后端、构建和桌面隔离测试。
3. 清理旧发布产物但保留用户数据目录。
4. 生成 portable、ZIP、SHA-256 校验文件和验证报告。
5. 使用 Git tag 发布，并在 GitHub Release 中附带变更摘要、校验值和已知限制。

## 贡献者检查清单

- [ ] 没有引入硬编码密钥或危险默认权限
- [ ] 中英文文案同步
- [ ] 浅色 / 深色主题可读
- [ ] 键盘操作和焦点可用
- [ ] `prefers-reduced-motion` 不会被破坏
- [ ] 浏览器预览已验证
- [ ] 自动化测试已通过
- [ ] 文档、变更记录和限制已更新
