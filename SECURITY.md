# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |
| 0.1.x   | No        |

## Reporting a vulnerability

Do not open a public Issue for credentials, IPC, file access, remote connection, database, or data-loss vulnerabilities. Use GitHub Security Advisories if enabled, or contact the repository maintainer privately through the email listed in the GitHub profile.

Include the affected version and operating system, reproducible steps or a minimal proof of concept, impact and possible mitigation, and whether credentials or personal data were exposed.

Do not include real passwords, API keys, private keys, customer data, or production hostnames. Rotate any credential used during reproduction.

## Local data and AI boundaries

Credentials use the current Windows account's OS encryption; conversation text, snippets and attachment files are not all encrypted at rest. Keep the entire application data directory private. Standard JSON exports contain metadata and attachment references, not passwords, private keys or attachment file bodies.

AI attachments and selected snippet excerpts leave the machine only after an explicit send/confirmation to the configured provider. Knowledge retrieval is local and opt-in; retrieved documents are treated as untrusted context, but prompt framing cannot guarantee immunity to document-based prompt injection. Remove secrets before sending logs or screenshots. The terminal's AI action creates a draft only; it does not execute commands or send automatically.

Attachment size/type checks and pagination limits protect memory; they do not make untrusted file content trustworthy. Database exports/copy cover the current page and pagination is not a transactional snapshot. Multiline terminal paste and structured database changes require confirmation. Use only infrastructure that you own or are authorized to access.
