---
title: Reqor
status: final
created: 2026-07-08
updated: 2026-07-08
sources:
  - prfaq-reqor-distillate.md
  - prfaq-reqor.md
stakes: public OSS launch
timeline: 8 weeks local MVP
---

# PRD: Reqor

## 0. Document Purpose

This PRD defines the MVP for **Reqor** (Requestor), an open-source, web-first REST API client for backend and fullstack developers. It is written for the builder (Siva), downstream architecture and UX workflows, and future epic/story decomposition.

Structure: Glossary-anchored vocabulary, features grouped with globally numbered FRs, assumptions tagged inline and indexed in §9. Product narrative and positioning live in `_bmad-output/planning-artifacts/prfaq-reqor.md`. Technical stack decisions (Node.js, React) live in `addendum.md`.

---

## 1. Vision

Reqor is a zero-install REST API client that turns the JetBrains-style `.http` files already in a developer's repository into a browsable, runnable collection in the browser. Developers at small teams (5–50 engineers) maintain HTTP requests as plain text next to their service code, but today have no good way to browse and run those files outside IntelliJ. Postman and similar tools introduce proprietary formats, cloud sync drift, and paywalled features unrelated to sending a GET request.

Reqor closes that gap with one command: `reqor serve` in a project root scans `.http` files, serves a web UI, and proxies HTTP requests through a local Node server — so the browser is UI only and CORS never blocks local API testing. Collections remain plain text on disk; Git is the collaboration layer.

The MVP is deliberately narrow: REST/HTTP only, JetBrains HTTP Client dialect, local-only, no Postman import, no cloud, no mocks, no API design. Scope discipline is a product requirement, not a deferral apology.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Functional:** Send REST requests against local and remote endpoints without installing Postman or opening an IDE.
- **Functional:** Keep one source of truth for API requests in `.http` files committed to Git.
- **Functional:** Switch environments (dev/staging) and resolve variables/secrets at request time.
- **Emotional:** Feel in control — no vendor lock-in, no surprise paywalls, no sync conflicts.
- **Social:** Share request changes via normal Git PR workflow with teammates.
- **Contextual:** On a new machine or contractor laptop, hit an endpoint in under 60 seconds with only a browser and CLI.

### 2.2 Non-Users (v1)

- Teams whose primary workflow is Postman JSON collections with no `.http` files (Postman import is post-MVP).
- Teams standardized on VS Code REST Client dialect only (VS Code dialect support is post-MVP).
- Developers who need GraphQL, gRPC, WebSocket, mock servers, or API design tooling.
- Enterprise buyers needing SSO, governance, or team vault features.

### 2.3 Key User Journeys

**UJ-1. Alex sends a first request from an existing repo in under 60 seconds.**

Alex, a backend engineer at a 12-person startup, clones a service repo that already contains JetBrains `.http` files under `http/`. On a fresh laptop without IntelliJ installed, Alex runs `npx @reqor/cli serve` from the repo root. The browser opens to the local Reqor UI. The sidebar lists one Collection per `.http` file. Alex selects `users.http`, clicks the `GET /api/users` request, and sends it. The response body and status appear in the response panel. No account, no import step. **Edge case:** if the `.http` file has a parse error, Alex sees an inline error on that file with line number — no silent omission.

**UJ-2. Priya edits a request in the UI and commits the change via Git.**

Priya maintains API smoke tests as `.http` files reviewed in PRs. She runs `reqor serve`, opens `auth.http`, edits the request URL in the raw `.http` editor, and saves. The change writes back to `auth.http` on disk preserving JetBrains-compatible formatting. She runs `git diff`, sees a clean textual diff, and opens a PR. Teammates review the `.http` change in GitHub — no Reqor account required. **Edge case:** if disk write fails (read-only file), Priya sees an explicit error and the in-memory edit is not silently discarded without notice.

**UJ-3. Marcus switches environment and hits staging with resolved secrets.**

Marcus selects the `staging` Environment in the UI. Variables from the JetBrains environment file resolve into the request preview. A secret referenced as `{{$dotenv SECRET_KEY}}` or equivalent JetBrains secret syntax resolves from the local `.env` file without displaying the raw secret in the UI after entry. Marcus sends `POST /api/orders` and confirms a 201 response. History records the request with environment name attached.

---

## 3. Glossary

- **Collection** — A logical grouping of Requests derived from one `.http` file on disk. One `.http` file maps to one Collection.
- **Request** — A single HTTP call defined within a `.http` file (method, URL, headers, body).
- **`.http` file** — Plain-text file using JetBrains HTTP Client syntax stored in the repository filesystem.
- **JetBrains HTTP Client dialect** — The `.http` syntax used by IntelliJ IDEA HTTP Client (request separators, variables, environment references).
- **Environment** — A named set of variables (and optional secrets) used to resolve placeholders in Requests at send time.
- **Secret** — A sensitive variable value stored locally; must not appear in logs or history in plaintext.
- **Local Server** — The Node.js process started by `reqor serve` that serves the Web UI, parses `.http` files, and proxies HTTP traffic.
- **Web UI** — The React SPA loaded in the browser; displays Collections and sends commands to the Local Server.
- **Proxy** — The Local Server component that executes HTTP Requests on behalf of the Web UI (avoids browser CORS limits).
- **History Entry** — A persisted record of a sent Request, its Response metadata, and the active Environment at send time.
- **Repository Root** — The directory passed to `reqor serve`; scanned recursively for `.http` files `[ASSUMPTION: recursive scan of subdirectories, excluding node_modules and .git]`.

---

## 4. Features

### 4.1 CLI and Local Server

**Description:** Developer installs or runs Reqor via npm and starts a Local Server bound to a Repository Root. The CLI opens the default browser to the Web UI. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Start local server from CLI

Developer can run `reqor serve [path]` (or `npx @reqor/cli serve [path]`) where `[path]` defaults to the current working directory. Realizes UJ-1.

**Consequences (testable):**
- Local Server listens on `localhost` on a configurable port defaulting to `3000`.
- On successful start, CLI prints the URL and optionally opens the system default browser.
- Process exits with non-zero code and readable error if the port is unavailable or path does not exist.

#### FR-2: Serve Web UI from Local Server

Local Server serves the built React Web UI as static assets from the same origin as the API. Realizes UJ-1.

**Consequences (testable):**
- Navigating to `http://localhost:3000` loads the Web UI without requiring a separate dev server in production mode.
- Web UI can call Local Server REST endpoints without CORS errors.

**Notes:** `[NOTE FOR PM]` Package name `@reqor/cli` subject to npm availability check.

---

### 4.2 Repository Scanning and Collection Loading

**Description:** On start (and on manual refresh), Local Server scans the Repository Root for `.http` files and exposes them as Collections in the Web UI. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-3: Discover `.http` files in repository

Local Server scans the Repository Root for files with extension `.http` and registers each as a Collection. Realizes UJ-1.

**Consequences (testable):**
- Each discovered file appears in the Web UI collection list with a name derived from the file path relative to Repository Root.
- Scan excludes `.git`, `node_modules`, and other standard ignore patterns `[ASSUMPTION: ignore list matches .gitignore where present, plus hardcoded node_modules/.git]`.
- Empty repository shows an empty state with guidance to add a `.http` file.

#### FR-4: Manual collection refresh

Developer can trigger a re-scan of `.http` files from the Web UI without restarting the Local Server. Realizes UJ-2.

**Consequences (testable):**
- After refresh, newly added files appear; deleted files disappear; modified files reload content.
- Refresh completes within 3 seconds for repositories containing up to 100 `.http` files on a typical dev machine.

**Out of Scope:**
- Filesystem watch / automatic live reload (post-MVP).

---

### 4.3 JetBrains HTTP File Parser

**Description:** Local Server parses `.http` files using JetBrains HTTP Client dialect rules and exposes structured Requests to the Web UI. Parser quality is the critical path. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-5: Parse JetBrains HTTP requests

Parser extracts Requests from a `.http` file including HTTP method, URL, headers, and body for JetBrains syntax. Realizes UJ-1.

**Consequences (testable):**
- Supports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` request lines.
- Supports multiple Requests separated by JetBrains request delimiter (`###`).
- Supports query parameters in URL and as separate lines where JetBrains syntax allows.
- Parse errors report file path, line number, and human-readable message in the Web UI — no silent skip.

#### FR-6: Parse JetBrains variables in requests

Parser recognizes JetBrains variable placeholders in URLs, headers, and bodies (e.g. `{{host}}`, `{{$uuid}}`). Realizes UJ-3.

**Consequences (testable):**
- Unresolved variables at send time are flagged before the Request is sent, with the variable name identified.
- Built-in JetBrains dynamic variables in MVP scope: `$uuid`, `$timestamp`, `$randomInt` `[ASSUMPTION: subset per support matrix in addendum]`.

#### FR-7: Parse JetBrains environment files

Parser loads Environment definitions from JetBrains-style environment files referenced by the project `[ASSUMPTION: `http-client.env.json` and/or `*.http` environment file conventions per JetBrains docs]`. Realizes UJ-3.

**Consequences (testable):**
- Web UI lists available Environments by name.
- Selecting an Environment makes its variables available for resolution at send time.

**Out of Scope:**
- VS Code REST Client dialect (post-MVP).
- Advanced scripting blocks and pre-request scripts beyond variable substitution (post-MVP).

**Notes:** `[NOTE FOR PM]` JetBrains dialect support matrix must be finalized by week 4 of build — see addendum draft matrix.

---

### 4.4 Request Execution (Proxy)

**Description:** Web UI sends Requests to Local Server; Local Server executes HTTP calls and returns Responses. Browser never calls target APIs directly. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-8: Execute HTTP request via proxy

Developer can send a Request from the Web UI; Local Server performs the HTTP call and returns status, headers, body, and timing to the Web UI. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- Supports `http://` and `https://` target URLs including `localhost` endpoints.
- Response body renders with syntax highlighting for JSON, XML, and plain text.
- Response time (ms) displayed for each executed Request.
- Local Server follows redirects by default; developer can disable redirect following per request `[ASSUMPTION: toggle in UI, default follow]`.

#### FR-9: Resolve environment variables at send time

When an Environment is active, Local Server resolves JetBrains variables before sending the Request. Realizes UJ-3.

**Consequences (testable):**
- Resolved URL and headers are visible in a pre-send preview (secrets redacted).
- Missing required variables block send with a clear error.

**Feature-specific NFRs:**
- Local Server must not log secret values at any log level.

---

### 4.5 Web UI — Collections and Navigation

**Description:** React SPA provides sidebar navigation of Collections and Requests. Realizes UJ-1.

**Functional Requirements:**

#### FR-10: Browse collections and requests

Developer can view all Collections and expand to select individual Requests. Realizes UJ-1.

**Consequences (testable):**
- Sidebar shows Collection hierarchy mirroring file paths.
- Selecting a Request loads its details in the main editor panel.
- UI remains usable at 1280px viewport width minimum.

---

### 4.6 Web UI — Request Editor

**Description:** Developer edits Requests in a visual form and/or raw `.http` text editor with bidirectional sync to disk. Realizes UJ-2.

**Functional Requirements:**

#### FR-11: Edit request in visual editor

Developer can modify method, URL, headers, and body via form fields. Realizes UJ-2.

**Consequences (testable):**
- Changes in visual editor update the raw `.http` representation shown in the editor.
- Invalid combinations (e.g. body on GET with content-type conflict) show validation feedback before save.

#### FR-12: Edit request in raw `.http` editor

Developer can edit the JetBrains `.http` text directly. Realizes UJ-2.

**Consequences (testable):**
- Syntax highlighting for `.http` format in the editor.
- Parse errors from raw edits display inline without crashing the UI.

#### FR-13: Persist edits to disk

Developer can save changes from the editor back to the source `.http` file on disk. Realizes UJ-2.

**Consequences (testable):**
- Save writes atomically (temp file + rename) to avoid partial writes.
- Saved file remains valid JetBrains `.http` syntax for constructs in MVP scope.
- Formatting preservation: existing comments and blank lines outside edited Request blocks are preserved `[ASSUMPTION: minimal-diff write strategy — details in addendum]`.

**Out of Scope:**
- Creating new `.http` files from scratch in MVP `[ASSUMPTION: edit-only for existing files in MVP; create-new is fast-follow if time permits]`.

---

### 4.7 Environment and Secrets

**Description:** Developer manages Environments and secret values locally for variable resolution. Realizes UJ-3.

**Functional Requirements:**

#### FR-14: Select active environment

Developer can select one active Environment from the Web UI. Realizes UJ-3.

**Consequences (testable):**
- Active Environment persists for the session until changed.
- Environment name visible in the request toolbar when set.

#### FR-15: Load secrets from local env files

Local Server resolves secrets from `.env` or JetBrains environment files without transmitting them to the browser after initial setup `[ASSUMPTION: secrets entered via UI stored in local server-side vault file under `.reqor/` in repo or user home]`. Realizes UJ-3.

**Consequences (testable):**
- Secret values masked in UI fields.
- Secret values never appear in History Entry bodies or exported snippets.

---

### 4.8 Request History

**Description:** Local Server persists a history of sent Requests and Responses for debugging within the session and across restarts. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-16: Record request history

Each sent Request creates a History Entry with timestamp, Environment, method, URL, status code, and duration. Realizes UJ-3.

**Consequences (testable):**
- Developer can browse History Entries chronologically.
- Developer can re-open a History Entry to populate the editor.
- History stores last 500 entries per Repository Root `[ASSUMPTION: local SQLite or JSON file under .reqor/]`.
- Response bodies over 1MB truncated in history with option to view full body from truncated marker.

**Out of Scope:**
- Cloud-synced history (post-MVP).

---

### 4.9 cURL Import and Export

**Description:** Developer can paste cURL commands to create/edit Requests and export any Request as cURL. Realizes UJ-1.

**Functional Requirements:**

#### FR-17: Import request from cURL

Developer can paste a cURL command and convert it to a Request in the editor. Realizes UJ-1.

**Consequences (testable):**
- Supports common cURL flags: `-X`, `-H`, `-d`, `--data-raw`, `--json`, `-u` (basic auth).
- Unsupported cURL options show warning but import partial Request.

#### FR-18: Export request as cURL

Developer can copy the current Request as a cURL command. Realizes UJ-1.

**Consequences (testable):**
- Exported cURL executes equivalently when run in terminal against the same Environment (variables substituted).

---

### 4.10 Code Snippet Export

**Description:** Developer exports the current Request as code snippets for common languages. Realizes UJ-1.

**Functional Requirements:**

#### FR-19: Export code snippets

Developer can copy Request as code snippet in JavaScript (`fetch`), Python (`requests`), and cURL. Realizes UJ-1.

**Consequences (testable):**
- Snippet includes method, URL, headers, and body.
- Secret values replaced with placeholder comments in exported snippets.

**Out of Scope:**
- Additional languages beyond JS, Python, cURL in MVP `[ASSUMPTION: Go, Java fast-follow]`.

---

## 5. Non-Goals (Explicit)

- Postman collection import (post-MVP fast-follow).
- VS Code REST Client dialect support (post-MVP).
- Reqor Cloud hosted deployment (post-MVP).
- Desktop app (Electron/Tauri — post-MVP).
- Mock servers, API design, OpenAPI authoring.
- GraphQL, gRPC, WebSocket, or any non-HTTP protocol.
- Team accounts, SSO, or role-based access control.
- CI/CD integration or headless CLI request runner (post-MVP).
- Automatic filesystem watch / hot reload of `.http` files.

---

## 6. MVP Scope

### 6.1 In Scope

- Node.js Local Server + React Web UI
- `reqor serve` CLI with browser launch
- Recursive `.http` file discovery and manual refresh
- JetBrains dialect parser (core constructs — see addendum matrix)
- HTTP proxy execution with environment variable resolution
- Visual + raw `.http` editor with save-to-disk
- Local Environments and secrets
- Request history (local persistence)
- cURL import/export
- Code snippet export (JavaScript, Python, cURL)
- 8-week delivery target for local-only MVP

### 6.2 Out of Scope for MVP

| Item | Reason |
|------|--------|
| Postman import | Cut to hold 8-week line; fast-follow |
| VS Code dialect | Cut to focus parser quality on JetBrains |
| Reqor Cloud | Validate local adoption first |
| Filesystem watch | Manual refresh sufficient for MVP |
| Create-new `.http` files in UI | Edit-only reduces scope; fast-follow if time |
| Advanced JetBrains scripting | High complexity; post-MVP |

---

## 7. Success Metrics

**Primary**

- **SM-1:** Time-to-first-request ≤ 60 seconds from `reqor serve` on a repo with existing JetBrains `.http` files (measured in user testing). Validates FR-1, FR-3, FR-5, FR-8, FR-10.
- **SM-2:** JetBrains parser compatibility ≥ 90% on a curated fixture set of 50 real-world `.http` files from open-source repos (measured by automated parse test suite). Validates FR-5, FR-6, FR-7.

**Secondary**

- **SM-3:** 100 GitHub stars within 30 days of public launch. Validates overall product-market fit signal.
- **SM-4:** Developer completes UJ-2 (edit + git diff + clean save) without manual file repair in 3/3 test sessions. Validates FR-12, FR-13.

**Counter-metrics (do not optimize)**

- **SM-C1:** Feature count — do not add protocols or platform features to inflate capability; scope creep is failure. Counterbalances SM-3.
- **SM-C2:** npm download count before parser test suite passes SM-2 — do not promote until parser quality gate met. Counterbalances SM-3.

---

## 8. Open Questions

1. Final JetBrains dialect support matrix for MVP constructs (target: week 4).
2. Bidirectional save formatting strategy — minimal-diff vs full-formatter.
3. `@reqor/cli` npm package name availability and publication namespace.
4. OSS license: MIT vs Apache 2.0.
5. Secret storage location: `.reqor/` in repo vs user home directory — default behavior.
6. Should MVP allow creating new `.http` files, or edit-only?
7. Default port conflict behavior — auto-increment port or fail fast?

---

## 9. Assumptions Index

- §3 Repository Root — recursive scan excluding node_modules/.git; honors .gitignore where present.
- §4.3 FR-6 — JetBrains dynamic variable subset for MVP ($uuid, $timestamp, $randomInt).
- §4.3 FR-7 — Environment file conventions follow JetBrains `http-client.env.json` pattern.
- §4.6 FR-13 — Minimal-diff write strategy for disk persistence.
- §4.6 FR-13 — MVP is edit-only for existing `.http` files (create-new deferred).
- §4.7 FR-15 — Secrets stored in `.reqor/` local vault.
- §4.8 FR-16 — History capped at 500 entries; stored locally under `.reqor/`.
- §4.4 FR-8 — Redirect following enabled by default with per-request toggle.
- §4.10 FR-19 — Only JavaScript, Python, cURL snippet languages in MVP.

---

## 10. Cross-Cutting NFRs

**Performance**
- Web UI initial load ≤ 2 seconds on localhost after server start.
- Request send UI feedback (loading state) appears within 100ms of click.

**Security**
- No telemetry or outbound network calls from Local Server except proxied user Requests and optional update check disabled by default `[ASSUMPTION]`.
- Secrets never written to history, logs, or exported snippets in plaintext.

**Reliability**
- Local Server recovers from single request failure without crashing the process.
- Parser errors isolated per file — one bad `.http` file does not block others.

**Accessibility**
- Web UI keyboard-navigable for collection selection and send action `[ASSUMPTION: WCAG 2.1 AA not required for MVP dev tool; basic keyboard support required]`.

---

## 11. Why Now

Postman's 2026 pricing changes pushed small teams off free collaboration tiers, creating active migration to lightweight alternatives. No incumbent owns web-first + open-source + REST-only + JetBrains `.http`-native. Teams already committing `.http` files to Git need a browser UI without format migration (Bruno `.bru`) or multi-protocol bloat (Hoppscotch).

---

## 12. Platform

- **v1 surfaces:** Web UI in browser + Node.js Local Server (CLI).
- **Deployment model:** Local only — developer machine.
- **Post-MVP surfaces:** Reqor Cloud (hosted), desktop app, VS Code dialect, Postman import.

Technical implementation: see `addendum.md`.
