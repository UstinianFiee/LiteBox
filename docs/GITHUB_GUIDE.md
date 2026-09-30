# GitHub 推送与正式发布指南

适用版本：LiteBox v1.0.0 · Windows PowerShell。源码推送与二进制发布是独立步骤；推送 main 不会自动创建标签或上传安装包。

## 当前仓库与后续更新

- 目标仓库：`https://github.com/UstinianFiee/LiteBox.git`
- 工作分支：`main`；本地远程名：`origin`。本地仓库已经初始化，无需重复 `git init` 或 `git remote add`。
- 当前源码包含异步剪贴板读写修复，已有 R3 EXE/ZIP 尚未重新构建；请勿将旧二进制发布成当前源码的构建结果。
- 下方首次初始化流程供其他新目录参考；后续本目录的源码更新使用：

```powershell
Set-Location 'E:\tr\workbuddyProject\DevOps'
git status --short
git diff
npm test
npm run test:backend
npm run build
# 确认没有真实凭据、应用数据或打包文件后暂存
git add .
git diff --cached --stat
git diff --cached --check
git commit -m "fix: describe the source update"
git push origin main
```

推送被拒绝时先检查远端更新或认证信息；不要直接使用强制推送。

## 1. 准备环境与空仓库

- 本地已验证：Windows 11 x64、Node.js 24.1.0、npm 11.3.0；CI 使用 Node.js 24。
- 安装 Git。GitHub CLI (`gh`) 为可选工具。
- 在 GitHub 创建空仓库，例如 `litebox`。先选择私有仓库便于检查，确认无敏感信息后再自行公开。
- **不要勾选初始化 README、License 或 .gitignore**；源码已经包含这些文件。
- 通过 Git Credential Manager / GitHub CLI 登录或配置 SSH Key。HTTPS 推送不能把 GitHub 账户密码作为 Git 密码；不要把 Token 写进远程 URL、脚本或源码。

下面命令中的 `YOUR_GITHUB_ACCOUNT` 和仓库名需要替换为你实际拥有的仓库。

## 2. 初始化本地仓库并检查提交范围

以下步骤仅适用于尚未初始化 Git 的新目录。如果已经有 `.git`，跳过 `git init`，先检查分支与远程地址。

```powershell
Set-Location 'E:\tr\workbuddyProject\DevOps'
git init
git branch -M main
git config user.name '你的 GitHub 显示名'
git config user.email '你的 GitHub 提交邮箱或 noreply 邮箱'

git add .
git status --short
git diff --cached --stat
git diff --cached --name-only
```

仓库已忽略 `node_modules/`、`dist/`、`release/`、`artifacts/`、`litebox-data/`、`.litebox-data/`、环境文件和日志。**忽略规则不能替代人工检查，也不能移除已经提交过的文件。**

提交前检查：

- 不得包含真实 API Key、密码、私钥、聊天内容、数据库、服务器配置和备份。
- 截图和问题复现文件也不能带真实主机、客户资料或 Token。
- `LICENSE` 是项目代码许可；`THIRD_PARTY_NOTICES.md` 为依赖声明，需一并保留。
- `package.json` 的 `private: true` 只用于防止误发 npm，不妨碍开源仓库发布。

确认列表正确后：

```powershell
git commit -m 'chore: release LiteBox v1.0.0'
```

## 3. 绑定远程并推送源码

### 方案 A：已通过 GitHub 网页创建空仓库（推荐）

```powershell
$owner = 'YOUR_GITHUB_ACCOUNT'
$repo = 'litebox'
git remote add origin "https://github.com/$owner/$repo.git"
git remote -v
git push -u origin main
```

如果更习惯 SSH，**用下面这一行替换上面的 HTTPS remote add**，不要重复添加 origin：

```powershell
git remote add origin "git@github.com:${owner}/${repo}.git"
```

origin 已存在时先 `git remote -v` 核对。仅当你确认需要更换目标时，使用 `git remote set-url origin ...`。

### 方案 B：尚未在网页创建仓库，改用 GitHub CLI

本方案与 A 二选一，不能在已创建同名仓库后再执行 create。

```powershell
gh auth login
$owner = 'YOUR_GITHUB_ACCOUNT'
$repo = 'litebox'
gh repo create "$owner/$repo" --private --source=. --remote=origin --push
```

希望直接公开且已经完成敏感信息审核，可自行把 `--private` 改为 `--public`。不要把认证信息粘贴到公开 Issue 或截图中。

## 4. 创建 v1.0.0 标签与 Release

本次正式包已经构建并验证，无需为了首次上传重新打包。先确认源码提交就是当前正式包对应的源码：

```powershell
git status --short
git log -1 --oneline
Get-ChildItem 'release\v1.0.0'
Get-FileHash 'release\v1.0.0\LiteBox-1.0.0-portable.exe' -Algorithm SHA256
Get-FileHash 'release\v1.0.0\LiteBox-1.0.0-x64.zip' -Algorithm SHA256
Get-Content 'release\v1.0.0\SHA256SUMS.txt'
```

哈希应与 `SHA256SUMS.txt` 一致。正式包、校验清单应来自同一次构建；重新打包后必须更新校验值，不能沿用旧清单。

```powershell
git tag -a v1.0.0 -m 'LiteBox v1.0.0'
git push origin v1.0.0
```

如果 tag 已存在，检查 `git show v1.0.0`；不要覆盖已经公开的 tag。若需改代码，发布新补丁版。

进入仓库 **Releases → Draft a new release**：

1. 选择标签 `v1.0.0`，标题填写 `LiteBox v1.0.0 · 轻匣正式版`。
2. 从 `docs/RELEASE_v1.0.0.md` 复制发布说明。
3. 只上传下方三个文件，不上传整个 release 文件夹、数据备份或验证目录。
4. 这是正式版，不勾选预发布选项。复核后自行点击发布。

| 附件                         | 用途                                     |
| ---------------------------- | ---------------------------------------- |
| `LiteBox-1.0.0-portable.exe` | 单文件免安装启动                         |
| `LiteBox-1.0.0-x64.zip`      | 解压后运行 LiteBox.exe；保留全部运行文件 |
| `SHA256SUMS.txt`             | 下载完整性校验                           |

可选 CLI **仅创建草稿**（不要与网页流程重复执行）：

```powershell
gh release create v1.0.0 --verify-tag --draft `
  --title 'LiteBox v1.0.0 · 轻匣正式版' `
  --notes-file 'docs/RELEASE_v1.0.0.md' `
  'release/v1.0.0-20260929-r2/LiteBox-1.0.0-portable.exe' `
  'release/v1.0.0-20260929-r2/LiteBox-1.0.0-x64.zip' `
  'release/v1.0.0-20260929-r2/SHA256SUMS.txt'
```

当前构建没有代码签名，发布说明必须保留这一点；校验哈希不能代替代码签名或可信来源判断。不建议把 EXE/ZIP 提交进 Git 历史。

## 5. 后续版本的构建与发布

收到新的发布需求后：

```powershell
npm version patch --no-git-tag-version  # 例如升级到 1.0.1
```

**不要只改 package.json 版本**。还需要同步：

- `src/lib/store.ts` 的浏览器预览版本号；
- `package.json` → `build.directories.output`，例如 `release/v1.0.1`；
- `README.md`、`CHANGELOG.md`、`docs/PORTABLE-README.txt`、发布说明和支持版本范围。

然后运行：

```powershell
npm ci
npm test
npm run test:backend
npm run build
npm run test:desktop
npm run dist
```

包内检查（路径按版本调整）：

```powershell
node scripts/verify-package.mjs release/v1.0.1/win-unpacked/resources/app.asar
node scripts/verify-database-package.cjs release/v1.0.1/win-unpacked/LiteBox.exe
```

实际启动验证时，应将 EXE 复制到新的隔离目录、将 ZIP 解压到另一个新的隔离目录，再使用 `scripts/verify-release.ps1`；其 `DataDirectory` 参数必须指向**被测程序旁边的 litebox-data**，它不是数据目录重定向参数。不得让测试读写真实用户数据。

为新包生成校验清单：

```powershell
$version = '1.0.1'
$out = "release/v$version"
$files = @("$out/LiteBox-$version-portable.exe", "$out/LiteBox-$version-x64.zip")
$lines = foreach ($file in $files) {
  $hash = Get-FileHash -LiteralPath $file -Algorithm SHA256
  "$($hash.Hash.ToLower())  $(Split-Path $file -Leaf)"
}
$lines | Set-Content -Encoding ascii "$out/SHA256SUMS.txt"
```

完成验证后再提交源码、创建新标签及 Release。旧版程序资源与用户数据应分开管理，永远不要递归删除包含 `litebox-data` 的整个父目录。

## 6. CI 与社区维护

- `.github/workflows/ci.yml`：main 推送 / Pull Request 时在 Windows + Node.js 24 运行依赖安装、单元测试、后端测试和前端构建；仅读权限，不自动发布、不使用真实凭据。
- CI 不代表真实数据库、RDP 或付费 AI 服务已经联调。桌面集成和 EXE/ZIP 启动验证仍按发布清单执行。
- Issue 模板、PR 模板、`CONTRIBUTING.md` 和 `SECURITY.md` 已提供。
- 公开仓库前请维护者在 GitHub 启用私密漏洞报告，或提供可用的私人安全联系渠道；当前文档未捏造维护者邮箱。

## 7. 常见问题

- `nothing to commit`：已经提交且没有新改动，不需要重复制造一个发布提交，检查后直接创建标签。
- `remote origin already exists`：先查看远程；不要重复执行方案 A / B。
- `non-fast-forward` / 远程已有 README：先 fetch 并查看两边历史。首次发布优先使用空仓库；不要直接 force push，也不要盲目合并无关历史。
- 认证失败：确认远程地址、账号权限与凭据管理器；不要公开发送 Token。
- 发现密钥已提交：立即撤销 / 轮换密钥，再处理提交历史；只删除文件不等于撤销凭据。

参考入口：

- GitHub 本地代码推送：https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
- GitHub Releases：https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository
- GitHub CLI：https://cli.github.com/manual/gh_repo_create
- Release CLI：https://cli.github.com/manual/gh_release_create

## 2026-09-29 V1.0.0 重建说明

本次保持版本号 1.0.0，二进制及 SHA-256 与 9 月 28 日构建不同。上传前按 [浏览器测试与打包手册](BUILD_AND_TEST.md) 验证。若原标签/Release 已公开，不要静默覆盖或强推标签；建议新版本号，或在 Release 明确注明重建日期及新旧摘要。当前操作不包含 GitHub 推送。

本地此次交付目录为 `release/v1.0.0-20260929-r2/`。旧 `release/v1.0.0/` 的发行附件及旧测试程序已在追加清理中移除；仅保留用户数据、非白名单辅助文件和空目录。只上传本次两个程序附件和对应 SHA256SUMS.txt，切勿上传整目录或用户数据。清理数量、保留项及策略限制详见清理记录。

### 本次 R2 交付

版本仍为 1.0.0，构建批次为 2026-09-29 R2；以本次 SHA256SUMS.txt 为准。未执行 git init、commit 或 push；等你提供仓库地址后再检查远程与提交范围。附件原文件位于 litebox-data/ai-attachments，同其他应用数据一样严禁提交。
