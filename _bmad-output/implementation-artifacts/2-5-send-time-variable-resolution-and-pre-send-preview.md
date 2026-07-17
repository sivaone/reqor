---
baseline_commit: 6012a44
---

# Story 2.5: Send-Time Variable Resolution and Pre-Send Preview

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [x] Shared server `resolveRequest()` resolves all MVP placeholder kinds before proxy — same function used by preview and execute (AD-8)
- [x] Merge order: active JetBrains environment variables → repo `.env` variants for `env` kind; `dotenv` kind via `resolveDotenv`; builtins generated at send (AD-20 / glossary EnvResolver)
- [x] Single-pass resolution only — do not recursively resolve values pulled from env/dotenv files
- [x] `EnvResolver` extended in-place — constructor takes `DotenvStore` + `EnvironmentStore`; no second resolver class (Story 2.4 contract)
- [x] `POST /api/preview` returns `{ url, headers, unresolved, hasVariables }` with redacted URL + header values; never plaintext secrets (AD-7, UX-DR20)
- [x] Preview redaction calls `redactSecrets` on the URL string and **each** header `value` — do not use `redactObject` on header arrays (it skips object items)
- [x] `POST /api/execute` accepts optional `environment` (preserve existing `followRedirects`); resolves url/headers/**body** then proxies; returns `400` with `UNRESOLVED_VARIABLE` when blocked (FR9)
- [x] Web: inline collapsible pre-send preview below request line when `hasVariables === true`; secrets show `SECRET_MASK` (UX-DR20, UX-DR14)
- [x] Web: Send enablement matrix enforced for **button and Ctrl/⌘+Enter** (UX-DR10, UX-DR17, UX-DR21, UX-DR24)
- [x] `redactSecrets` wired into preview responses and any execute/preview log paths (NFR6)
- [x] `demo.http` + `http-client.env.json` `development` env resolves `{{host}}` end-to-end; mark deferred-work demo item done
- [x] `pnpm turbo build test typecheck` passes workspace-wide
- [x] SM-2 fixture gate still ≥45/50 (http-parser untouched / non-regressing)

### Anti-patterns (do not ship)

- Do not resolve variables client-side in `@reqor/web` — preview and send must both use server resolution (AD-8, AD-22)
- Do not import `@reqor/http-parser` from `@reqor/web` (including for “does this request have variables?” — use `hasVariables` from preview)
- Do not add `variables[]` to `RequestDto` or collections API (Story 2.1 / AD-22 deferral)
- Do not mutate stored collection templates — resolve into a **copy** only at preview/execute time
- Do not return plaintext dotenv or JetBrains `isSecret` values in preview API responses
- Do not invent a second resolver class — extend `EnvResolver` from Story 2.4
- Do not create `.reqor/secrets.env` or write repo `.env` files
- Do not wire history persistence for sends — Epic 4
- Do not add visual/raw editor or save flows — Epic 3
- Do not add snippet/cURL export redaction — Epic 5 (but reuse redaction helpers when built)
- Do not regress Story 2.3 config persistence, `INVALID_ENVIRONMENT`, or toolbar null/stale-env behavior
- Do not regress Story 2.4 SecretField / EnvironmentVariablesStrip / dotenv read-only load
- Do not add npm dependencies for UUID/templating — use Node `crypto.randomUUID()` and built-ins
- Do not let Ctrl/⌘+Enter bypass unresolved/preview Send gating
- Do not use `redactObject` alone to redact `headers: { name, value }[]` — array-of-object values are not redacted today

## Story

As a **developer sending requests with environment variables**,
I want unresolved variables blocked and resolved values previewed before send,
So that I know exactly what request will hit the wire.

## Acceptance Criteria

1. **Given** an active environment is selected  
   **When** I load a request containing `{{host}}`, `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, or `{{$dotenv KEY}}`  
   **Then** the server resolves variables immediately before proxy execution (FR9, AD-8)  
   **And** merge order is: active environment file variables → repo `.env` variants for missing `env` keys (AD-20 / glossary EnvResolver)  
   **And** `dotenv` placeholders resolve via existing `resolveDotenv` (Story 2.4) — **no active environment required**  
   **And** `$uuid`, `$timestamp`, `$randomInt` generate new values per send/preview call — **no active environment required**  
   **And** resolution is single-pass (env/dotenv values are not scanned for further `{{…}}`)

2. **And** inline collapsible pre-send preview below the request line shows resolved URL and headers with secrets redacted (UX-DR20)  
   **And** preview is hidden when `hasVariables === false`  
   **And** preview data comes from `POST /api/preview` — not client substitution  
   **And** `PreviewResponse.hasVariables` is authoritative for panel visibility and Send gating

3. **When** a required variable cannot be resolved  
   **Then** Send is disabled (button **and** Ctrl/⌘+Enter) and inline error reads `Unresolved variable: {{name}}` using the placeholder's `raw` form e.g. `{{host}}` or `{{$dotenv API_KEY}}` (UX-DR17, UX-DR21, UX-DR24)  
   **And** `POST /api/execute` returns `400 { error: { code: 'UNRESOLVED_VARIABLE', …, details: { name, raw } } }` if attempted via API  
   **And** `env`-kind placeholders require an active environment; missing env selection makes `{{host}}`-style vars unresolved  
   **And** builtins/`dotenv`-only requests still resolve when no environment is selected

4. **And** resolved preview and actual send use the same server-side `resolveRequest()` path — no client/server drift (AD-8)  
   **And** method/URL overrides from the request line are applied before resolution (same as execute today)  
   **And** execute proxies the fully resolved url, headers, **and body** (preview response omits body per UX-DR20)  
   **And** secrets never appear in preview API responses or server logs at any level (NFR6, AD-7)

## Tasks / Subtasks

- [x] Task 1: Extend `EnvResolver` + core resolution engine (AC: #1, #4) — AD-8, AD-20
  - [x] 1.1 Extend `packages/server/src/env-resolver.ts`:
    ```typescript
    constructor(
      private readonly dotenvStore: DotenvStore,
      private readonly environmentStore: EnvironmentStore,
    ) {}
    // keep resolveDotenv(key)
    // add:
    resolveEnv(name: string, environmentName: string | null | undefined): string | undefined
    resolveBuiltin(kind: 'uuid' | 'timestamp' | 'randomInt'): string
    /** JetBrains isSecret plaintext for environmentName + all dotenv values */
    getSecretValuesForRedaction(environmentName?: string | null): string[]
    ```
    Update `app.ts` construction/decorate to pass both stores.
  - [x] 1.2 Add `packages/server/src/resolve-request.ts` — `resolveRequest(input)` using `scanVariables` per DTO field (url, each header value, body content); **single-pass**; replace placeholders right-to-left within each field; return `{ resolved: { method, url, headers, body? }, unresolved: { name, raw } | null, secrets: string[], hasVariables: boolean }`
  - [x] 1.3 Builtin generators (MVP): `$uuid` → `crypto.randomUUID()`; `$timestamp` → `String(Date.now())`; `$randomInt` → `String(Math.floor(Math.random() * 1000))` (0–999 inclusive)
  - [x] 1.4 Merge rule for `env` kind: requires `environmentName`; lookup `environmentStore.get(name)` variable key; if missing, fallback `resolveDotenv(key)`; if still missing → unresolved. Missing/null env → unresolved for `env` kind.
  - [x] 1.5 `dotenv` kind: `resolveDotenv(name)` only (works with no active env); missing → unresolved with `name` = KEY
  - [x] 1.6 Tests: `env-resolver.test.ts` extensions, `resolve-request.test.ts` (merge order, builtins without env, dotenv without env, unresolved env-kind, overrides, offset replacement, single-pass no recursion, secret redaction list)

- [x] Task 2: Preview API + execute wiring (AC: #1–#4) — AD-10
  - [x] 2.1 Add TypeBox schemas in `packages/shared-types`: `PreviewRequest`, `PreviewResponse` (must include `hasVariables: boolean`); extend `ExecuteRequest` with optional `environment?: string | null` (**keep** `followRedirects`); add `UNRESOLVED_VARIABLE` to `ExecuteErrorCode`
  - [x] 2.2 Add `packages/server/src/routes/preview.ts` — `POST /api/preview`; resolve environment from body `environment` ?? `configStore.activeEnvironment`; call shared `resolveRequest()`; redact with:
    ```typescript
    const url = redactSecrets(resolved.url, secrets)
    const headers = resolved.headers.map((h) => ({
      name: h.name,
      value: redactSecrets(h.value, secrets),
    }))
    ```
    Return `{ url, headers, unresolved, hasVariables }` — **omit body** from preview MVP (UX-DR20 URL+headers only)
  - [x] 2.3 Update `packages/server/src/proxy/execute-request.ts` — accept resolver + stores; call `resolveRequest()` before fetch; proxy **resolved** method/url/headers/body; throw `ExecuteError('UNRESOLVED_VARIABLE', …)` with 400; preserve redirect/timeout/`followRedirects` behavior
  - [x] 2.4 Update `packages/server/src/routes/execute.ts` + `app.ts` — inject stores/resolver into execute route; register preview route with same deps; wire new `EnvResolver(dotenvStore, environmentStore)`
  - [x] 2.5 Wire `redactSecrets` into any request-logging in execute/preview paths (NFR6); do not log resolved plaintext secrets
  - [x] 2.6 Tests: `preview.test.ts`, extend `execute.test.ts` — resolved send replaces `{{host}}`, body placeholders resolved on execute, UNRESOLVED_VARIABLE 400, secrets redacted in preview header values, `hasVariables` true/false, environment override vs config fallback, `followRedirects` still honored

- [x] Task 3: Web — preview hook + Send gating (AC: #2, #3) — UX-DR10, UX-DR17, UX-DR20, UX-DR21, UX-DR24
  - [x] 3.1 Add `packages/web/src/hooks/usePreviewRequest.ts` — TanStack Query calling `POST /api/preview` when collection/request/env/line overrides change; debounce ~300ms; ignore stale responses via `selectionIdentity` (same pattern as execute race guard in `AppLayout`)
  - [x] 3.2 Add `packages/web/src/components/PreSendPreview.tsx` — inline collapsible below request line; render only when `hasVariables`; shows resolved URL + header rows; secret header values via `SecretField`; collapsed by default, expand label e.g. "Preview resolved request"
  - [x] 3.3 Update `RequestLine.tsx` — render `PreSendPreview` + unresolved inline error (`text-error` or existing error token); apply Send enablement matrix (below)
  - [x] 3.4 Update `AppLayout.tsx` **and** `WorkspaceShell.tsx` — thread `activeEnvironment`, preview state, unresolved, send-disabled; include `environment: activeEnvironment` **and** existing `followRedirects` in execute mutation body; **gate Ctrl/⌘+Enter** with the same `canSend` flag as the button; preserve 2.3/2.4 toolbar ownership
  - [x] 3.5 Tests: `PreSendPreview.test.tsx`, extend `RequestLine.test.tsx`, `WorkspaceShell.test.tsx`, `AppLayout`/integration — Send disabled on unresolved, keyboard send blocked when gated, preview hidden when `hasVariables === false`, redacted headers, error microcopy exact

- [x] Task 4: Demo + integration hygiene (AC: all)
  - [x] 4.1 Verify `demo.http` sends to resolved host when `development` environment selected and `.env` not required for demo path
  - [x] 4.2 Mark deferred-work item “Demo uses unresolved `{{host}}`…” as done/resolved once 4.1 passes
  - [x] 4.3 Run `pnpm turbo build test typecheck`; confirm http-parser fixture gate non-regressing

## Dev Notes

### Resolution pipeline (authoritative)

```text
POST /api/preview  ──┐
POST /api/execute  ──┼──► resolveRequest() ──► redact url + each header value for preview
                       │         │
                       │         └──► plaintext resolved url/headers/body ──► fetch proxy
                       └── same function — AD-8 no-drift
```

| Step | Rule |
|------|------|
| Load template | From `CollectionStore` request DTO by `collectionId` + `requestIndex` |
| Apply overrides | `method` / `url` from request body override DTO values (existing execute behavior) |
| Scan | `scanVariables` per url / header value / body field on template strings (import from `@reqor/http-parser` server-side only) |
| `hasVariables` | `true` if any recognized placeholder scanned after overrides |
| Resolve order | Process placeholders; first unresolved stops with `{ name, raw }` — use `raw` for UX-DR24 display |
| `env` kind | Requires `environmentName`; lookup `environmentStore.get(name)` variable key; else `resolveDotenv(key)` |
| `dotenv` kind | `resolveDotenv(name)` only — works with no active environment |
| Builtins | Generate fresh value each call — no active environment required |
| Single-pass | Do **not** re-scan or resolve `{{…}}` inside values returned from env/dotenv |
| Replace | Per field, sort refs by `start` descending, splice resolved values into **copy** of field string |
| Redact (preview) | `secrets[]` = active env `isSecret` plaintext + all dotenv values; `redactSecrets` on URL and **each** header value |
| Execute body | Always use resolved body from `resolveRequest` even though preview omits body |

### Send enablement matrix (authoritative)

| Condition | Preview panel | Send button | Ctrl/⌘+Enter |
|-----------|---------------|-------------|--------------|
| `hasVariables === false` | Hidden | Enabled (unless `isSending`) | Allowed (unless `isSending`) |
| `hasVariables === true`, preview loading | Shown (collapsed OK) | **Disabled** | **Blocked** |
| `hasVariables === true`, preview error | Shown | **Disabled** | **Blocked** |
| `hasVariables === true`, `unresolved != null` | Shown + inline error | **Disabled** | **Blocked** |
| `hasVariables === true`, resolved OK | Shown | Enabled (unless `isSending`) | Allowed (unless `isSending`) |

Derive `canSend` once in `AppLayout` and pass to `RequestLine` + keyboard handler — never gate only the button.

### Preview API contract

**`POST /api/preview`** body:

```typescript
{
  collectionId: string
  requestIndex: number
  environment?: string | null  // default: configStore.activeEnvironment
  method?: string
  url?: string
}
```

**200 response:**

```typescript
{
  url: string                      // redacted
  headers: { name: string, value: string }[]  // each value redacted
  unresolved: { name: string, raw: string } | null
  hasVariables: boolean            // required — web must not re-scan
}
```

- When `hasVariables === false` → return templates (still apply redaction if secret literals appear — edge case OK), `unresolved: null`
- Invalid/missing env name in store → treat as no environment for resolution (env-kind unresolved); prefer unresolved over inventing a new preview-only error code

### Execute API changes

Extend `ExecuteRequest` (preserve existing fields):

```typescript
{
  collectionId: string
  requestIndex: number
  followRedirects?: boolean        // unchanged — must keep working
  method?: string
  url?: string
  environment?: string | null      // NEW; default configStore.activeEnvironment
}
```

New error:

```typescript
{
  error: {
    code: 'UNRESOLVED_VARIABLE',
    message: 'Unresolved variable: {{host}}',
    details: { name: 'host', raw: '{{host}}' }
  }
}
```

Message must match UX-DR24 pattern using `raw`.

### EnvResolver constructor contract

Today (2.4): `new EnvResolver(dotenvStore)`.

This story:

```typescript
new EnvResolver(dotenvStore, environmentStore)
```

- `resolveEnv(name, environmentName)` — JetBrains lookup then dotenv fallback; returns `undefined` when `environmentName` null/missing or key absent in both
- `getSecretValuesForRedaction(environmentName?)` — union of dotenv values + `isSecret` plaintext from that environment (empty env name → dotenv only)
- Update all construction sites (`app.ts`) and tests that `new EnvResolver(...)`

### Epic Context

Epic 2 (UJ-3) capstone. **2.1** placeholder recognition; **2.2** env listing; **2.3** persistence; **2.4** dotenv load + masking scaffold. **2.5** completes UJ-3: Marcus sends to staging with secrets server-side, preview before send, blocked on missing vars.

Completing 2.5 closes Epic 2 — optional retrospective next.

### Architecture Compliance (MUST follow)

| AD / FR / UX | Requirement for 2.5 |
|--------------|---------------------|
| AD-6 | Web never calls target URLs — preview via server API only |
| AD-7 | Preview/execute redact secrets; no plaintext in API responses |
| AD-8 | Single server resolution path for preview + send |
| AD-10 | TypeBox schemas in `@reqor/shared-types`; validate inbound |
| AD-20 | EnvResolver merge: active env file → dotenv; extend 2.4 class |
| AD-22 | Web imports DTOs only; no parser types in web |
| AD-23 | Environment default from config when body omits `environment` |
| FR9 | Resolve at send time; preview shows resolved URL/headers |
| UX-DR10 | Send disabled when unresolved variables exist |
| UX-DR14 | Secret values in preview use `SECRET_MASK` / `SecretField` |
| UX-DR17 | Unresolved variable inline error naming variable |
| UX-DR20 | Inline collapsible preview below request line (not modal) |
| UX-DR21 | Ctrl/⌘+Enter send — must respect same Send gate as button |
| UX-DR24 | Exact microcopy: `Unresolved variable: {{host}}` |
| NFR6 | No plaintext secrets in logs — wire `redactSecrets` |

### Scope Boundaries

**In scope:** `resolveRequest` engine; EnvResolver extension; preview route; execute resolution (url/headers/body); web preview UI; Send + keyboard gating; redaction wiring; tests; demo path; deferred-work cleanup.

**Out of scope:**
- History recording on send → Epic 4
- Visual/raw editor → Epic 3
- Snippet/cURL export redaction → Epic 5
- Live reload of `.env` on change → static startup load (Story 2.4 design)
- Body in pre-send preview panel → UX-DR20 specifies URL + headers only for MVP
- Recursive env-value resolution → single-pass MVP only
- OAuth / OUT dynamic variables → remain unsupported (Story 2.1)
- Fixing `redactObject` array-of-object gap for general use → call `redactSecrets` per header value instead (optional follow-up to harden `redactObject`)

### Current Code State (touch points)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/server/src/env-resolver.ts` | Dotenv-only; ctor `(dotenvStore)` | **UPDATE** — inject `EnvironmentStore`; full merge + secret collection |
| `packages/server/src/resolve-request.ts` | Does not exist | **NEW** — shared resolution engine |
| `packages/server/src/routes/preview.ts` | Does not exist | **NEW** |
| `packages/server/src/routes/execute.ts` | Literal proxy via `executeRequest` | **UPDATE** — inject resolver stores |
| `packages/server/src/proxy/execute-request.ts` | Sends literal templates | **UPDATE** — resolve before fetch; use resolved body |
| `packages/server/src/app.ts` | `new EnvResolver(dotenvStore)`; execute only | **UPDATE** — pass `environmentStore`; register preview |
| `packages/server/src/redact-secrets.ts` | Scaffold; `redactObject` skips objects in arrays | **USE** `redactSecrets` per string; do not rely on `redactObject` for headers |
| `packages/shared-types/src/index.ts` | `ExecuteRequest` without environment | **UPDATE** — preview types + `hasVariables` + `environment` field |
| `packages/web/src/hooks/useExecuteRequest.ts` | No environment in body | **UPDATE** — pass `activeEnvironment`; keep `followRedirects` |
| `packages/web/src/hooks/usePreviewRequest.ts` | Does not exist | **NEW** — debounce + stale-identity guard |
| `packages/web/src/components/PreSendPreview.tsx` | Does not exist | **NEW** |
| `packages/web/src/components/RequestLine.tsx` | Send disabled only when sending | **UPDATE** — preview + unresolved gating |
| `packages/web/src/components/WorkspaceShell.tsx` | Pass-through props to RequestLine | **UPDATE** — thread preview/send-gate props |
| `packages/web/src/components/AppLayout.tsx` | Execute without env; Ctrl+Enter only checks `isPending` | **UPDATE** — preview orchestration + shared `canSend` |
| `packages/http-parser/src/variables.ts` | `scanVariables`, `collectRequestVariables` | **UNCHANGED** — import server-side only |
| `demo.http` | Literal `{{host}}` sent to wire | **VERIFY** — resolves when env selected |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Demo `{{host}}` deferred to 2.5 | **UPDATE** — mark item done after verify |

### Previous Story Intelligence (2.4)

- **Extend `EnvResolver`, do not replace** — comments in `env-resolver.ts` explicitly defer full merge to 2.5
- **`redactSecrets` / `redactObject`** exist and are unit-tested — wire `redactSecrets` into production paths now; remember `redactObject` does not redact `{name,value}` objects inside arrays
- **Two secret systems:** JetBrains `isSecret` (EnvironmentStore plaintext server-side) vs dotenv (DotenvStore Map) — preview must redact both; never expose either via API
- **`getSecretValuesForRedaction()`** today returns dotenv only — extend to accept optional environment name and include JetBrains secret values
- **Execute intentionally unchanged in 2.4** — this story modifies it
- **Dotenv load on `scanOnStart: false`** — resolution still works; no change needed
- **Review deferred items (awareness, not blockers):** `parseEnvLine` gaps; Fastify decorator casts; unbounded `.env` reads; demo `{{host}}` closed by this story’s Task 4

### Previous Story Intelligence (2.3)

- `AppHeader` mutates config; `AppLayout` reads — preserve dual ownership when adding preview
- Stale persisted env name → `activeEnvironment` null + "Environment unavailable" — preview should treat as no env (unresolved `env` vars; builtins/dotenv still OK)
- Optional `environment` on execute should accept same names config validates; invalid name → prefer resolve-time unresolved for execute/preview when env name not in store
- Prop plumbing is `AppLayout → WorkspaceShell → RequestLine` — update all three

### Downstream Consumer Contract (from 2.1)

Resolve per field using `VariableReference.location` + `start`/`end` + `raw`:

1. `env` → active environment then dotenv fallback (requires active env name)
2. `dotenv` → `resolveDotenv` (no env required)
3. `uuid` / `timestamp` / `randomInt` → generate at resolve time (no env required)
4. Replace in copy of url/headers/body — **not** stored DTO templates
5. Single-pass only — no nested `{{…}}` expansion inside resolved values

### Git Intelligence

- `6012a44` — Story 2.4: dotenv store, EnvResolver scaffold, SecretField, EnvironmentVariablesStrip
- `4f86586` — Story 2.3: config persistence, active environment API
- `0a4654e` — Story 2.2: EnvironmentStore, GET /api/environments
- Patterns: Fastify decorate + route plugins; TypeBox in shared-types; TanStack Query mutations; `app.inject` + temp repo tests; ESM `.js` imports; colocated Vitest; single fetch mock URL router on web; `selectionIdentityRef` race guard in `AppLayout`

### Testing Standards

- **Server:** `app.inject` with temp repo — fixture `http-client.env.json`, `.env.local`, `.http` file with mixed placeholders; assert preview redaction on header values, `hasVariables`, execute resolved URL hits mock target, body substitution on execute, UNRESOLVED_VARIABLE 400, dotenv/builtins without active env
- **Unit:** `resolve-request.test.ts` — offset replacement, merge precedence, first-unresolved-wins, builtins format, single-pass (env value containing `{{x}}` stays literal)
- **Web:** preview collapsible renders only when `hasVariables`; Send `disabled` when unresolved/loading; Ctrl/⌘+Enter blocked when `!canSend`; microcopy exact match UX-DR24
- **Regression:** existing execute redirect/timeout/`followRedirects` tests still pass with resolved URLs
- **Gate:** `pnpm turbo build test typecheck`
- **http-parser:** no changes expected; SM-2 ≥45/50

### Latest Technical Information

- **Node 24 LTS** — use `crypto.randomUUID()` (global `crypto` in Node 24)
- **No new npm deps** for resolution — `@reqor/http-parser` scan + server-side replace
- **TanStack Query v5** — prefer `useQuery` with `enabled: hasSelection` + debounced key for preview; match patterns in `useExecuteRequest.ts` / `useConfig.ts`
- **Fastify 5.x TypeBox provider** — follow existing route schema pattern from `execute.ts` / `config.ts`

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.5, FR9, UX-DR10/17/20/21/24]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-6, AD-7, AD-8, AD-10, AD-20, AD-22, AD-23]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — §4.2 Send sequence, §5 API surface]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — Pre-send preview, unresolved vars, Flow 3]
- [Source: `_bmad-output/specs/spec-reqor/glossary.md` — EnvResolver merge order]
- [Source: `_bmad-output/implementation-artifacts/2-4-secret-resolution-from-env-variants.md`]
- [Source: `_bmad-output/implementation-artifacts/2-1-variable-and-dynamic-placeholder-parsing.md` — Downstream consumer contract]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — demo `{{host}}` item]
- [Source: `packages/server/src/env-resolver.ts`, `proxy/execute-request.ts`, `routes/execute.ts`, `redact-secrets.ts`]
- [Source: `packages/http-parser/src/variables.ts`]
- [Source: `packages/web/src/components/AppLayout.tsx`, `WorkspaceShell.tsx`, `RequestLine.tsx`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

### Completion Notes List

- Extended `EnvResolver` with `EnvironmentStore`, `resolveEnv`, `resolveBuiltin`, and env-aware `getSecretValuesForRedaction`.
- Added shared `resolveRequest()` (single-pass, right-to-left splice) used by both `POST /api/preview` and `POST /api/execute`.
- Preview redacts URL + each header value via `redactSecrets`; execute resolves url/headers/body and returns `UNRESOLVED_VARIABLE` 400 when blocked.
- Web: debounced `usePreviewRequest`, collapsible `PreSendPreview`, shared `canSend` gating for Send button and Ctrl/⌘+Enter.
- Verified `demo.http` + `development` → `https://httpbin.dev/get?source=reqor-demo`; deferred-work demo item marked done.
- `pnpm turbo build test typecheck` passed workspace-wide (http-parser fixtures non-regressing).

### File List

- `_bmad-output/implementation-artifacts/2-5-send-time-variable-resolution-and-pre-send-preview.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/shared-types/src/index.ts`
- `packages/shared-types/src/index.test.ts`
- `packages/server/src/env-resolver.ts`
- `packages/server/src/env-resolver.test.ts`
- `packages/server/src/resolve-request.ts`
- `packages/server/src/resolve-request.test.ts`
- `packages/server/src/routes/preview.ts`
- `packages/server/src/preview.test.ts`
- `packages/server/src/routes/execute.ts`
- `packages/server/src/proxy/execute-request.ts`
- `packages/server/src/execute.test.ts`
- `packages/server/src/app.ts`
- `packages/web/src/hooks/usePreviewRequest.ts`
- `packages/web/src/components/PreSendPreview.tsx`
- `packages/web/src/components/PreSendPreview.test.tsx`
- `packages/web/src/components/RequestLine.tsx`
- `packages/web/src/components/RequestLine.test.tsx`
- `packages/web/src/components/WorkspaceShell.tsx`
- `packages/web/src/components/WorkspaceShell.test.tsx`
- `packages/web/src/components/AppLayout.tsx`
- `packages/web/src/App.test.tsx`

## Change Log

- 2026-07-17: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-17: Story context validated — hasVariables contract, Send enablement matrix (button + keyboard), redactSecrets-per-header, WorkspaceShell plumbing, EnvResolver ctor, single-pass + env-less builtins/dotenv, stale preview guard, followRedirects/body execute rules, deferred-work demo cleanup
- 2026-07-17: Implemented send-time resolution, preview API, execute wiring, web preview + Send gating; status → review
