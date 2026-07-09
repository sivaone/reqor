---
name: Reqor
status: final
sources:
  - ../../specs/spec-reqor/SPEC.md
  - ../../prds/prd-reqor-2026-07-08/prd.md
  - ../../architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md
  - ../../architecture/architecture-reqor-2026-07-08/solution-design.md
  - imports/sample-reference.png
  - imports/stitch-reference.html
updated: 2026-07-08
---

> **Reference hierarchy.** Spines are authoritative. `imports/sample-reference.png` and `imports/stitch-reference.html` are visual references only.

# Reqor — Experience Spine

> Local-first REST client web UI. Single-surface browser app served by `reqor serve`. Paired with `DESIGN.md`. Reqor shell per reference image; Swagger UI color theme; stripped chrome.

## Foundation

**Form-factor:** Single-surface responsive web app. Minimum viewport **1280px** (per SPEC). Desktop/laptop primary — not a mobile-first product `[ASSUMPTION]`.

**UI system:** React 19 + Vite + Tailwind CSS `[ASSUMPTION per architecture]`. No component library mandate — plain, accessible primitives. `DESIGN.md` is the visual identity reference; this spine owns behavior, IA, and interaction.

**Authority model:** Browser is presentation only (thin-client BFF). All parsing, execution, secret resolution, and disk writes happen server-side. UI holds draft state until explicit Save.

**Stakes:** Consumer OSS dev tool. No accounts, no telemetry, no notifications. Basic keyboard navigation required; WCAG 2.1 AA not required for MVP.

→ Layout references: `imports/sample-reference.png` (Stitch Reqor shell screenshot), `imports/stitch-reference.html`. **Spine wins on conflict.**

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| **App shell** | Browser open to `localhost:3000` | Header (Reqor + environment selector) + three-pane layout |
| **Collections sidebar** | Default tab on load / click "Collections" | Tree of `.http` files and their requests; contextual search; refresh action |
| **History sidebar** | Click "History" tab | Chronological sent-request list; contextual search; replay action |
| **Request workspace** | Select request from Collections or replay from History | Method, URL, sub-tabs (Params/Headers/Body/Raw), Send, Save, import/export actions |
| **Response workspace** | After Send completes (or on history replay) | Status, timing, size, body/headers viewer |
| **Environment selector** | Header right | Pick active environment; name persists across restarts |
| **cURL import dialog** | Request toolbar action | Paste cURL → populate editor draft |
| **Snippet export popover** | Request toolbar action | Copy as fetch / Python / cURL with secrets redacted |

**Explicitly absent in MVP:** top menu bar, global search, notification banners, bottom status bar, right-side utility rail, account/sign-in, create-new `.http` file UI.

### Surface closure

| Stated need | Surface | Journey |
|---|---|---|
| Browse repo `.http` files | Collections sidebar | UJ-1 (Alex) |
| Send HTTP request | Request + Response workspace | UJ-1 (Alex), UJ-3 (Marcus) |
| Edit and save to disk | Request workspace (Raw tab) | UJ-2 (Priya) |
| Switch environment | Environment selector | UJ-3 (Marcus) |
| Review past sends | History sidebar | UJ-3 (Marcus) |
| Import cURL / export snippet | Request toolbar dialogs | UJ-1 (Alex) |

## Voice and Tone

Microcopy for a developer tool. Direct, no marketing fluff.

| Do | Don't |
|---|---|
| "No .http files found. Add one to the repo and refresh." | "Welcome to Reqor! Let's get started 🚀" |
| "Unresolved variable: {{host}}" | "Oops! Something went wrong with your variable." |
| "Saved to auth.http" | "Your changes have been saved successfully!" |
| "Parse error at line 14" | "We couldn't read this file." |
| "Secret value hidden" | "🔒 Your secret is safe with us!" |

## Component Patterns

Behavioral. Visual specs in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| **Sidebar tabs** | Collections / History | Mutually exclusive. Switching tabs preserves each tab's search query and scroll position independently. |
| **Contextual search** | Below active sidebar tab | Filters only the active tab's list. Collections: filters file paths and request names. History: filters method, URL, status. No cross-tab search. |
| **Collection tree** | Collections tab | One node per `.http` file (collection); children are requests. Expand/collapse per file. Parse-error file shows error badge; expanding reveals line number and message. Click request → loads in request workspace. |
| **Refresh collections** | Collections tab header action | Triggers `POST /api/collections/refresh`. Shows inline spinner; completes ≤3s for 100 files. No auto-watch. |
| **History list** | History tab | Newest first. Row shows method, URL (truncated), status, duration, timestamp, environment name. Click → replays into request workspace (does not auto-send). |
| **Request line** | Request workspace top | Method dropdown, URL field, Send (primary), Save (secondary, visible only when draft is dirty). Send disabled while unresolved variables exist. |
| **Request sub-tabs** | Below request line | Params, Headers (count badge), Body, Raw `.http`. Visual and Raw share one draft (bidirectional sync). Switching tabs does not discard edits. |
| **Response viewer** | Below request workspace | Status line (code, ms, bytes). Body and Headers sub-tabs. JSON/XML/plain highlighting. Bodies >1MB in history show truncation marker with expand action. |
| **Environment selector** | App header right | Dropdown of parsed environments. Selection persists to `.reqor/config.json` via server. Active name shown in request toolbar when set. |
| **Pre-send preview** | `[ASSUMPTION]` inline collapsible below request line | Shows resolved URL and headers before Send when variables are present. Secrets redacted. Not a modal. |
| **cURL import** | Toolbar button → modal | Textarea paste. Parses common flags; warns on unsupported flags; populates draft without saving to disk. |
| **Snippet export** | Toolbar button → popover | Tabs: JavaScript (fetch), Python (requests), cURL. Secrets as `/* SECRET */` comments. Copy-to-clipboard. |
| **Empty state** | Collections sidebar when no `.http` files | One sentence + Refresh button. No illustration. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| **Cold load** | App shell | Skeleton rows in sidebar (4–6); request workspace shows "Select a request" placeholder. Resolves when `GET /api/collections` returns. |
| **Empty repo** | Collections sidebar | "No .http files found. Add one to the repo and refresh." |
| **Parse error on file** | Collections tree | Red badge on file node. Expanded: "Line {N}: {message}". Other collections still load (per-file isolation). |
| **Draft dirty** | Request workspace | Save button appears/enables. Navigating away without save shows confirm dialog `[ASSUMPTION]`. |
| **Unresolved variables** | Request line | Send disabled. Inline error: "Unresolved variable: {{name}}". |
| **Sending** | Request + Response | Send button shows spinner within 100ms. Response panel shows loading skeleton. |
| **Send failed (network)** | Response panel | Error message with status or connection detail. Server process stays alive. |
| **Send succeeded** | Response panel | Status line + body. History tab gains new entry on next view. |
| **Save succeeded** | Request workspace | Brief inline confirmation: "Saved to {path}". Draft dirty flag clears. |
| **Save failed (read-only)** | Request workspace | Error banner: "Cannot write to {path}. File may be read-only." Draft retained. |
| **History truncated body** | Response on replay | "Response body truncated (>{size}). Expand to load full body." |
| **Full-file rewrite warning** | After save | Amber inline warning: "File rewritten with formatting changes. Review git diff." |

## Interaction Primitives

**Mouse-primary, keyboard floor** (per SPEC minimum).

| Key / Action | Behavior |
|---|---|
| `↑` / `↓` | Navigate collection tree or history list when sidebar focused |
| `Enter` | Select highlighted request (Collections) or replay (History) |
| `Ctrl+Enter` / `⌘+Enter` | Send current request |
| `Ctrl+S` / `⌘+S` | Save draft to disk |
| `Tab` | Move through request fields, sidebar, and buttons in DOM order |
| `Esc` | Close modal/popover; cancel confirm dialog |

**Mouse:** click to select, click Send/Save, drag split handle between request/response panels `[ASSUMPTION]`.

**Banned in MVP:** drag-and-drop reorder, right-click context menus, hover-only-only actions without keyboard equivalent for Send, infinite scroll in history (paginate or virtual-scroll at 500 cap).

## Accessibility Floor

Behavioral. Visual contrast from `DESIGN.md` (Swagger palette; not formally audited to WCAG AA).

- All interactive elements reachable via `Tab`.
- Send and Save have visible focus rings (`{colors.primary}` outline, 2px).
- Parse errors and unresolved-variable errors are text — not color-only (include variable name / line number).
- Method badges include text label (GET, POST), not color alone.
- `[ASSUMPTION]` Screen reader labels on icon-only buttons (Refresh, Import, Export).

## Inspiration & Anti-patterns

- **Lifted from reference image:** request/response vertical split; method + URL + Send row; sub-tabs for Params/Headers/Body; response status/timing/size inline; Collections + History sidebar tabs.
- **Lifted from Swagger UI:** color palette, method-colored badges, flat developer-tool aesthetic, minimal chrome.
- **Rejected — reference image elements not in MVP:** New Request button, Authorization/Settings tabs, flat request list (use collection tree per spine).
- **Rejected — Global search:** Collections and History each have contextual search (user decision).
- **Rejected — Notification banners:** none in MVP (user decision).
- **Rejected — Bottom status bar:** response metadata lives in response panel header (user decision).
- **Rejected — RHS utility rail:** no documentation/comments/code-rail (user decision).
- **Rejected — Account/sign-in flows:** local-only, no accounts.

## Key Flows

### Flow 1 — First request in 60 seconds (Alex, backend engineer, fresh laptop)

1. Alex runs `npx @reqor/cli serve` in a repo with `http/users.http`.
2. Browser opens. App shell loads: header "Reqor", Collections tab active, sidebar lists `http/users.http`.
3. Alex expands the file, clicks `GET /api/users`.
4. Request workspace populates: method GET, URL with `{{host}}` visible. Alex picks `dev` from environment selector in header.
5. Alex clicks **Send**.
6. **Climax:** Within one click, response panel shows `200 OK · 45 ms` and formatted JSON body. No import step, no account, no IDE. Alex is done.

**Failure:** `.http` file has parse error → file shows red badge in sidebar; Alex sees "Line 12: unexpected token" without other collections failing.

### Flow 2 — Edit, save, git diff (Priya, maintains smoke tests)

1. Priya opens `auth.http` from Collections, switches to **Raw** sub-tab.
2. She edits the URL line. Save button activates.
3. She presses `Ctrl+S`. Inline: "Saved to auth.http".
4. She runs `git diff` in terminal — clean single-line change.
5. **Climax:** The on-disk file matches what she edited. No silent discard, no manual repair. She opens a PR.

**Failure:** File is read-only → error banner, draft preserved, Priya fixes permissions and retries Save.

### Flow 3 — Staging with secrets (Marcus, hits staging API)

1. Marcus selects `staging` from environment selector. Name persists in header.
2. He opens `orders.http`, selects `POST /api/orders`. Pre-send preview shows resolved URL; `Authorization` header shows `••••••`.
3. He clicks **Send**. Response: `201 Created`.
4. He switches to **History** tab, searches "orders", sees the entry with staging environment tag.
5. **Climax:** Marcus confirms staging works with secrets resolved server-side — never displayed in UI, history, or exported snippet.

**Failure:** Missing `{{$dotenv API_KEY}}` → Send disabled, "Unresolved variable: API_KEY".

## Open Questions

| Item | Status |
|---|---|
| Resizable request/response split | `[ASSUMPTION]` yes, default 50/50 |
| Confirm dialog on navigate-away with dirty draft | `[ASSUMPTION]` yes |
| Pre-send preview as inline collapsible | `[ASSUMPTION]` yes, not modal |
| Dark mode | Deferred post-MVP |
| Sidebar collapse below 1280px | Deferred — SPEC sets 1280px floor |
