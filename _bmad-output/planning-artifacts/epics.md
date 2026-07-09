---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prds/prd-reqor-2026-07-08/prd.md
  - architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md
  - architecture/architecture-reqor-2026-07-08/solution-design.md
  - ux-designs/ux-reqor-2026-07-08/DESIGN.md
  - ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md
  - ../specs/spec-reqor/SPEC.md
---

# reqor - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for reqor, decomposing the requirements from the PRD, UX Design, Architecture, Solution Design, and SPEC into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Start local server from CLI — Developer can run `reqor serve [path]` (or `npx @reqor/cli serve [path]`) where `[path]` defaults to the current working directory. Local Server listens on `localhost` on a configurable port defaulting to `3000`. On successful start, CLI prints the URL and optionally opens the system default browser. Process exits with non-zero code and readable error if the port is unavailable or path does not exist.

FR2: Serve Web UI from Local Server — Local Server serves the built React Web UI as static assets from the same origin as the API. Navigating to `http://localhost:3000` loads the Web UI without requiring a separate dev server in production mode. Web UI can call Local Server REST endpoints without CORS errors.

FR3: Discover `.http` files in repository — Local Server scans the Repository Root recursively for files with extension `.http` and registers each as a Collection. Each discovered file appears in the Web UI collection list with a name derived from the file path relative to Repository Root. Scan excludes `.git`, `node_modules`, and honors `.gitignore` where present. Empty repository shows an empty state with guidance to add a `.http` file.

FR4: Manual collection refresh — Developer can trigger a re-scan of `.http` files from the Web UI without restarting the Local Server. After refresh, newly added files appear; deleted files disappear; modified files reload content. Refresh completes within 3 seconds for repositories containing up to 100 `.http` files on a typical dev machine.

FR5: Parse JetBrains HTTP requests — Parser extracts Requests from a `.http` file including HTTP method, URL, headers, and body for JetBrains syntax. Supports GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS request lines; multiple Requests separated by `###` delimiter; query parameters in URL and as separate lines. Parse errors report file path, line number, and human-readable message in the Web UI — no silent skip.

FR6: Parse JetBrains variables in requests — Parser recognizes JetBrains variable placeholders in URLs, headers, and bodies (e.g. `{{host}}`, `{{$uuid}}`). Unresolved variables at send time are flagged before the Request is sent, with the variable name identified. Built-in JetBrains dynamic variables in MVP scope: `$uuid`, `$timestamp`, `$randomInt`, `{{$dotenv KEY}}`.

FR7: Parse JetBrains environment files — Parser loads Environment definitions from JetBrains-style environment files (e.g. `http-client.env.json`). Web UI lists available Environments by name. Selecting an Environment makes its variables available for resolution at send time.

FR8: Execute HTTP request via proxy — Developer can send a Request from the Web UI; Local Server performs the HTTP call and returns status, headers, body, and timing to the Web UI. Supports `http://` and `https://` target URLs including `localhost` endpoints. Response body renders with syntax highlighting for JSON, XML, and plain text. Response time (ms) displayed for each executed Request. Local Server follows redirects by default (max 10 hops); developer can disable redirect following per request via toggle defaulting to follow.

FR9: Resolve environment variables at send time — When an Environment is active, Local Server resolves JetBrains variables before sending the Request. Resolved URL and headers are visible in a pre-send preview (secrets redacted). Missing required variables block send with a clear error naming the variable.

FR10: Browse collections and requests — Developer can view all Collections and expand to select individual Requests. Sidebar shows Collection hierarchy mirroring file paths. Selecting a Request loads its details in the main editor panel. UI remains usable at 1280px viewport width minimum.

FR11: Edit request in visual editor — Developer can modify method, URL, headers, and body via form fields. Changes in visual editor update the raw `.http` representation shown in the editor. Invalid combinations (e.g. body on GET with content-type conflict) show validation feedback before save.

FR12: Edit request in raw `.http` editor — Developer can edit the JetBrains `.http` text directly. Syntax highlighting for `.http` format in the editor. Parse errors from raw edits display inline without crashing the UI.

FR13: Persist edits to disk — Developer can save changes from the editor back to the source `.http` file on disk. Save writes atomically (temp file + rename) to avoid partial writes. Saved file remains valid JetBrains `.http` syntax for constructs in MVP scope. Formatting preservation: existing comments and blank lines outside edited Request blocks are preserved via minimal-diff write strategy; full-file rewrite fallback surfaces warning on patch failure. MVP is edit-only for existing files (no create-new from UI).

FR14: Select active environment — Developer can select one active Environment from the Web UI. Active Environment persists across restarts (stored in `.reqor/config.json`). Environment name visible in the request toolbar when set.

FR15: Load secrets from local env files — Local Server resolves secrets from repo `.env` file variants (`.env`, `.env.local`, `.env.staging`, etc.) that users already maintain and gitignore. Reqor reads these files; it never writes to them. Secret values masked in UI fields. Secret values never appear in History Entry bodies, logs, or exported snippets.

FR16: Record request history — Each sent Request creates a History Entry with timestamp, Environment, method, URL, status code, and duration. Developer can browse History Entries chronologically (newest first). Developer can re-open a History Entry to populate the editor (replay without auto-send). History stores last 500 entries per Repository Root in `.reqor/history.db`. Response bodies over 1MB truncated in list/detail with expand-to-full action via `GET /api/history/:id`.

FR17: Import request from cURL — Developer can paste a cURL command and convert it to a Request in the editor draft (without saving to disk). Supports common cURL flags: `-X`, `-H`, `-d`, `--data-raw`, `--json`, `-u` (basic auth). Unsupported cURL options show warning but import partial Request.

FR18: Export request as cURL — Developer can copy the current Request as a cURL command. Exported cURL executes equivalently when run in terminal against the same Environment (variables substituted; secrets redacted).

FR19: Export code snippets — Developer can copy Request as code snippet in JavaScript (`fetch`), Python (`requests`), and cURL. Snippet includes method, URL, headers, and body. Secret values replaced with placeholder comments in exported snippets.

### NonFunctional Requirements

NFR1: Web UI initial load ≤ 2 seconds on localhost after server start.

NFR2: Request send UI feedback (loading state) appears within 100ms of click.

NFR3: Collection refresh completes within 3 seconds for repositories containing up to 100 `.http` files.

NFR4: Local Server starts and is ready within 5 seconds (CLI prints URL; browser opens).

NFR5: No telemetry or outbound network calls from Local Server except user-initiated proxied HTTP requests. Update check disabled by default.

NFR6: Secrets never written to history, logs, API responses, or exported snippets in plaintext.

NFR7: Local Server recovers from single request failure without crashing the process.

NFR8: Parser errors isolated per file — one bad `.http` file does not block others from loading.

NFR9: Web UI keyboard-navigable for collection selection, request send, and save action. WCAG 2.1 AA not required for MVP; basic keyboard floor required.

NFR10: JetBrains parser compatibility ≥ 90% on a curated fixture set of 50 real-world `.http` files (SM-2 gate before public promotion).

NFR11: Time-to-first-request ≤ 60 seconds from `reqor serve` on a repo with existing JetBrains `.http` files (SM-1).

NFR12: Local Server binds localhost only; no remote network access to the Reqor API.

NFR13: Port conflict triggers non-zero exit with readable message — fail-fast, no auto-increment port.

NFR14: UJ-2 edit + git diff + clean save completes without manual file repair in 3/3 test sessions (SM-4).

### Additional Requirements

- **Starter template (Epic 1 Story 1):** Scaffold monorepo using pnpm 11.x workspaces + Turborepo 2.x. Packages at `packages/cli`, `packages/server`, `packages/web`, `packages/http-parser`, `packages/shared-types`. Solution design suggests `pnpm dlx create-turbo@latest` then reshape to packages-only layout (drop default `apps/` scaffold).

- **Node.js engine pin:** `engines.node` requires `>=24 <25` (Active LTS Krypton). CI and local dev target Node 24.x.

- **Package dependency direction (strict):** Allowed edges only: `cli → server`; `server → http-parser, shared-types`; `web → shared-types`. `http-parser` has zero runtime dependency on `server` or `web`. Internal deps use `workspace:` protocol; shared versions in pnpm catalogs.

- **Thin-Client Local BFF paradigm:** Browser is presentation only. Web UI must not call target URLs directly. All HTTP execution goes through Local Server proxy using Node native `fetch`.

- **Parser isolation (AD-3):** `@reqor/http-parser` is sole owner of JetBrains `.http` parse, AST, and serialize. Server consumes parser output; Web receives typed DTOs via API only — no native `.http` parsing in browser.

- **Disk is source of truth (AD-4):** Canonical state lives in `.http` files on disk. UI holds draft state until explicit save. MVP edit-only for existing files.

- **Minimal-diff disk writes (AD-5):** Persist edits by patching affected Request node in parser AST and serializing with formatting preservation. On patch failure, fall back to full-file rewrite and surface warning to user.

- **Single Fastify 5.x runtime (AD-9):** One Node.js process hosts REST API, static Web UI assets, and HTTP proxy via Fastify plugins. Default port 3000.

- **Typed Web↔Server API contract (AD-10):** REST endpoints use TypeBox 0.34.x schemas defined in `shared-types`. Server validates inbound requests. Web uses TanStack Query 5.x for server state.

- **Collection scan rules (AD-11):** On server start and manual refresh, recursively scan Repository Root for `*.http`. Honor `.gitignore` when present; always exclude `node_modules` and `.git`.

- **Local state in `.reqor/` (AD-12):** Runtime-local artifacts: `history.db`, `config.json` only (no secrets vault per SPEC). Directory gitignored; CLI ensures ignore entry on first run.

- **History in SQLite (AD-13):** `.reqor/history.db` via `better-sqlite3` 12.x. Cap at 500 entries. Truncate response bodies over 1MB in stored history display; full body retrievable via detail endpoint.

- **CLI distribution (AD-14):** Publish `@reqor/cli` with `reqor` bin. Package bundles built `server` + `web` dist. Support `npx @reqor/cli serve [path]`. MIT license.

- **JetBrains MVP dialect scope (AD-17):** IN/OUT matrix in `dialect-matrix.md` is authoritative. OUT constructs return explicit unsupported diagnostics, not silent skip.

- **Editor modes and save path (AD-18):** Visual editor mutates structured Request DTOs from server. Raw editor mutates full file text. Mode switch sends current draft to server for re-parse before display update. Save accepts full file `content` only; server runs parse → minimal-diff serialize internally. Web never serializes `.http` text.

- **HTTP redirect policy (AD-19):** Proxy follows redirects by default (max 10 hops). `POST /api/execute` accepts optional `followRedirects: boolean` per request.

- **Environment and secret ownership (SPEC supersedes AD-20 on vault):** Parser parses `http-client.env.json` and recognizes `{{$dotenv KEY}}`. Server `EnvResolver` owns merge at send time: active environment file → repo `.env` variants. Secrets read-only from existing gitignored `.env` files; no `.reqor/secrets.env` vault.

- **Request identity and rematch (AD-21):** API uses `requestIndex` (0-based parse order) for execute/save within a collection. Each Request DTO includes `fingerprint` = hash(method + urlTemplate). On collection reload, web rematches selection and history replay by `collectionId` + `fingerprint`.

- **Parser AST to API DTO mapping (AD-22):** Parser exports internal AST types consumed only by server. `shared-types` defines API DTOs. Server implements explicit `toDto()` mapper; web imports DTOs only.

- **Active environment persistence (AD-23):** Active environment name persists in `.reqor/config.json`. Server loads on start; web reads/writes via API.

- **History body retention (AD-24):** History stores full response body on disk; list/detail DTOs truncate display at 1MB. `GET /api/history/:id` returns full body.

- **REST API surface (MVP):** Base URL `http://localhost:3000/api`. Endpoints: `GET /collections`, `GET /collections/:id`, `POST /collections/refresh`, `PUT /collections/:id`, `GET /environments`, `POST /execute`, `GET /history`, `GET /history/:id`, `POST /import/curl`, `GET /export/curl/:requestId`, `GET /export/snippet/:requestId`. Error envelope: `{ error: { code, message, details? } }`.

- **Stack versions:** TypeScript 5.9.x, React 19.x, Vite 6.x, Vitest 3.x for testing.

- **Parser test strategy:** Curated 50-file fixture corpus; round-trip tests (parse → serialize → parse); minimal-diff tests (edit one request → only that block's lines change).

- **Build/CI:** Node 24, `pnpm turbo build test`. No deploy target; npm publish only.

- **Dev vs prod modes:** `pnpm turbo dev` — Vite HMR (:5173) proxies to Fastify (:3000). `reqor serve` — single process serves API + static dist from same origin.

- **Data conventions:** Collection id = repo-relative `.http` path (POSIX separators). Timestamps ISO-8601 UTC. Logging via Pino via Fastify; never log secret values.

- **8-week build order (solution design):** Weeks 1–3 http-parser + fixtures; Week 4 server scan + parse API; Week 5 proxy + env resolver; Week 6 web browse + send; Week 7 editor + save + history; Week 8 CLI packaging, cURL, snippets, docs.

### UX Design Requirements

UX-DR1: Implement Swagger UI–inspired design token system — colors, typography (body 14px, label 12px semibold, mono 13px, app-title 16px), spacing (header 48px, sidebar 280px, inset 12px), rounded corners (sm 2px, md 4px, lg 6px) — as CSS/Tailwind variables per DESIGN.md frontmatter.

UX-DR2: App header component — 48px dark bar (`#1B1B1B` / white text). Left: "Reqor" app title. Right: environment selector dropdown only. No menu bar, global search, sign-in, or notifications.

UX-DR3: Fixed three-pane layout at 1280px minimum viewport — 280px sidebar, main workspace fills remainder. Vertically split request panel (top) and response panel (bottom). Pane gaps 0 with 1px border dividers only.

UX-DR4: Resizable request/response vertical split with drag handle; default 50/50 ratio.

UX-DR5: Sidebar tabs component (Collections | History) — text tabs with underline active state (`#4990E2`), no background fill. Mutually exclusive. Each tab preserves independent search query and scroll position.

UX-DR6: Contextual search input below active sidebar tab — full-width, `{rounded.md}` border. Placeholder "Filter collections…" or "Filter history…". Filters only active tab's list (collections: paths/request names; history: method/URL/status).

UX-DR7: Collection tree component — one node per `.http` file with expand/collapse; children are requests with method-colored mini-badge. Parse-error file: red error badge; expanding reveals line number and message. Click request loads request workspace.

UX-DR8: Refresh collections action in Collections tab header — triggers `POST /api/collections/refresh` with inline spinner; no auto-watch.

UX-DR9: History list component — newest first. Row: method badge + truncated URL + timestamp + status code + duration + environment name. Status uses success green (2xx) or error red (4xx/5xx). Click replays into editor without auto-send.

UX-DR10: Request line component — method dropdown (method-colored when open), mono URL input, Send button (primary `#4990E2`), Save button (secondary, visible/enabled only when draft dirty). Send disabled when unresolved variables exist.

UX-DR11: Request sub-tabs — underline style matching sidebar tabs: Params, Headers (count badge), Body, Raw `.http`. Visual and Raw share one draft with bidirectional sync; switching tabs does not discard edits.

UX-DR12: Response viewer component — inline status bar in response panel header: `{code} {statusText} · {ms} ms · {bytes} B`. Body and Headers sub-tabs. Mono body in surface background with JSON/XML/plain syntax highlighting.

UX-DR13: HTTP method badge colors — Swagger palette only for HTTP verbs: GET `#61AFFE`, POST `#49CC90`, PUT `#FCA130`, PATCH `#50E3C2`, DELETE `#F93E3E`, HEAD `#9012FE`, OPTIONS `#0D5AA7`. Never repurposed for non-HTTP semantics.

UX-DR14: Secret field component — masked value as `••••••` in secret-masked gray (`#C4C4C4`); never shows plaintext after server resolution.

UX-DR15: Empty state components — centered muted text (`#777777`), one line of guidance, no illustration. Variants: no `.http` files (with Refresh button), "Select a request" workspace placeholder.

UX-DR16: Cold load skeleton — 4–6 skeleton rows in sidebar while `GET /api/collections` pending; request workspace shows "Select a request" placeholder.

UX-DR17: Interaction state treatments — parse error badge on file node; unresolved variable inline error naming variable; Send spinner within 100ms; save success inline "Saved to {path}"; save failure banner for read-only; full-file rewrite amber warning; history truncated body with expand action.

UX-DR18: cURL import modal — textarea paste; parses common flags; warns on unsupported; populates draft without disk save. Semi-transparent overlay (`rgba(0,0,0,0.4)`) with white card, no drop shadow.

UX-DR19: Snippet export popover — tabs for JavaScript (fetch), Python (requests), cURL; copy-to-clipboard; secrets as `/* SECRET */` placeholder comments.

UX-DR20: Pre-send preview — inline collapsible below request line (not modal) when variables present; shows resolved URL and headers with secrets redacted.

UX-DR21: Keyboard interaction primitives — ↑/↓ navigate sidebar when focused; Enter select/replay; Ctrl+Enter (⌘+Enter) send; Ctrl+S (⌘+S) save; Tab through DOM order; Esc closes modal/popover/confirm dialog.

UX-DR22: Accessibility floor — all interactive elements reachable via Tab; Send and Save visible focus rings (primary 2px outline); parse errors and unresolved-variable errors include text (variable name / line number), not color-only; method badges include text label; screen reader labels on icon-only buttons (Refresh, Import, Export).

UX-DR23: Flat elevation — no shadows in MVP. Depth via background tone (`background` vs `surface`) and 1px borders only. Modals use overlay + white card without drop shadow.

UX-DR24: Developer microcopy voice — direct, no marketing fluff. Use prescribed phrasing: "No .http files found. Add one to the repo and refresh.", "Unresolved variable: {{host}}", "Saved to auth.http", "Parse error at line 14", "Secret value hidden".

UX-DR25: Explicit MVP absences — no global top search, bottom status bar, right-side utility rail, notification banners, account/sign-in flows, create-new `.http` file UI, dark mode, drag-and-drop reorder, right-click context menus, infinite scroll in history (paginate or virtual-scroll at 500 cap).

UX-DR26: Navigate-away confirm dialog when draft is dirty and user selects different request or collection without saving.

### FR Coverage Map

FR1: Epic 1 — CLI start local server
FR2: Epic 1 — Serve Web UI from Local Server
FR3: Epic 1 — Discover `.http` files in repository
FR4: Epic 1 — Manual collection refresh
FR5: Epic 1 — Parse JetBrains HTTP requests
FR6: Epic 2 — Parse JetBrains variables in requests
FR7: Epic 2 — Parse JetBrains environment files
FR8: Epic 1 — Execute HTTP request via proxy
FR9: Epic 2 — Resolve environment variables at send time
FR10: Epic 1 — Browse collections and requests
FR11: Epic 3 — Edit request in visual editor
FR12: Epic 3 — Edit request in raw `.http` editor
FR13: Epic 3 — Persist edits to disk
FR14: Epic 2 — Select active environment
FR15: Epic 2 — Load secrets from local env files
FR16: Epic 4 — Record request history
FR17: Epic 5 — Import request from cURL
FR18: Epic 5 — Export request as cURL
FR19: Epic 5 — Export code snippets

## Epic List

### Epic 1: Launch and Send Your First Request
Developer runs `reqor serve` on a repo with existing `.http` files, browses collections in the browser, sends a request, and sees the response — no IDE, no import, no account. (Alex / UJ-1)
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR8, FR10

### Epic 2: Environments and Secrets
Developer selects an environment, resolves variables and secrets from `http-client.env.json` and `.env` variants, previews the resolved request with secrets redacted, and sends confidently to staging or dev targets. (Marcus / UJ-3)
**FRs covered:** FR6, FR7, FR9, FR14, FR15

### Epic 3: Edit and Save to Git
Developer edits requests in visual or raw `.http` editor, saves atomically to disk with minimal-diff formatting, and produces clean `git diff` output for PR review. (Priya / UJ-2)
**FRs covered:** FR11, FR12, FR13

### Epic 4: Request History and Replay
Developer browses chronological send history, replays past requests into the editor, and inspects truncated large responses — history survives server restart.
**FRs covered:** FR16

### Epic 5: Import, Export, and Share
Developer pastes cURL to populate the editor, exports requests as cURL or code snippets (JS/Python/cURL) with secrets redacted — for sharing and terminal use.
**FRs covered:** FR17, FR18, FR19

## Epic 1: Launch and Send Your First Request

Developer runs `reqor serve` on a repo with existing `.http` files, browses collections in the browser, sends a request, and sees the response — no IDE, no import, no account.

### Story 1.1: Scaffold Monorepo and Development Toolchain

As a **developer building Reqor**,
I want a pnpm + Turborepo monorepo with all five packages wired together,
So that the team has a consistent build substrate for CLI, server, web, parser, and shared types.

**Acceptance Criteria:**

**Given** a fresh clone of the reqor repository
**When** I run `pnpm install` with Node 24.x
**Then** all packages resolve: `packages/cli`, `packages/server`, `packages/web`, `packages/http-parser`, `packages/shared-types`
**And** dependency edges follow AD-2: `cli → server`; `server → http-parser, shared-types`; `web → shared-types`; `http-parser` has no server/web deps
**And** `pnpm turbo build` and `pnpm turbo test` execute across the workspace
**And** `pnpm turbo dev` starts Vite (:5173) proxying API to Fastify (:3000)
**And** root `package.json` pins `engines.node` to `>=24 <25`
**And** shared dependency versions use pnpm catalogs

### Story 1.2: JetBrains Request Parser with Fixture Test Suite

As a **backend developer with `.http` files in my repo**,
I want Reqor to parse JetBrains HTTP request syntax reliably,
So that my existing request files load without silent errors or data loss.

**Acceptance Criteria:**

**Given** a `.http` file with JetBrains syntax
**When** `@reqor/http-parser` parses it
**Then** it extracts method, URL, headers, body, and query params for GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
**And** multiple requests separated by `###` are parsed as distinct Request nodes
**And** parse errors return `{ file, line, message }` diagnostics — no silent skip
**And** OUT constructs per `dialect-matrix.md` return explicit unsupported diagnostics
**And** a curated fixture suite of 50 real-world `.http` files achieves ≥90% parse pass rate (SM-2 / NFR10)
**And** round-trip tests (parse → serialize → parse) produce equivalent AST for IN-scope constructs
**And** parser has zero runtime dependency on server or web (AD-3)

### Story 1.3: Collection Scan and REST API

As a **developer running Reqor against my repository**,
I want the Local Server to discover and expose all `.http` files as collections via REST API,
So that the Web UI can list my request files without reading disk directly.

**Acceptance Criteria:**

**Given** a Repository Root containing `.http` files in subdirectories
**When** the Local Server starts or receives `POST /api/collections/refresh`
**Then** it recursively scans for `*.http` files excluding `node_modules`, `.git`, and paths in `.gitignore`
**And** `GET /api/collections` returns each file as a Collection with repo-relative path as id and parse status
**And** `GET /api/collections/:id` returns collection detail with Request DTOs including `requestIndex` and `fingerprint` (AD-21)
**And** parse errors on one file do not block other collections from loading (NFR8)
**And** refresh completes within 3 seconds for up to 100 `.http` files (NFR3)
**And** server maps parser AST to API DTOs via explicit `toDto()` in shared-types (AD-22)
**And** error responses use `{ error: { code, message, details? } }` envelope

### Story 1.4: CLI Start and Web UI Static Serve

As a **developer on a fresh laptop**,
I want to run one command that starts Reqor and opens my browser,
So that I can reach the Web UI in under 60 seconds without separate dev servers.

**Acceptance Criteria:**

**Given** I run `reqor serve [path]` or `npx @reqor/cli serve [path]` where `[path]` defaults to cwd
**When** the path exists and port 3000 is available
**Then** a single Fastify process starts within 5 seconds (NFR4) binding localhost only (NFR12)
**And** CLI prints the URL and opens the system default browser
**And** navigating to `http://localhost:3000` serves the built React SPA from the same origin (FR2)
**And** Web UI API calls succeed without CORS errors (AD-6)
**When** port 3000 is in use
**Then** the process exits non-zero with a readable error — no auto-increment (NFR13)
**When** the path does not exist
**Then** the process exits non-zero with a readable error
**And** on first run CLI creates `.reqor/` and adds it to `.gitignore` (AD-12)
**And** `@reqor/cli` bundles built server + web dist for `npx` distribution (AD-14)

### Story 1.5: App Shell and Design System Tokens

As a **developer using Reqor in the browser**,
I want a Swagger-inspired app shell with consistent design tokens,
So that the UI feels like a professional developer tool with minimal chrome.

**Acceptance Criteria:**

**Given** I open `http://localhost:3000`
**When** the app loads
**Then** initial render completes within 2 seconds on localhost (NFR1)
**And** the layout implements UX-DR1: Swagger palette, typography (body 14px, label 12px, mono 13px, app-title 16px), spacing, rounded corners as CSS/Tailwind variables
**And** UX-DR2: 48px dark header (`#1B1B1B`) shows "Reqor" left-aligned only — no menu, search, sign-in, or notifications
**And** UX-DR3: fixed three-pane layout at 1280px minimum — 280px sidebar, main workspace with request/response vertical split
**And** UX-DR4: resizable split with drag handle defaulting to 50/50
**And** UX-DR23: flat elevation — borders only, no shadows; modal overlay pattern defined
**And** UX-DR25 absences enforced: no global search, bottom status bar, RHS rail, notifications, account flows, dark mode
**And** cold load shows UX-DR16 skeleton (4–6 sidebar rows) and "Select a request" placeholder until collections load

### Story 1.6: Collections Sidebar and Request Navigation

As a **developer browsing my repository's API requests**,
I want a sidebar tree of `.http` files and their requests with search and refresh,
So that I can quickly find and select the request I need to send.

**Acceptance Criteria:**

**Given** collections are loaded from `GET /api/collections`
**When** I view the Collections tab (UX-DR5)
**Then** sidebar shows one node per `.http` file with expand/collapse and method-colored mini-badges per request (UX-DR7, UX-DR13)
**And** clicking a request loads its details in the request workspace (FR10)
**And** contextual search filters file paths and request names within Collections tab only (UX-DR6)
**And** Refresh action triggers `POST /api/collections/refresh` with inline spinner (UX-DR8, FR4)
**And** parse-error files show red badge; expanding reveals "Line {N}: {message}" (UX-DR17)
**And** empty repo shows "No .http files found. Add one to the repo and refresh." with Refresh button (UX-DR15, UX-DR24)
**And** `↑`/`↓` + Enter navigate and select when sidebar focused (UX-DR21)
**And** switching Collections/History tabs preserves independent search and scroll state (UX-DR5)

### Story 1.7: HTTP Proxy Execution and Response Panel

As a **developer testing a local or remote API**,
I want to send the selected request and inspect the full response in the browser,
So that I can verify endpoints without Postman or an IDE.

**Acceptance Criteria:**

**Given** a request is loaded in the workspace
**When** I click Send or press Ctrl+Enter (UX-DR21)
**Then** loading state appears within 100ms (NFR2) and `POST /api/execute` proxies the HTTP call via Local Server (FR8, AD-6)
**And** response panel shows inline status bar: `{code} {statusText} · {ms} ms · {bytes} B` (UX-DR12)
**And** response body renders with JSON/XML/plain syntax highlighting in mono font on surface background
**And** response Headers sub-tab shows response headers
**And** proxy supports `http://` and `https://` including localhost targets
**And** redirect following is enabled by default with max 10 hops; per-request toggle exposed defaulting to true (AD-19)
**When** the target API is unreachable or returns an error
**Then** response panel shows error detail and the server process remains running (NFR7)
**And** request line shows method dropdown, mono URL field, Send primary button `#4990E2` (UX-DR10)
**And** Send and Save have visible 2px primary focus rings (UX-DR22)
**And** Local Server makes no outbound calls except proxied user requests (NFR5)

## Epic 2: Environments and Secrets

Developer selects an environment, resolves variables and secrets from `http-client.env.json` and `.env` variants, previews the resolved request with secrets redacted, and sends confidently to staging or dev targets.

### Story 2.1: Variable and Dynamic Placeholder Parsing

As a **developer using JetBrains variable syntax in my `.http` files**,
I want Reqor to recognize variable placeholders and dynamic generators,
So that my existing templated requests parse correctly.

**Acceptance Criteria:**

**Given** a `.http` file containing `{{host}}`, `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, or `{{$dotenv KEY}}`
**When** the parser processes the file
**Then** placeholders are recognized in URLs, headers, and bodies (FR6)
**And** `$uuid`, `$timestamp`, `$randomInt` are supported per dialect-matrix IN scope
**And** `{{$dotenv KEY}}` references are recognized for server-side resolution (FR6)
**And** parser unit tests cover each dynamic variable type

### Story 2.2: Environment File Parsing and Listing

As a **developer with JetBrains environment definitions**,
I want Reqor to load my environment files and list available environments,
So that I can target dev, staging, or production configurations.

**Acceptance Criteria:**

**Given** a repository containing `http-client.env.json` (or equivalent JetBrains env file)
**When** the Local Server starts
**Then** `@reqor/http-parser` extracts named Environment definitions (FR7)
**And** `GET /api/environments` returns environment names and variable keys (secrets flagged, values redacted)
**And** environment list populates the header environment selector dropdown (UX-DR2)

### Story 2.3: Environment Selection with Persistence

As a **developer switching between dev and staging**,
I want my active environment selection to persist across server restarts,
So that I don't re-select staging every time I open Reqor.

**Acceptance Criteria:**

**Given** multiple environments are available
**When** I select an environment from the header dropdown (FR14)
**Then** the active environment name displays in the request toolbar
**And** selection persists to `.reqor/config.json` via server API (AD-23)
**And** on server restart the previously selected environment is restored automatically

### Story 2.4: Secret Resolution from `.env` Variants

As a **developer with secrets in gitignored `.env` files**,
I want Reqor to resolve secrets server-side without exposing them in the browser,
So that I can authenticate against staging APIs safely.

**Acceptance Criteria:**

**Given** repo contains `.env`, `.env.local`, or `.env.staging` with secret values
**When** the server resolves `{{$dotenv KEY}}` at send time
**Then** values are read from existing `.env` variants — Reqor never writes to these files (FR15, SPEC)
**And** secret values display as `••••••` in secret-masked gray `#C4C4C4` in UI fields (UX-DR14)
**And** API responses redact secret values — never return plaintext to browser (AD-7)
**And** secrets never appear in logs at any level (NFR6)
**And** no `.reqor/secrets.env` vault is created (SPEC override)

### Story 2.5: Send-Time Variable Resolution and Pre-Send Preview

As a **developer sending requests with environment variables**,
I want unresolved variables blocked and resolved values previewed before send,
So that I know exactly what request will hit the wire.

**Acceptance Criteria:**

**Given** an active environment is selected
**When** I load a request containing `{{host}}` or other variables
**Then** server resolves variables immediately before proxy execution (FR9, AD-8)
**And** merge order is: active environment file → repo `.env` variants (AD-20 / SPEC)
**And** inline collapsible pre-send preview shows resolved URL and headers with secrets redacted (UX-DR20)
**When** a required variable cannot be resolved
**Then** Send is disabled and inline error reads "Unresolved variable: {{name}}" (UX-DR17, UX-DR24)
**And** `POST /api/execute` returns 400 `{code: UNRESOLVED_VARIABLE, name}` if attempted via API
**And** resolved preview and actual send use the same server-side resolution path — no client/server drift (AD-8)

## Epic 3: Edit and Save to Git

Developer edits requests in visual or raw `.http` editor, saves atomically to disk with minimal-diff formatting, and produces clean `git diff` output for PR review.

### Story 3.1: Visual Request Editor

As a **developer who prefers form-based editing**,
I want to modify method, URL, headers, and body via visual fields,
So that I can adjust requests without writing raw `.http` syntax.

**Acceptance Criteria:**

**Given** a request is loaded in the workspace
**When** I use the visual editor sub-tabs Params, Headers (with count badge), and Body (UX-DR11)
**Then** I can modify method, URL, headers, and body via form fields (FR11)
**And** changes update the draft state without writing to disk until Save (AD-4)
**And** invalid combinations (e.g., body on GET with content-type conflict) show validation feedback before save
**And** switching sub-tabs does not discard unsaved edits
**And** Save button appears as secondary button, enabled only when draft is dirty (UX-DR10)

### Story 3.2: Raw `.http` Editor with Syntax Highlighting

As a **developer who maintains `.http` files in Git**,
I want a raw text editor with JetBrains syntax highlighting,
So that I can edit requests exactly as they appear on disk.

**Acceptance Criteria:**

**Given** a request is loaded in the workspace
**When** I switch to the Raw `.http` sub-tab
**Then** I see the full `.http` file content with syntax highlighting (FR12)
**And** visual and raw modes share one draft with bidirectional sync (AD-18)
**When** I edit raw text with a syntax error
**Then** parse errors display inline with line number without crashing the UI
**When** I switch between visual and raw modes
**Then** current draft is sent to server for re-parse before display update (AD-18)
**And** web never generates `.http` syntax client-side (AD-18)

### Story 3.3: Server-Side Save with Minimal-Diff Write

As a **developer committing `.http` changes via Git PRs**,
I want saves to write atomically with minimal formatting changes,
So that my teammates see clean, reviewable diffs.

**Acceptance Criteria:**

**Given** I have unsaved edits in the request workspace
**When** I click Save or press Ctrl+S (UX-DR21)
**Then** `PUT /api/collections/:id` sends full file content; server parses and minimal-diff serializes (FR13, AD-5, AD-18)
**And** disk write uses temp file + rename for atomicity (AD-4)
**And** existing comments and blank lines outside edited Request blocks are preserved
**And** inline confirmation reads "Saved to {path}" and dirty flag clears (UX-DR17, UX-DR24)
**When** minimal-diff patch fails
**Then** server falls back to full-file rewrite and returns warning; amber inline message reads "File rewritten with formatting changes. Review git diff." (UX-DR17)
**When** disk write fails (read-only file)
**Then** error banner reads "Cannot write to {path}. File may be read-only." and draft is retained (UX-DR17, UJ-2 edge case)
**When** I navigate to a different request with unsaved changes
**Then** confirm dialog prompts before discarding draft (UX-DR26)
**And** UJ-2 completes — edit + save + git diff shows clean single-line change in 3/3 test sessions (SM-4 / NFR14)

## Epic 4: Request History and Replay

Developer browses chronological send history, replays past requests into the editor, and inspects truncated large responses — history survives server restart.

### Story 4.1: History Persistence in SQLite

As a **developer debugging API interactions**,
I want sent requests recorded locally with metadata,
So that I have a durable log of what I tested even after closing Reqor.

**Acceptance Criteria:**

**Given** a request is successfully sent via `POST /api/execute`
**When** the proxy completes
**Then** a History Entry is inserted into `.reqor/history.db` via better-sqlite3 (FR16, AD-13)
**And** entry records timestamp (ISO-8601 UTC), environment name, method, URL, status code, duration, and fingerprint
**And** response body is stored in full on disk; secrets are redacted from stored content (NFR6)
**And** history is capped at 500 entries per Repository Root — oldest pruned on insert
**And** response bodies over 1MB are truncated in list/detail DTOs with full body retrievable via `GET /api/history/:id` (AD-24)
**And** history survives server restart

### Story 4.2: History Sidebar and Replay

As a **developer reviewing past API calls**,
I want to browse and replay history entries from the sidebar,
So that I can quickly re-inspect or re-send previous requests.

**Acceptance Criteria:**

**Given** history entries exist
**When** I click the History tab (UX-DR5)
**Then** sidebar lists entries newest first with method badge, truncated URL, timestamp, status, duration, and environment name (UX-DR9, UX-DR13)
**And** status uses success green for 2xx and error red for 4xx/5xx
**And** contextual search filters by method, URL, and status within History tab only (UX-DR6)
**When** I click a history entry
**Then** request workspace populates with that request's details — does not auto-send (FR16)
**And** replay rematches by `collectionId` + `fingerprint` after collection reload (AD-21)
**When** a history response body exceeds 1MB display limit
**Then** truncation marker reads "Response body truncated (>{size}). Expand to load full body." with expand action (UX-DR17)
**And** `↑`/`↓` + Enter navigate and replay when History sidebar focused (UX-DR21)
**And** history list paginates or virtual-scrolls at 500 cap — no infinite scroll (UX-DR25)

## Epic 5: Import, Export, and Share

Developer pastes cURL to populate the editor, exports requests as cURL or code snippets (JS/Python/cURL) with secrets redacted — for sharing and terminal use.

### Story 5.1: cURL Import

As a **developer with an existing cURL command**,
I want to paste it into Reqor and populate the request editor,
So that I can quickly test endpoints documented as cURL snippets.

**Acceptance Criteria:**

**Given** I have a cURL command copied from documentation
**When** I open the cURL import modal and paste it (UX-DR18, FR17)
**Then** `POST /api/import/curl` converts it to a Request DTO in the editor draft
**And** supported flags include `-X`, `-H`, `-d`, `--data-raw`, `--json`, `-u`
**When** unsupported flags are present
**Then** a warning is shown but partial request is imported (UX-DR24 microcopy — direct, no fluff)
**And** import populates draft only — does not save to disk until explicit Save
**And** modal uses semi-transparent overlay with white card, no drop shadow (UX-DR23)
**And** Esc closes the modal (UX-DR21)

### Story 5.2: cURL Export

As a **developer sharing a request with a teammate**,
I want to copy the current request as a cURL command,
So that they can run it in their terminal.

**Acceptance Criteria:**

**Given** a request is loaded with an active environment
**When** I trigger cURL export (FR18)
**Then** `GET /api/export/curl/:requestId` returns a cURL command with variables substituted for the active environment
**And** secret values are redacted — not included in plaintext (NFR6)
**And** exported cURL executes equivalently in terminal against the same environment
**And** copy-to-clipboard action is available from the request toolbar

### Story 5.3: Code Snippet Export

As a **developer integrating an API into application code**,
I want to copy the request as JavaScript, Python, or cURL snippets,
So that I can paste runnable code into my project.

**Acceptance Criteria:**

**Given** a request is loaded
**When** I open the snippet export popover (UX-DR19, FR19)
**Then** tabs offer JavaScript (`fetch`), Python (`requests`), and cURL formats
**And** `GET /api/export/snippet/:requestId` returns snippet with method, URL, headers, and body
**And** secret values are replaced with `/* SECRET */` placeholder comments — never plaintext (NFR6)
**And** copy-to-clipboard works for each tab
**And** Esc closes the popover (UX-DR21)
**And** icon-only export button has screen reader label (UX-DR22)

