---
id: SPEC-reqor
companions:
  - glossary.md
  - dialect-matrix.md
  - ../planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md
  - ../planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md
sources:
  - ../planning-artifacts/prds/prd-reqor-2026-07-08/prd.md
  - ../planning-artifacts/prds/prd-reqor-2026-07-08/addendum.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Reqor MVP

## Why

Postman's 2026 pricing changes pushed small teams off free collaboration tiers. Developers at small teams (5–50 engineers) already commit JetBrains `.http` files to Git but have no browser-accessible, zero-install way to browse and run them without IntelliJ or proprietary cloud tools. Reqor closes that gap: `reqor serve` turns existing `.http` files into a browsable, runnable local web UI in one command. No incumbent owns the web-first + open-source + REST-only + JetBrains-native niche that this market shift has opened.

## Capabilities

- **CAP-1** — CLI start and local server
  - **intent:** Developer runs `reqor serve [path]` (or `npx @reqor/cli serve`) to start a Local Server that serves the Web UI and proxies HTTP requests; browser opens automatically.
  - **success:** Server is up within 5 seconds; CLI prints URL; browser opens to Web UI; process exits non-zero with readable error on port conflict or missing path.

- **CAP-2** — Repository scan and collection loading
  - **intent:** Local Server scans the Repository Root recursively for `.http` files and exposes each as a named Collection; developer can trigger a manual re-scan from the Web UI without restarting.
  - **success:** Each `.http` file appears as a Collection in the sidebar with name from repo-relative path; re-scan completes within 3 seconds for up to 100 files; parse error displays inline on the offending file with line number; no file is silently omitted.

- **CAP-3** — JetBrains HTTP file parsing
  - **intent:** Parser extracts method, URL, headers, body, variables, and environment definitions from JetBrains `.http` dialect files; OUT constructs return an explicit unsupported diagnostic instead of a silent skip.
  - **success:** ≥90% parse pass on a curated 50-file real-world fixture corpus (SM-2); parse errors report file path and line number; IN/OUT boundary is the dialect-matrix companion.

- **CAP-4** — HTTP proxy execution with environment resolution
  - **intent:** Developer sends a Request from the Web UI; Local Server resolves active-environment variables and secrets, proxies the HTTP call to the target URL, and returns status, headers, body, and timing.
  - **success:** Works for `http://` and `https://` targets including `localhost`; pre-send preview shows resolved URL and headers with secrets redacted; unresolved variables block send with the variable name identified; secrets never appear in API response, logs, or history.

- **CAP-5** — Collections and request navigation
  - **intent:** React SPA sidebar lets developer browse Collections and select individual Requests; collection hierarchy mirrors repository file paths.
  - **success:** Sidebar functional at 1280px minimum viewport width; selecting a Request loads its details in the editor panel; keyboard navigation covers collection selection and request send.

- **CAP-6** — Request editor with disk save
  - **intent:** Developer edits Requests in a visual form or raw `.http` text editor (bidirectional sync); saving writes back to the source `.http` file atomically while preserving JetBrains-compatible formatting.
  - **success:** UJ-2 completes — developer edits, saves, runs `git diff`, sees clean textual diff, opens PR — without manual file repair, in 3/3 test sessions (SM-4); atomic write (temp file + rename) prevents partial corruption; read-only disk produces an explicit error, never silent discard.

- **CAP-7** — Environment and secrets management
  - **intent:** Developer selects one active Environment from the Web UI; named variables resolve from `http-client.env.json`; secrets resolve from the `.env` file variants (`.env`, `.env.local`, `.env.staging`, etc.) that already exist in the repo and are already gitignored — Reqor reads them, never writes them.
  - **success:** Active environment name persists across restarts; `{{$dotenv KEY}}` resolves from the matching `.env` variant; secret values masked in UI display; secrets absent from History entries and exported snippets; no separate secret vault or new gitignore entry required.

- **CAP-8** — Request history
  - **intent:** Each sent Request creates a History Entry (timestamp, environment name, method, URL, status code, duration) that developer can browse chronologically and replay into the editor.
  - **success:** Last 500 entries persisted in `.reqor/history.db`; response bodies over 1MB truncated in list/detail with an expand-to-full action; history survives server restart.

- **CAP-9** — cURL import and export
  - **intent:** Developer pastes a cURL command to populate the editor; exports the current Request as a cURL command.
  - **success:** Import supports `-X`, `-H`, `-d`, `--data-raw`, `--json`, `-u`; unsupported flags show a warning but import the partial Request; exported cURL executes equivalently in a terminal against the same environment.

- **CAP-10** — Code snippet export
  - **intent:** Developer copies the current Request as a runnable code snippet in JavaScript (`fetch`), Python (`requests`), or cURL.
  - **success:** Snippet includes method, URL, headers, and body; secrets replaced with placeholder comments; snippet executes correctly against the resolved environment.

## Constraints

- **Thin-client BFF:** Browser never calls target APIs directly. All HTTP execution goes through the Local Server proxy. Rules out browser-direct fetch, client-side CORS workarounds, and any split execution path. (AD-6)
- **Parser isolation:** `@reqor/http-parser` is the sole owner of JetBrains `.http` parse, AST, and serialize. No dialect logic lives in server routes or the browser. Web receives typed DTOs via API only. (AD-3)
- **Disk as source of truth:** Canonical state lives in `.http` files on disk. Web UI holds draft state until explicit save. Save uses atomic write (temp file + rename). MVP is edit-only for existing files. (AD-4, AD-5)
- **Secrets from `.env` files, read-only:** Secrets resolve server-side from the repo's existing `.env` file variants (`.env`, `.env.local`, `.env.staging`, etc.). Reqor reads these files; it never writes to them. No separate secret vault (`.reqor/secrets.env` is eliminated). API responses redact secret values. History, logs, and snippet exports never contain plaintext secrets. Supersedes AD-7/AD-20 on vault location.
- **JetBrains MVP dialect scope:** Only constructs marked IN in `dialect-matrix.md` are supported. OUT constructs return an explicit unsupported diagnostic — never silent skip. (AD-17)
- **Single Fastify process, fail fast:** One Node 24 process hosts REST API + static Web UI + HTTP proxy via Fastify 5.x. Default port 3000. Port conflict triggers non-zero exit with message — no auto-increment. (AD-9, AD-15)
- **No telemetry:** Local Server makes no outbound network calls except user-initiated proxied requests. Update check and telemetry are disabled by default. (AD-16)
- **Monorepo + strict dependency direction:** pnpm 11.x + Turborepo 2.x. Allowed edges: `cli → server`; `server → http-parser, shared-types`; `web → shared-types`. No circular imports. (AD-1, AD-2)
- **Typed API contract:** REST endpoints use TypeBox schemas from `shared-types`. Server validates inbound requests. Web uses TanStack Query. Parser AST types never cross the API boundary. (AD-10, AD-22)
- **Performance floor:** Web UI initial load ≤2 seconds on localhost; send-click → loading state ≤100ms. Rules out unbundled assets and synchronous blocking operations in the critical render path.
- **Per-request failure isolation:** A single HTTP proxy failure must not crash the Local Server process. A parse error in one `.http` file must not block other Collections from loading. Rules out unguarded top-level exception propagation.

## Non-goals

- Postman collection import (post-MVP fast-follow)
- VS Code REST Client dialect support
- Reqor Cloud or any hosted deployment
- Desktop app (Electron/Tauri)
- Mock servers, API design, or OpenAPI authoring
- GraphQL, gRPC, WebSocket, or any non-HTTP protocol
- Team accounts, SSO, or role-based access control
- CI/CD integration or headless CLI request runner
- Filesystem watch or automatic hot reload of `.http` files
- Creating new `.http` files from the UI (edit-only in MVP)
- Advanced JetBrains scripting: pre-request scripts, response handlers, file inclusion, OAuth2 helpers, `@name` request references

## Success signal

`reqor serve` on a repo with existing `.http` files reaches the first successful request send in under 60 seconds (SM-1), and the JetBrains parser passes ≥90% of a curated 50-file real-world fixture corpus (SM-2). Both gates must pass before public promotion — npm download count before SM-2 is a counter-metric.

## Assumptions

- Recursive scan excludes `node_modules` and `.git`; honors `.gitignore` where present.
- JetBrains dynamic variables in MVP scope: `$uuid`, `$timestamp`, `$randomInt`, `{{$dotenv KEY}}`.
- History capped at 500 entries per Repository Root; stored in `.reqor/history.db` via `better-sqlite3`.
- Minimal-diff write strategy for disk save; full-file rewrite fallback with warning on patch failure.
- MVP is edit-only for existing `.http` files; create-new is post-MVP.
- Secrets read server-side from repo `.env` file variants (`.env`, `.env.local`, `.env.staging`); Reqor never writes to these files; no `.reqor/secrets.env` vault.
- Redirect following enabled by default (max 10 hops); per-request toggle in UI defaults to follow.
- No WCAG 2.1 AA compliance required for this dev tool MVP; basic keyboard navigation (collection select, send action) is required.
- License: MIT (confirmed).

## Open Questions

- ~~**Q1:** Final JetBrains dialect support matrix~~ — **Resolved:** `dialect-matrix.md` is final; IN/OUT boundaries confirmed.
- ~~**Q2:** OSS license~~ — **Resolved:** MIT.
- ~~**Q3:** `@reqor/cli` npm namespace availability~~ — **Resolved:** `@reqor` scope, `@reqor/cli`, `@reqor/server`, and `reqor` (unscoped) all available as of 2026-07-08.
- ~~**Q4:** Secret storage default~~ — **Resolved (Option C):** Secrets sourced exclusively from repo `.env` file variants users already maintain and gitignore. Reqor reads, never writes. No vault file. `.reqor/` retains `history.db` and `config.json` only.
- ~~**Q5:** Port conflict handling~~ — **Resolved:** Fail-fast confirmed (AD-9); user passes `--port` explicitly.
