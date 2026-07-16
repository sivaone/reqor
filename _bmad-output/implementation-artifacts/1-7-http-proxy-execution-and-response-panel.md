---
baseline_commit: a4453ac
---

# Story 1.7: HTTP Proxy Execution and Response Panel

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [x] `pnpm turbo build test typecheck` pass (no regressions from 1.1–1.6)
- [x] All Acceptance Criteria satisfied
- [x] Manual smoke: `demo.http` GET → Send → status bar + JSON body on `:5173` and `:3000`
- [x] Manual smoke: unreachable host → error in panel; `GET /api/health` still 200
- [x] No history, env resolution, request sub-tabs, or disk save

## Story

As a **developer testing a local or remote API**,
I want to send the selected request and inspect the full response in the browser,
So that I can verify endpoints without Postman or an IDE.

## Acceptance Criteria

1. **Given** a request is loaded in the workspace  
   **When** I click Send or press `Ctrl+Enter` / `⌘+Enter` (UX-DR21)  
   **Then** loading state appears within 100ms (NFR2) and `POST /api/execute` proxies the HTTP call via Local Server (FR8, AD-6)

2. **And** response panel shows inline status bar: `{code} {statusText} · {ms} ms · {bytes} B` (UX-DR12)

3. **And** response body renders with JSON/XML/plain syntax highlighting in mono font on surface background

4. **And** response Headers sub-tab shows response headers as name/value rows

5. **And** proxy supports only `http://` and `https://` (including localhost); other schemes are rejected as `INVALID_REQUEST`

6. **And** redirect following is enabled by default with max 10 hops; per-request toggle exposed defaulting to true (AD-19)

7. **When** the outbound call completes with any HTTP status (including 4xx/5xx)  
   **Then** response panel shows the status bar + body/headers (`ExecuteResponse` success path — 2xx uses `text-success`, 4xx/5xx use `text-error`)  
   **When** the target is unreachable or the transport fails (DNS, TLS, connection refused, timeout, abort)  
   **Then** response panel shows error detail from `ApiErrorEnvelope` and the server process remains running (NFR7)

8. **And** request line shows method dropdown, mono URL field, Send primary button `#4990E2` (UX-DR10)

9. **And** Send and Save have visible 2px primary focus rings (UX-DR22)

10. **And** Local Server makes no outbound calls except proxied user requests (NFR5)

## Tasks / Subtasks

- [x] Task 1: Shared execute DTOs (AC: #1, #2) — AD-10, AD-21
  - [x] 1.1 Add to `packages/shared-types/src/index.ts`:
    - `ExecuteRequest`: `{ collectionId, requestIndex, followRedirects?: boolean, method?: string, url?: string }`
    - `ExecuteResponseHeaderDto`: `{ name, value }`
    - `ExecuteResponse`: `{ status, statusText, headers[], body, timingMs, sizeBytes }`
  - [x] 1.2 Extend `index.test.ts` with `Value.Check()` for new schemas
  - [x] 1.3 Document: `collectionId` is repo-relative POSIX path (same as collections API); `requestIndex` is 0-based; `followRedirects` defaults `true` when omitted

- [x] Task 2: Server proxy handler (AC: #1, #5, #6, #7, #10) — AD-6, AD-9, AD-19, AD-21, NFR5, NFR7
  - [x] 2.1 Create `packages/server/src/proxy/execute-request.ts` — pure function: lookup `RequestDto` from `CollectionStore` by `collectionId` + `requestIndex`; apply optional `method`/`url` overrides; build outbound `fetch` (method, url, headers, body from stored DTO)
  - [x] 2.2 Validate final URL scheme is `http:` or `https:` only — otherwise `INVALID_REQUEST`
  - [x] 2.3 Strip hop-by-hop / unsafe outbound headers from stored DTO before fetch: always remove `Host` and `Content-Length` (Node/`fetch` sets them). Keep `Authorization` / `Cookie` across redirects (API-client behavior — do not strip on cross-origin)
  - [x] 2.4 Implement redirect loop with Node native `fetch` + `redirect: 'manual'` (authoritative algorithm in Dev Notes):
    - `followRedirects: true` (default): follow `Location` up to **10** hops; resolve each hop against **current** URL; throw `TOO_MANY_REDIRECTS` if exceeded
    - `followRedirects: false`: return first response (including 3xx) without following
    - On 301/302/303 with unsafe method (POST/PUT/PATCH/DELETE), downgrade to GET and drop body per fetch spec
  - [x] 2.5 Enforce **30s** proxy timeout via `AbortSignal.timeout(30_000)` combined with any caller abort signal (`AbortSignal.any` when available)
  - [x] 2.6 Measure `timingMs` with `performance.now()` around full redirect chain; compute `sizeBytes` from response body byte length (UTF-8)
  - [x] 2.7 Read response body as text; collect headers as `{ name, value }[]` (preserve order); map to `ExecuteResponse`. If `response.statusText` is empty, fall back to `''` (do not invent a fake phrase — status bar still renders `200 · …` cleanly with a single space collapsed or omit empty token)
  - [x] 2.8 Wrap all errors in try/catch — never let execute crash the Fastify process (NFR7). Return typed error envelopes:
    - `404 NOT_FOUND` — collection or request index missing
    - `400 INVALID_REQUEST` — parse-error collection, empty requests, invalid method/url override, non-http(s) scheme
    - `502 PROXY_FAILED` — DNS, connection refused, TLS, timeout, abort — include `message` + optional `details.cause`
    - `502 TOO_MANY_REDIRECTS` — redirect hop limit exceeded
  - [x] 2.9 Create `packages/server/src/routes/execute.ts` — `POST /api/execute` with TypeBox request/response schemas; register in `app.ts` alongside collections (before static SPA so `/api/execute` is a real route). On Fastify request close/abort, abort the outbound proxy `AbortController`
  - [x] 2.10 **No** history insert, env resolution, or variable substitution (Epic 2 / Story 4.1). Send literal URL/headers/body from parsed DTO.

- [x] Task 3: Server execute tests (AC: #1, #5, #6, #7)
  - [x] 3.1 Create `packages/server/src/execute.test.ts` — follow `collections.test.ts` `createRepo()` + `app.inject()` pattern
  - [x] 3.2 Mock global `fetch` in server tests — assert outbound method/url/headers/body; assert `Host` / `Content-Length` not forwarded from fixture headers
  - [x] 3.3 Test success response shape: status, statusText, headers, body, timingMs, sizeBytes — including HTTP 404 from target as **success** `ExecuteResponse` (not `PROXY_FAILED`)
  - [x] 3.4 Test `404 NOT_FOUND` for missing collection / invalid index; `INVALID_REQUEST` for `file://` URL override
  - [x] 3.5 Test `followRedirects: false` returns 302 without following; `true` follows relative `Location` across hops (base URL updates each hop) up to 10
  - [x] 3.6 Test `PROXY_FAILED` on network error — subsequent `GET /api/health` still returns 200 (NFR7)
  - [x] 3.7 Test POST with JSON body from `demo.http`-style fixture (Content-Type + body forwarded)

- [x] Task 4: Web execute hook + keyboard send (AC: #1, #9) — AD-6, AD-10, NFR2, UX-DR21
  - [x] 4.1 Create `packages/web/src/hooks/useExecuteRequest.ts` — TanStack Query `useMutation`; POST `/api/execute` with `ExecuteRequest`; map `ApiErrorEnvelope` to thrown Error with code
  - [x] 4.2 Lift execute state in `AppLayout.tsx`: `followRedirects` default `true`; last `result` / `error`; wire `useExecuteRequest`; **clear `result` and `error` whenever `selectedRequest` identity changes** (collectionId/requestIndex/fingerprint)
  - [x] 4.3 Document `keydown` listener at AppLayout: `Ctrl+Enter` / `Meta+Enter` → send when request loaded and not pending; `Ctrl+S` / `Meta+S` → `preventDefault()` only (no save — Epic 3). Handle send once at AppLayout (no double-fire from URL input)
  - [x] 4.4 Send disabled when: no `selectedRequest`, detail loading/error, or mutation `isPending`
  - [x] 4.5 Pass execute props into `WorkspaceShell` per prop contract below

- [x] Task 5: Request line UI (AC: #8, #9) — UX-DR10, UX-DR13, UX-DR22
  - [x] 5.1 Create `packages/web/src/components/RequestLine.tsx` — replace `RequestPreview` usage in workspace
    - Method `<select>` with Swagger method colors when open; options: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
    - Mono URL `<input>` full width, controlled local state initialized from `activeRequest`
    - Send `<button>` primary `bg-primary text-primary-foreground rounded-md`; spinner + `aria-busy` when pending; `motion-reduce:animate-none`
    - Save `<button>` secondary `bg-surface border-border` — **visible, disabled** (`aria-disabled` / `disabled`) — no save handler (Epic 3)
    - Follow redirects checkbox/toggle, default checked, label "Follow redirects"
  - [x] 5.2 Focus rings: `focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2` on Send and Save (UX-DR22)
  - [x] 5.3 Reset local method/url state when `activeRequest` changes (new selection)
  - [x] 5.4 On Send: call mutation with `{ collectionId, requestIndex, followRedirects, method, url }` from current line state

- [x] Task 6: Response panel UI (AC: #2, #3, #4, #7) — UX-DR12
  - [x] 6.1 Create `packages/web/src/components/ResponsePanel.tsx` — props: `result | null`, `isPending`, `error | null`
  - [x] 6.2 Status bar in panel header (not app footer): format `{code} {statusText} · {timingMs} ms · {sizeBytes} B` (omit empty `statusText` token so it never shows double spaces); `text-body`; 2xx → `text-success`, 4xx/5xx → `text-error`
  - [x] 6.3 Sub-tabs Body | Headers — underline style matching `SidebarTabs` (2px `border-primary` active)
  - [x] 6.4 Body tab: scrollable `bg-surface` mono area; syntax highlighting via lightweight utility (see Dev Notes)
  - [x] 6.5 Headers tab: two-column list `name` (semibold) + `value` (mono truncate + `title`)
  - [x] 6.6 Loading: skeleton or muted "Sending…" within response panel (paired with Send spinner — NFR2)
  - [x] 6.7 Error state (transport/`ApiErrorEnvelope` only): show `error.message` + error code; do not crash workspace
  - [x] 6.8 Empty state (no send yet): muted placeholder (e.g. "Response will appear here")

- [x] Task 7: Wire WorkspaceShell (AC: all)
  - [x] 7.1 Update `WorkspaceShell.tsx` to the prop contract below; request section → `RequestLine`; response section → `ResponsePanel` inside `<section aria-label="Response">` (preserve existing label)
  - [x] 7.2 Preserve resize separator `aria-label="Resize request and response panels"`
  - [x] 7.3 Remove direct `RequestPreview` import — keep `RequestPreview.tsx` only if reused; otherwise delete or fold into RequestLine

- [x] Task 8: Web tests (AC: all)
  - [x] 8.1 `useExecuteRequest.test.tsx` — success + error envelope paths
  - [x] 8.2 `RequestLine.test.tsx` — Send click posts correct body; disabled states; follow-redirects toggle; focus rings present on Send/Save
  - [x] 8.3 `ResponsePanel.test.tsx` — status bar format (incl. empty statusText); tab switch; JSON highlighting; transport error message; HTTP 500 still shows status bar not error panel
  - [x] 8.4 `formatResponseBody.test.ts` — JSON/XML/plain detection
  - [x] 8.5 Update `WorkspaceShell.test.tsx` — response panel renders; `getByRole` / `aria-label="Response"` still works
  - [x] 8.6 Update `App.test.tsx` — select request → Send → response status bar visible (mock `/api/execute`); selection change clears prior response
  - [x] 8.7 Keyboard: `Ctrl+Enter` triggers send; `Ctrl+S` does not open browser save (preventDefault)
  - [x] 8.8 Copy existing `createWrapper()` pattern; `vi.stubGlobal('fetch', …)`

- [x] Task 9: Workspace verification (AC: all)
  - [x] 9.1 Run `pnpm turbo build test typecheck`
  - [x] 9.2 Manual smoke: `demo.http` GET → Send → httpbin.dev JSON response (live server inject against repo root)
  - [x] 9.3 Manual smoke: unreachable host → error in panel, `GET /api/health` still ok
  - [x] 9.4 Manual smoke: `reqor serve .` at :3000 — same-origin execute works (server route verified via inject; UI covered by App.test.tsx mock)

### Review Findings

- [x] [Review][Patch] Ctrl+Enter ignores RequestLine method/URL edits [`packages/web/src/components/AppLayout.tsx:121`]
- [x] [Review][Patch] In-flight execute can paint result/error onto a newly selected request [`packages/web/src/components/AppLayout.tsx:94`]
- [x] [Review][Patch] XML highlighter duplicates attributes (full tag token + attr tokens) [`packages/web/src/utils/formatResponseBody.ts:65`]
- [x] [Review][Patch] Empty/invalid method override not rejected as INVALID_REQUEST [`packages/server/src/proxy/execute-request.ts:97`]
- [x] [Review][Patch] Malformed redirect Location maps to PROXY_FAILED instead of controlled INVALID_REQUEST [`packages/server/src/proxy/execute-request.ts:142`]
- [x] [Review][Patch] Redirect hop responses are not drained/cancelled before the next fetch [`packages/server/src/proxy/execute-request.ts:138`]
- [x] [Review][Patch] Success-path `/api/execute` JSON parse has no catch / invalid-body guard [`packages/web/src/hooks/useExecuteRequest.ts:30`]
- [x] [Review][Patch] Missing server test for TOO_MANY_REDIRECTS at 10-hop ceiling [`packages/server/src/execute.test.ts`]
- [x] [Review][Patch] RequestLine tests omit follow-redirects toggle change and non-pending disable paths [`packages/web/src/components/RequestLine.test.tsx`]
- [x] [Review][Patch] Missing server test for 301/302/303 unsafe-method downgrade to GET [`packages/server/src/execute.test.ts`]
- [x] [Review][Patch] Duplicate response headers can collide on React list keys [`packages/web/src/components/ResponsePanel.tsx:200`]
- [x] [Review][Patch] Response Body/Headers tabs lack tabpanel / aria-controls wiring [`packages/web/src/components/ResponsePanel.tsx:170`]
- [x] [Review][Patch] JSON highlighter does not escape quotes/control chars inside string values [`packages/web/src/components/ResponsePanel.tsx:38`]

## Dev Notes

### Epic Context

Epic 1 delivers UJ-1: developer runs `reqor serve`, browses `.http` collections, **sends a request**, sees response. Stories 1.1–1.6 built monorepo, parser, REST API, CLI/static serve, app shell, and collections sidebar with read-only preview. **Story 1.7 completes the UJ-1 demo path** — the first end-to-end send.

**In scope:** FR8 proxy execution; UX-DR10 request line (Send + disabled Save); UX-DR12 response viewer; UX-DR21 send shortcut; UX-DR22 Send/Save focus rings; AD-6, AD-9, AD-10, AD-16, AD-19, AD-21; NFR2, NFR5, NFR7.

**Out of scope / do not implement:**
- Environment variable resolution / pre-send preview / Send disabled on unresolved vars → **Story 2.5** (Epic 2)
- History persistence on send → **Story 4.1** (Epic 4)
- Request sub-tabs (Params/Headers/Body/Raw), dirty draft, Save to disk → **Epic 3**
- Env selector in header → **Story 2.2**
- Header/body editing in request line — execute uses stored DTO headers/body; only method/url overridable in UI for session send
- Client-side `.http` parsing (AD-3)
- History tab population
- Response truncation expand (>1MB) — live execute returns full body; truncation is history-only (AD-24)

### Architecture Compliance (MUST follow)

| AD / NFR | Requirement for 1.7 |
|----------|---------------------|
| AD-6 | Web UI must not call target URLs. All HTTP via `POST /api/execute` → server Node `fetch`. |
| AD-9 | Proxy in same Fastify process as collections API + static UI on `:3000`. |
| AD-10 | Execute DTOs in `@reqor/shared-types`; web uses TanStack Query mutation; TypeBox route schemas. |
| AD-16 | No outbound server calls except user-initiated proxied requests (NFR5). |
| AD-19 | Follow redirects default true, max 10 hops; `followRedirects` on execute body + UI toggle. |
| AD-21 | Execute targets `collectionId` + `requestIndex`; fingerprint used by web for selection rematch only. |
| AD-22 | Server reads `RequestDto` from `CollectionStore` / `toDto()` — never parser AST in web. |
| NFR2 | Send button spinner / response loading within 100ms of click — use immediate `isPending` from mutation. |
| NFR5 | No telemetry, update checks, or background outbound HTTP. |
| NFR7 | Execute handler catches all errors; returns error envelope; process stays alive. |

### Success vs error path (MUST)

| Outcome | Server returns | UI shows |
|---------|----------------|----------|
| Any HTTP response (2xx / 3xx unfollowed / 4xx / 5xx) | `200` + `ExecuteResponse` | Status bar + Body/Headers |
| DNS / connect / TLS / timeout (30s) / abort | `502 PROXY_FAILED` | Error panel message + code |
| >10 redirects | `502 TOO_MANY_REDIRECTS` | Error panel |
| Bad id / index / scheme / overrides | `404` / `400` envelope | Error panel |

Never map target HTTP 4xx/5xx to `PROXY_FAILED`.

### API Contract (implement)

| Method | Path | Body | Success | Failure |
|--------|------|------|---------|---------|
| `POST` | `/api/execute` | `ExecuteRequest` | `ExecuteResponse` | `ApiErrorEnvelope` |

```typescript
// ExecuteRequest
{
  collectionId: string       // e.g. "demo.http" or "http/users.http"
  requestIndex: number       // 0-based
  followRedirects?: boolean  // default true
  method?: string            // optional override from request line
  url?: string               // optional override from request line
}

// ExecuteResponse
{
  status: number             // final HTTP status after redirects
  statusText: string         // may be "" under undici — UI must tolerate
  headers: Array<{ name: string; value: string }>
  body: string
  timingMs: number
  sizeBytes: number
}
```

**Error codes:**

| Code | HTTP | When |
|------|------|------|
| `NOT_FOUND` | 404 | Unknown `collectionId` or `requestIndex` |
| `INVALID_REQUEST` | 400 | Parse-error collection / empty requests / bad override / non-`http(s)` scheme |
| `PROXY_FAILED` | 502 | Network/TLS/DNS/timeout/abort failures |
| `TOO_MANY_REDIRECTS` | 502 | More than 10 redirect hops |

**Note:** `solution-design.md` sequence diagram uses `{requestId, environment}` — **ignore**; AD-21 `collectionId` + `requestIndex` is authoritative.

### Server Proxy Implementation Guide (authoritative)

```typescript
const PROXY_TIMEOUT_MS = 30_000

const req = collection.requests[requestIndex]
const method = (body.method ?? req.method).toUpperCase()
let currentUrl = body.url ?? req.url

if (!/^https?:\/\//i.test(currentUrl)) {
  throw invalidRequest('Only http:// and https:// URLs are supported')
}

const headers = new Headers()
for (const h of req.headers) {
  const name = h.name.toLowerCase()
  if (name === 'host' || name === 'content-length') continue
  headers.set(h.name, h.value)
}

let fetchBody: string | undefined
if (req.body && method !== 'GET' && method !== 'HEAD') {
  fetchBody = req.body.content
}

const timeoutSignal = AbortSignal.timeout(PROXY_TIMEOUT_MS)
const signal = requestAbort
  ? AbortSignal.any([requestAbort, timeoutSignal])
  : timeoutSignal

let response = await fetch(currentUrl, {
  method,
  headers,
  body: fetchBody,
  redirect: 'manual',
  signal,
})

let hops = 0
let nextMethod = method
let nextBody = fetchBody

while (followRedirects && isRedirect(response.status) && hops < 10) {
  const location = response.headers.get('location')
  if (!location) break
  // Resolve relative Location against the CURRENT response URL (not the original)
  currentUrl = new URL(location, currentUrl).href
  if (!/^https?:\/\//i.test(currentUrl)) {
    throw invalidRequest('Redirect target must be http:// or https://')
  }
  if ([301, 302, 303].includes(response.status) && !['GET', 'HEAD'].includes(nextMethod)) {
    nextMethod = 'GET'
    nextBody = undefined
  }
  // Keep Authorization/Cookie headers across redirects (API-client default)
  response = await fetch(currentUrl, {
    method: nextMethod,
    headers,
    body: nextBody,
    redirect: 'manual',
    signal,
  })
  hops++
}

if (followRedirects && isRedirect(response.status) && hops >= 10) {
  throw tooManyRedirects()
}
```

Use global `fetch` only (Node 24 / undici). Do **not** add `node-fetch` or undici redirect interceptors — the manual loop above is required for hop counting and relative `Location` resolution.

### WorkspaceShell prop contract (UPDATE)

```typescript
type WorkspaceShellProps = {
  activeRequest: RequestDtoType | null
  isDetailPending: boolean
  isDetailError: boolean
  // execute (new)
  collectionId: string | null
  requestIndex: number | null
  followRedirects: boolean
  onFollowRedirectsChange: (value: boolean) => void
  onSend: (overrides: { method: string; url: string }) => void
  isSending: boolean
  executeResult: ExecuteResponseType | null
  executeError: { code?: string; message: string } | null
}
```

### Layout Structure (after 1.7)

```text
AppShell
└── AppLayout                          # selection + execute mutation + keyboard
    ├── SidebarShell                   # unchanged from 1.6
    └── WorkspaceShell                 # UPDATE — prop contract above
        ├── RequestLine                # method, URL, Send, Save(disabled), redirect toggle
        └── section[aria-label=Response]
            └── ResponsePanel          # status bar, Body/Headers tabs
```

### Current Code State (UPDATE)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `app.ts` | collections + health only | Register execute routes (with collections, before static SPA) |
| `shared-types/index.ts` | Collection DTOs only | Add ExecuteRequest/Response |
| `AppLayout.tsx` | Selection + detail query | Execute mutation, keyboard send, followRedirects, clear result on selection change |
| `WorkspaceShell.tsx` | RequestPreview + empty `aria-label="Response"` | RequestLine + ResponsePanel; keep Response aria-label |
| `RequestPreview.tsx` | Read-only badge + URL | Superseded by RequestLine |
| `CollectionStore` | get/list/loadAll | Consumed by execute lookup — no schema change |

### Request Line Scope (UX-DR10 vs Epic 3)

| Element | 1.7 behavior |
|---------|--------------|
| Method dropdown | Editable; sent as optional override |
| URL input | Editable mono; sent as optional override |
| Send | Primary, enabled when request loaded |
| Save | Visible secondary, **always disabled** — no dirty state yet |
| Sub-tabs | **Not rendered** — Epic 3 |
| Headers/body for send | From server-stored `RequestDto`, not edited in UI |

### Response Syntax Highlighting (UX-DR12)

DESIGN.md assumes a **basic highlighter** — avoid heavy editor deps.

**Recommended approach:** `packages/web/src/utils/formatResponseBody.ts`
1. Detect content type from response `Content-Type` header (fallback: sniff JSON/XML)
2. **JSON:** `JSON.parse` + recursive render with `<span class="text-primary">` keys, `text-success` strings, `text-foreground` numbers/booleans; pretty-print 2-space indent
3. **XML:** regex tokenize tags/attributes — light styling, no full parser required for MVP
4. **Plain:** escape HTML, render mono pre-wrap

Do **not** block story on a new npm package unless custom approach fails — if adding a dep, use `highlight.js` with json+xml only (catalog-pin) and lazy-load.

### Response Status Bar Format (UX-DR12)

Exact pattern: `200 OK · 98 ms · 897 B`
- Middle dot `·` (U+00B7) separators
- If `statusText` is empty: `200 · 98 ms · 897 B` (no double space)
- `timingMs` rounded integer; `sizeBytes` raw `B` suffix (not KiB)

### Keyboard (UX-DR21)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `⌘+Enter` | Send current request (when loaded, not pending) |
| `Ctrl+S` / `⌘+S` | `preventDefault()` only — no save until Epic 3 |

Do not steal bare `Enter` from the URL input.

### Do Not Regress (from Story 1.6)

- Collections sidebar, search, refresh, keyboard tree nav — unchanged
- Selection + fingerprint rematch in `AppLayout` — preserve
- Cold-load `SidebarSkeleton` only for initial list pending — not for send
- Sidebar `role="complementary"` / `aria-label="Sidebar"`; error `role="alert"` paths
- Workspace resize separator label **and** `aria-label="Response"`
- Layout: 280px sidebar, `min-w-[1280px]`, flat borders
- `motion-reduce:animate-none` on spinners
- Collection id URLs: no `encodeURIComponent` on full id

### Testing Standards

- **Server:** Vitest + `app.inject()`; temp repo via `createRepo()`; mock `global.fetch` for deterministic proxy tests
- **Web:** Vitest 3 + RTL; `createWrapper()` with `QueryClientProvider` `retry: false`
- Prefer `getByRole('button', { name: /^send$/i })`, `getByRole('tab', { name: /body/i })`, `getByLabelText` / region `Response`
- Assert status bar with regex: `/200(?: OK)? · \d+ ms · \d+ B/`
- Assert HTTP 4xx/5xx from target → status bar path, not error panel
- NFR7: failed execute then health check passes
- No E2E required — smoke on `:5173` (Vite proxy) and `:3000` (`reqor serve`)

### Project Structure Notes

```text
packages/shared-types/src/
  index.ts                              # UPDATE — ExecuteRequest, ExecuteResponse
  index.test.ts                         # UPDATE

packages/server/src/
  proxy/execute-request.ts              # NEW
  routes/execute.ts                     # NEW
  execute.test.ts                       # NEW
  app.ts                                # UPDATE — register execute routes

packages/web/src/
  hooks/useExecuteRequest.ts            # NEW + test
  utils/formatResponseBody.ts           # NEW + test
  components/RequestLine.tsx            # NEW + test
  components/ResponsePanel.tsx          # NEW + test
  components/AppLayout.tsx              # UPDATE
  components/WorkspaceShell.tsx         # UPDATE
  components/WorkspaceShell.test.tsx    # UPDATE
  App.test.tsx                          # UPDATE
```

### Previous Story Intelligence

**1.6 (done):** Selection=`{collectionId, requestIndex, fingerprint}` in `AppLayout`; `useCollectionDetail` + fingerprint rematch after refresh; `WorkspaceShell` has request/response split with empty response section; `RequestPreview` is read-only method+URL; 32 web tests; review patches fixed search cache, scroll preservation, keyboard focus, error precedence.

**Key files to extend, not rewrite:**
- `AppLayout.tsx` — add execute state alongside existing selection effect; clear response on selection change
- `WorkspaceShell.tsx` — swap preview for RequestLine, fill response section; keep `aria-label="Response"`

**Review lessons from 1.6:** Prefer `isDetailError` over stale `activeRequest`; avoid duplicate tab stops; ensure loading states don't expose phantom focus targets.

### Git Intelligence

- `a4453ac` — Story 1.6 code review patches (sidebar search, scroll, keyboard, selection highlight)
- `d4921d1` — Collections sidebar + request navigation
- `c81ecf4` — App shell a11y + AbortSignal patterns
- Patterns: colocated tests, ESM `.js` imports, TanStack Query hooks with `signal`, accessible RTL queries, `ApiErrorEnvelope` error handling

### Latest Technical Information

- **Node native `fetch`** (Node 24 / undici): `redirect: 'manual'` returns real 3xx responses (not opaque). Manual hop loop required — do not use undici redirect interceptors for AD-19 counting
- **Timeout:** `AbortSignal.timeout(30_000)` + combine with Fastify request abort via `AbortSignal.any`
- **TanStack Query ~5.x** — `useMutation`; `isPending` drives NFR2; pass `AbortSignal` for cancellation
- **React ~19.2** — document-level keyboard listener with cleanup in `useEffect`
- **No React Router** — execute state ephemeral in `AppLayout`; **must** clear last response when selection changes

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.7, FR8, UX-DR10, UX-DR12, UX-DR21, UX-DR22, AD-6, AD-19, NFR2, NFR5, NFR7]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/prd.md` — FR-8 Request Execution]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-6, AD-9, AD-10, AD-16, AD-19, AD-21]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — §4.2 Send request flow]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/DESIGN.md` — request line, response status bar, highlighting]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — Sending state, Ctrl+Enter, error handling]
- [Source: `_bmad-output/implementation-artifacts/1-6-collections-sidebar-and-request-navigation.md`]
- [Source: `packages/server/src/collection-store.ts`, `packages/server/src/routes/collections.ts`]
- [Source: `packages/web/src/components/AppLayout.tsx`, `WorkspaceShell.tsx`]
- [Source: `demo.http`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- TanStack Query v5 `MutationFunctionContext` in this repo does not expose `signal`; server-side abort on Fastify request close covers disconnect cancellation.

### Completion Notes List

- Added `ExecuteRequest` / `ExecuteResponse` DTOs and `POST /api/execute` proxy with manual redirect loop (max 10 hops), 30s timeout, http(s)-only scheme validation, and typed error envelopes.
- Web UI: `RequestLine` (method/URL/Send/disabled Save/follow-redirects), `ResponsePanel` (status bar, Body/Headers tabs, JSON/XML/plain highlighting), execute state in `AppLayout` with Ctrl+Enter send and selection-change clearing.
- Removed superseded `RequestPreview.tsx`.
- All packages: `pnpm turbo build test typecheck` pass (159 tests). Live smoke: `demo.http` GET → 200 via httpbin.dev; unreachable host → 502 PROXY_FAILED with health still 200.

### File List

- packages/shared-types/src/index.ts (modified)
- packages/shared-types/src/index.test.ts (modified)
- packages/server/src/proxy/execute-request.ts (new)
- packages/server/src/routes/execute.ts (new)
- packages/server/src/app.ts (modified)
- packages/server/src/execute.test.ts (new)
- packages/web/src/hooks/useExecuteRequest.ts (new)
- packages/web/src/hooks/useExecuteRequest.test.tsx (new)
- packages/web/src/utils/formatResponseBody.ts (new)
- packages/web/src/utils/formatResponseBody.test.ts (new)
- packages/web/src/components/RequestLine.tsx (new)
- packages/web/src/components/RequestLine.test.tsx (new)
- packages/web/src/components/ResponsePanel.tsx (new)
- packages/web/src/components/ResponsePanel.test.tsx (new)
- packages/web/src/components/AppLayout.tsx (modified)
- packages/web/src/components/WorkspaceShell.tsx (modified)
- packages/web/src/components/WorkspaceShell.test.tsx (modified)
- packages/web/src/App.test.tsx (modified)
- packages/web/src/components/RequestPreview.tsx (deleted)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

## Change Log

- 2026-07-16: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-16: Story context validated — execute API contract (AD-21), redirect policy (AD-19), request line vs Epic 3 scope, response panel UX, and regression guards locked in
- 2026-07-16: Validation pass — redirect currentUrl hop resolution, HTTP vs transport error paths, http(s) scheme allowlist, 30s timeout, Host/Content-Length strip, WorkspaceShell prop contract, clear-on-selection, Ctrl+S preventDefault, Response aria-label, abort-on-disconnect
- 2026-07-16: Story 1.7 implemented — HTTP proxy execution API, request line + response panel UI, 23 new tests, full regression green
- 2026-07-16: Code review patches applied — Ctrl+Enter uses line drafts, stale mutation guard, XML/JSON highlight fixes, method/Location validation, redirect body drain, tab a11y, expanded tests; status → done
