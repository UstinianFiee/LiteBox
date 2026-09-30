# Contributing

感谢参与 LiteBox。请先阅读 `docs/OPEN_SOURCE.md`、`SECURITY.md` 和 `AGENTS.md`。

## 开发流程

1. Fork 仓库并从 `main` 创建分支，例如 `feat/image-export`。
2. 使用 Node.js 24 与 npm 安装锁定依赖：`npm ci`。
3. 浏览器 UI 默认使用 `npm run dev:web` 验证。
4. 完成改动后运行 `npm test`、`npm run test:backend`；涉及桌面能力先运行 `npm run build`，再运行 `npm run test:desktop`。
5. 提交 Pull Request，填写变更、测试、截图（不得包含敏感信息）和已知限制。

## 代码要求

- 使用 TypeScript / Vue 现有风格，保持中英文同步。
- 不绕过 IPC 白名单、不在渲染进程保存明文密钥、不提交用户数据。
- 新增功能应提供空状态、错误状态、键盘操作和减少动态效果支持。
- 新增依赖前说明许可证、体积和安全影响。
- 提交信息推荐 Conventional Commits：`feat:`、`fix:`、`docs:`、`test:`、`chore:`。

## Pull Request 清单

- [ ] 说明用户可见变化
- [ ] 覆盖重要路径的测试通过
- [ ] UI 已验证中英文、浅色、深色和窄窗口
- [ ] 没有敏感信息、构建产物或个人配置
- [ ] 文档 / CHANGELOG 已同步
