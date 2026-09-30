# Changelog

All notable changes to LiteBox are documented here.

## [Unreleased]

### Fixed

- Await Electron 44 asynchronous clipboard reads before validating plain text, and await writes before reporting success. Ordinary terminal text is no longer rejected as a Promise; native read/write failures propagate through IPC.
- Cover delayed native reads/writes, asynchronous failures and terminal selection copy/paste with Promise-based test fixtures. Database copy checks use an isolated in-memory clipboard.
- Source fix only: existing 1.0.0 R3 EXE/ZIP files do not contain this asynchronous clipboard fix and remain unchanged.

## [1.0.0 R3] - 2026-09-29

### Fixed

- Clipboard reads preserve hidden NUL characters until the terminal shows a themed cleanup confirmation; cancel sends nothing, and only confirmed cleaned text is pasted.
- Oversized clipboard text now reports an actionable size error instead of the generic “Invalid clipboard text / 参数无效”. Terminal paste remains limited to 64K characters; multiline/control-character confirmation and strict SSH validation remain enabled.
- Added validator, native clipboard IPC, and SSH paste regression coverage. Included in the 1.0.0 R3 rebuild; older R2 packages do not contain this fix.

### UI refinements

- Moved AI attachment and saved-record controls into the composer toolbar, with quieter styling, explicit selected state and preserved upload/knowledge consent.
- Unified database object, query-result and history pagination into compact panel footers; query status and navigation now share a single footer. Smaller page-size menus preserve keyboard operation.
- Verified responsive composer controls in both themes/languages at 1440×960, 980×740 and 820×680. Included in the 1.0.0 R3 rebuild; older packaged releases remain unchanged.

## [1.0.0 R2] - 2026-09-29

### Added

- Paged database objects, structures, query results and activity history; draggable and keyboard-accessible database pane dividers.
- SSH copy/paste controls and selection context menu; send selected errors to an AI draft without automatically submitting them. Multiline/control-character paste requires confirmation.
- Locally persisted AI image/UTF-8 text attachments with explicit upload consent, and opt-in local retrieval from saved snippets with selectable citations.
- Regression checks for pagination, full cells, pane geometry, ANSI colors, terminal actions, attachments and knowledge privacy.

### Fixed

- Welcome-banner recovery after navigation and visibility changes; manual pause and reduced-motion preferences remain respected.
- Idle-hidden scrollbars, aligned/responsive panels, narrow-window knowledge controls and shared theme styles.
- Vue proxy values crossing the AI IPC boundary, and late stream events racing the final AI response.
- Database fields and result pages are no longer silently clipped; large-row memory limits report explicit errors.

### Release and data safety

- Rebuild as Windows x64 V1.0.0 (R2 build batch); use a fresh output directory and preserve all application data during old-program cleanup.
- Text/image attachments require supported formats/models. JSON backups do not embed attachment files or secrets; copy a complete data directory for migration.
- Page export/copy is limited to the current page; paging reexecutes queries, not a transaction snapshot. Activity retention remains 3,000 entries.
- Production remote databases, RDP and external AI providers still require environment-specific testing. No GitHub push has been performed.

## [1.0.0 rebuild] - 2026-09-29

- Replaced native business confirmations (SSH trust, SFTP overwrite, database writes, clear history) with themed, cancel-first dialogs.
- Added bounded, main-origin confirmation requests with cancellation, replay protection and fail-closed timeout.
- Remote panels stretch to the viewport; the terminal refits after connecting and resizing. Short windows scroll inside the workspace.
- Deferred remote/database UI and SSH driver loading, shortened decorative startup, and switched portable packaging to the useZip path.
- Added browser-testing/build instructions and isolated release verification. User data must always be retained.
- Version remains 1.0.0 by request; do not silently replace an already-published tag.

## [1.0.0] - 2026-09-28

### Added

- Image Studio: local batch compression, JPG/PNG/WebP conversion, proportional resize, preview and download.
- Database workspace with MySQL/MariaDB, PostgreSQL, SQLite, Oracle Thin, MongoDB and Redis support.
- Persistent OS-encrypted credentials for AI, database and remote connections.
- AI conversation history management, activity history and dashboard visualization.
- Bilingual Chinese / English interface with light / dark themes.

### Changed

- Renamed “订单号处理 / Order formatter” to “文本整理 / Text tidy” for broader use.
- Unified blue-white / black theme, readable controls, dropdowns, dialogs and bottom-border focus motion.
- Remote workspace layout, file management and database dialogs were refreshed.

### Security and privacy

- Renderer IPC is allowlisted and validated.
- Sensitive values are excluded from ordinary backups and activity logs.
- Image processing remains local; images are not uploaded by LiteBox.

### Known limitations

- Windows binaries are unsigned.
- Real infrastructure and AI provider compatibility depends on the user's environment.
- Image re-encoding may remove metadata and animation frames.

[1.0.0]: https://github.com/<OWNER>/<REPO>/releases/tag/v1.0.0
