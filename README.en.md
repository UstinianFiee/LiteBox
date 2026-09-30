# LiteBox · 轻匣

**Everyday tools, in one box.**

LiteBox is a portable Windows toolbox for personal productivity, development, and server administration. It brings text utilities, image processing, format conversion, Markdown, remote connections, databases, AI chat, and dashboards into one workspace.

Windows x64 · English / Simplified Chinese · Blue-white light / Black-gray dark themes · Local-first · MIT

[简体中文](README.md) | **English**

[Features](#features) · [Getting started](#getting-started) · [Development and testing](#development-and-testing) · [Data and privacy](#data-and-privacy) · [Documentation and contributions](#documentation-and-contributions)

## Features

| Module             | Capabilities                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home               | Tool search, favorites, recent tools, usage statistics, and pausable animations and bilingual quotes                                                                     |
| Text utilities     | Custom separators, batching by size or group count, deduplication, quoting, set intersection / difference, copy and export; preserves leading zeros and long identifiers |
| SQL builder        | Insert multiline text into SQL `IN` conditions, escape quotes, filter empty lines, deduplicate, save drafts, copy and export `.sql` files                                |
| Format conversion  | JSON formatting and minification, JSON / YAML conversion, Base64, URL encoding, timestamps, UUIDs, and more                                                              |
| Image workshop     | Batch JPG / PNG / WebP / BMP / GIF input and JPG / PNG / WebP output; quality adjustment, proportional resizing, transparency handling, and before / after preview       |
| Markdown           | Editor, preview, split view, local file opening and saving, drafts, and HTML export                                                                                      |
| Remote connections | SSH terminal, SFTP file management, system RDP, password or private-key authentication, saved credentials, terminal copy / paste, and error-to-AI drafts                 |
| Databases          | MySQL / MariaDB, PostgreSQL, SQLite, Oracle, MongoDB, Redis; object browsing, queries, paginated results, confirmation-based CRUD, import and export                     |
| AI assistant       | Streaming chat, error analysis, conversation history, image and text attachments, and local retrieval from user-selected snippets                                        |
| Dashboards         | Usage statistics and a full-window view, plus CSV import, aggregation, charts, and templates                                                                             |
| History            | Local activity records, filters, pagination, CSV / JSON export                                                                                                           |
| Snippets           | Save, search, and copy commands, SQL, and text; optionally use snippets as AI knowledge sources                                                                          |
| Settings           | Language, theme, AI provider configuration, data location, backup / restore, and open-source licenses                                                                    |

### Connections and data tools

- **Remote connections:** SSH supports password and private-key authentication. SFTP supports browsing, upload, download, and small UTF-8 text edits. Verify the host fingerprint on first connection. Windows RDP opens through the system `mstsc.exe`, not an embedded desktop.
- **Database workspace:** Resize the query and result panes, browse pages, and copy results with or without headers. Import CSV / TSV / JSON and export the currently loaded results as CSV / TSV / JSON / SQL INSERT. Available operations vary by database.
- **Confirmations:** Sensitive operations such as structured database writes and remote file overwrites require confirmation. Sending a terminal error to AI creates a draft; AI does not execute terminal commands automatically.

## Getting started

### Desktop distributions

Check [GitHub Releases](https://github.com/UstinianFiee/LiteBox/releases) for published artifacts. If your desired version has no binary attachment, run from source using the instructions below.

- **Portable EXE:** Run `LiteBox-<version>-portable.exe`; no installation is required.
- **ZIP:** Extract the entire archive into a writable directory, then run `LiteBox.exe`. Do not launch it from inside the archive.

Before upgrading, exit the application and back up your data. Find its location in Settings. Preserve the complete data directory during migration; do not blindly merge or overwrite data from different sources.

### Browser preview from source

Use **Node.js 24 and npm 11**. The desktop distribution targets Windows x64; browser mode previews the UI and local utilities.

```powershell
git clone https://github.com/UstinianFiee/LiteBox.git
cd LiteBox
npm ci
npm run dev:web
```

Open <http://127.0.0.1:5173/>. Keep the terminal running for hot reload; press `Ctrl+C` to stop.

| Runtime          | Scope                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Browser preview  | Themes, language, text, images, conversion, Markdown, snippets, history, dashboards, database examples, and import previews          |
| Electron desktop | Browser features plus real SSH / SFTP / RDP, database connections, AI requests, OS-encrypted credentials, and native file operations |

Browser preview does not connect to real servers or databases, or save connection passwords. Browser and desktop data are separate; `localhost` and `127.0.0.1` also have separate browser storage. Use the development server instead of opening `dist/index.html` directly.

### Desktop mode from source

Stop any browser development server using the development port, then run:

```powershell
npm run dev
```

Alternatively, launch Electron with the built frontend:

```powershell
npm run build
npm start
```

`npm run build` checks types and builds the frontend; it does not produce EXE / ZIP distributions.

### Configure the AI assistant

In Settings → AI provider, enter a base URL, model ID, and API key, then save.

- The endpoint must support the Chat Completions streaming format. The app appends `/chat/completions` to the base URL.
- Remote endpoints require HTTPS; local services may use HTTP. Local services without authentication may omit the API key.
- Image understanding requires a vision-capable model. Image and UTF-8 text attachments are supported; PDF / Word files are not parsed directly.
- Select snippets explicitly to use them as knowledge sources. Retrieval runs locally; selected context is sent with your question.
- No models, provider accounts, or credits are included. Providers may charge for requests. Remove passwords, tokens, and other sensitive information before sending.

## Data and privacy

- **Local storage:** Desktop settings, drafts, conversations, and attachments stay on your machine; see Settings for the location. Packaged apps use `litebox-data` beside the executable; source development defaults to `.litebox-data` in the project root. Browser mode uses separate local storage.
- **Credential protection:** API keys, database passwords, and remote credentials use the current Windows account's OS encryption. Moving to another machine or account may require entering them again. Ordinary chats, drafts, and attachments are not all encrypted at rest.
- **Backup boundaries:** Standard JSON backups exclude passwords, keys, and original attachment files. Back up the complete data directory before migration and keep backups private.
- **AI boundaries:** Attachments and selected knowledge snippets go to the configured provider after you send or confirm them. Do not treat untrusted content as safe instructions.
- **Logs and networking:** Activity logs exclude passwords, SQL / chat bodies, and terminal input. There is no telemetry or automatic update service. AI, remote connections, and network databases still contact their configured services.

Do not commit `litebox-data`, `.litebox-data`, private keys, connection credentials, or personal backups to public repositories. See the [security policy](SECURITY.md).

## Scope and limitations

- Image exports are static, single-frame files. Re-encoding removes original EXIF and other metadata; neither lossless compression nor a smaller file is guaranteed. Original files are not overwritten.
- Markdown preview sanitizes content and does not support scripts or image previews.
- The database query editor is for read-only queries; writes use separate confirmation-based forms. Arbitrary write-SQL scripts, DDL, migrations, full-database backups, and SSH tunnels are not supported. This is not a replacement for a full database administration suite.
- Database copy / export covers the currently loaded result page, not a full export. Pagination does not guarantee a consistent transaction snapshot across pages.
- The remote backend maintains one active SSH session at a time. Embedded RDP, recursive remote deletion, and unattended background operations are not provided.
- Dashboards show local activity or imported CSV data, not live server monitoring. Only connect to systems you own or are authorized to access.

## Development and testing

Stack: **Vue 3 · TypeScript · Vite · Electron**, with xterm.js for terminals and ECharts for charts.

```powershell
npm test
npm run test:backend
npm run build
npm run test:desktop
```

Desktop integration tests require a graphical desktop environment. These test and build commands do not create release packages.

| Command             | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `npm run dev:web`   | Browser development and preview                |
| `npm run dev`       | Electron development mode                      |
| `npm run typecheck` | TypeScript checks                              |
| `npm run build`     | Type checks and production frontend build      |
| `npm run pack`      | Unpacked Windows x64 application directory     |
| `npm run dist`      | Windows x64 Portable EXE and ZIP distributions |

The default package output is `release/v1.0.0/`; change it in the `package.json` build configuration if needed. Source and binary distributions are separate artifacts; consult the release notes for the version you use.

### Project structure

```text
src/                 Vue pages, components, styles, and frontend logic
electron/            Desktop main process, IPC, and connection services
scripts/             Development, testing, and build scripts
tests/               Unit/backend tests and UI regression fixtures
docs/                User, developer, and maintenance documentation
build/               Application icons and packaging resources
```

## Documentation and contributions

Some detailed guides are currently written in Chinese.

- [Desktop usage](docs/PORTABLE-README.txt)
- [Browser testing and packaging](docs/BUILD_AND_TEST.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Open-source overview](docs/OPEN_SOURCE.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Use [Issues](https://github.com/UstinianFiee/LiteBox/issues) for bug reports and feature requests, or contribute through a pull request. Include the version, runtime, and reproduction steps; redact screenshots and logs. Report vulnerabilities privately according to the security policy, without publishing credentials or exploit details.

## License and acknowledgments

LiteBox is released under the [MIT License](LICENSE). Thanks to Vue, Electron, Vite, xterm.js, ECharts, Lucide, and the database driver projects. See [third-party notices](THIRD_PARTY_NOTICES.md) for dependency licenses and acknowledgments.
