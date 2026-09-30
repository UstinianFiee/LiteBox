# LiteBox 项目约定

- 默认通过 `npm run dev:web` 启动浏览器预览，在 `http://127.0.0.1:5173/` 验证修改。
- 未获得用户新的明确打包要求，不执行 `npm run pack`、`npm run dist` 或 electron-builder，不生成 EXE/ZIP。
- `npm run build` 仅为类型检查和静态前端构建，可以执行；需要原生能力验证时可运行未打包的 Electron 集成测试。
- 清理产物必须保留每一个 `litebox-data`、`.litebox-data` 和用户文件。不要删除整个 release 目录；参照 `docs/package-cleanup.md` 核对范围。2026-09-28 v0.1.4 打包时已清除 281 个旧文件，保留全部数据；剩余 4 个旧 elevate.exe 删除被安全策略拒绝，不得绕过限制。
- 保持中英文同步；沿用蓝白浅色、黑灰深色及现有可读字号。不为修复复制而放宽全局 Electron 权限。
