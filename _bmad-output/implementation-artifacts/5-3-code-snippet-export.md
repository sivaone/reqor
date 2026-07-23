---
title: 'Story 5.3: Code Snippet Export'
type: 'feature'
created: '2026-07-22'
status: 'done'
baseline_commit: 'be3c8bf1df7fa53053eb1e8bc9d50c3850e06680'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-2-curl-export.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-1-curl-import.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Developers integrating an API into application code must manually translate a configured Reqor request (method, URL, headers, body, env vars) into runnable JavaScript, Python, or cURL — error-prone and slow.

**Approach:** Add server-side snippet serializers in `packages/server`, expose **`POST /api/export/snippet`** (draft-aware; same merge/resolve/block path as cURL export), and wire a request-toolbar **snippet export popover** with JavaScript (`fetch`), Python (`requests`), and cURL tabs — each with copy-to-clipboard and `/* SECRET */` placeholder redaction (FR19; depends on FR9/FR14/FR15).

## Boundaries & Constraints

**Always:** Serialize snippets server-side only (AD-3); reuse `mergeDraftOverrides` → `resolveRequest` → execute-style unresolved block → secret redaction → language serializer; use **`/* SECRET */`** placeholder for secrets in snippets (NFR6 / UX-DR19) — **not** `SECRET_MASK` (`••••••`); TypeBox schemas in `@reqor/shared-types`; popover tabs: JavaScript, Python, cURL; Esc closes popover (UX-DR21); export toolbar control has `aria-label="Export code snippet"` (UX-DR22); clipboard via existing `copyToClipboard`; flat elevation — border + surface tone, no drop shadow (UX-DR23).

**Block If:** Collection or request not found (`NOT_FOUND`); collection parse errors or empty collection (`INVALID_REQUEST`); unresolved variables (`UNRESOLVED_VARIABLE` 400 — execute semantics); no loaded request + draft (omit export callback).

## Do / Don't

| Concern | Do | Don't |
|---------|----|-------|
| Secret redaction in snippets | `/* SECRET */` via `redactSecrets(..., '/* SECRET */')` / `SECRET_SNIPPET_PLACEHOLDER` | `SECRET_MASK` (`••••••`) — Copy cURL only |
| cURL tab inside popover | `serializeCurl` on snippet-redacted fields | Reuse Copy cURL API response (`••••••`) |
| Unresolved vars | Execute-style 400 `UNRESOLVED_VARIABLE` | Preview 200 + `unresolved` field |
| Request identity / body | `PreviewRequest` fields + `language` (no `followRedirects`) | Planning `GET /api/export/snippet/:requestId` |
| Route → loader | Extract `language`, pass remaining PreviewRequest-shaped fields into loader | Pass `language` into `mergeDraftOverrides` / loader |
| Loader typing | Widen loader input to `PreviewRequestType` (or sibling that accepts it) | Require `ExportCurlRequestType` only |
| Toolbar visibility | Omit `onExportSnippet` when `!(activeRequest && draft)` | Disabled button when no selection |
| Toolbar control | Text button `"Export"` matching Import/Copy cURL + `aria-label="Export code snippet"` | Icon-only control (no icon library; keep toolbar consistent) |
| Load path | Extend `load-export-request.ts` with snippet redaction mode | Duplicate merge/resolve in serializers |
| Serializer location | `packages/server/src/serialize-snippet-*.ts` | `packages/http-parser` |
| Body kinds | Handle `json`, `form`, `raw` explicitly | Invent form/raw behavior ad hoc |
| Popover UX | Anchored popover/dialog panel with tabs | Full-screen modal like cURL import |
| Copy cURL (5.2) | Leave one-click + `SECRET_MASK` unchanged | Merge into popover or change its redaction |
| Client generation | Never | Generate snippets in `packages/web` |
| Extra languages | Never | Go/Java tabs (post-MVP) |
| Regressions | Never | Break Import cURL, Copy cURL, preview, execute, save, or history |

## API Shape (draft-aware POST)

Planning epics originally listed `GET /api/export/snippet/:requestId`. **Authoritative contract (epic-5-context):** draft-aware POST.

- **`POST /api/export/snippet`**
- Body: **`ExportSnippetRequest`** — compose with TypeBox `Type.Intersect` / `Type.Composite` of `PreviewRequest` plus `{ language: Type.Union([Type.Literal('javascript'), Type.Literal('python'), Type.Literal('curl')]) }`
- Response: **`ExportSnippetResponse`** — `{ language: string, snippet: string }`
- Errors: standard envelope — `NOT_FOUND` (404), `INVALID_REQUEST` (400), `UNRESOLVED_VARIABLE` (400 with `details: { name, raw }`)

**Handler flow:** Validate body → destructure `{ language, ...previewFields }` → `loadMergedRequestForSnippetExport(previewFields)` (or options form with `secretReplacement`) → dispatch serializer by `language` → `{ language, snippet }`.

**Snippet redaction vs cURL export:** Non-secret portions must match resolved Send values. Secret substrings become **`/* SECRET */`** so pasted code is structurally runnable after the developer substitutes real values. Do **not** reuse `loadMergedRequestForExport` output directly — it applies `SECRET_MASK`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_JS | POST + JSON body + headers, `language: 'javascript'` | 200 `{ snippet }` with `fetch(...)` including method, URL, headers, body | No error |
| HAPPY_PATH_PYTHON | Same request, `language: 'python'` | 200 with correct `requests.<method>(...)` for the HTTP method | No error |
| HAPPY_PATH_CURL_TAB | Same request, `language: 'curl'` | 200 with cURL string; secrets as `/* SECRET */` not `••••••` | No error |
| DRAFT_OVERRIDE | Unsaved URL change in editor | Snippet reflects **draft**, not disk baseline | No error |
| ENV_SUBSTITUTION | URL `https://{{host}}/api` with env `host=example.com` | Snippet contains `https://example.com/api` | No error |
| SECRET_REDACTION | Header/body contains resolved secret value | Substring replaced with `/* SECRET */`; never plaintext | No error |
| UNRESOLVED_VAR | `{{missing}}` with no env value | 400 `UNRESOLVED_VARIABLE`; popover shows error, no clipboard write | Error envelope |
| NO_BODY_METHODS | GET / HEAD / OPTIONS | JS/Python omit body; cURL tab omits `-d`/`--json` | No error |
| JSON_BODY | Body kind `json` | JS: `JSON.stringify(...)` when parseable; Python: `json=` when parseable | No error |
| FORM_BODY | Body kind `form` | JS: string body (or `URLSearchParams` when content is `a=b&c=d`); Python: `data=` string (or dict if parseable as form fields) | No error |
| RAW_BODY | Body kind `raw` | JS: string `body: '...'`; Python: `data='...'` | No error |
| INVALID_LANGUAGE | Unknown `language` value | 400 `INVALID_REQUEST` (schema validation) | Error envelope |
| STALE_TAB | Switch tabs / navigate while fetch in flight | Ignore stale responses; do not overwrite active tab or clipboard | N/A |
| CLIPBOARD | Export 200 + user clicks Copy on active tab | `writeText(snippet)`; brief success status | Status error if clipboard denied |
| NO_SELECTION | No `activeRequest` or no `draft` | Do **not** pass `onExportSnippet` (button omitted) | N/A |
| ESC | Popover open | Esc closes popover without side effects (UX-DR21) | N/A |

</intent-contract>

## Story

As a **developer integrating an API into application code**,
I want to copy the current request as JavaScript, Python, or cURL snippets,
So that I can paste runnable code into my project.

## Acceptance Criteria

1. Given a loaded request with active environment, when I open the snippet export popover and select a tab, then the snippet includes method, URL, headers, and body with variables substituted and secrets as `/* SECRET */` placeholders (FR19, UX-DR19, NFR6).
2. Given unsaved draft edits, when I export a snippet, then the output reflects draft values (not disk-only baseline).
3. Given an unresolved variable, when I export a snippet, then the UI shows an error and no clipboard write occurs.
4. Given the popover is open, when I press Esc, then the popover closes (UX-DR21).
5. Given the export toolbar control, when inspected, then it has `aria-label="Export code snippet"` (UX-DR22) and copy-to-clipboard works per tab.
6. Given Copy cURL (Story 5.2), when I use it, then behavior is unchanged (`SECRET_MASK` redaction, one-click copy, no popover).

## Code Map

### New

- `packages/shared-types/src/index.ts` — `SnippetLanguage`; `ExportSnippetRequest` via `Type.Intersect`/`Type.Composite` of `PreviewRequest` + `language`; `ExportSnippetResponse`; `SECRET_SNIPPET_PLACEHOLDER = '/* SECRET */'`; schema smoke in `index.test.ts`
- `packages/server/src/redact-secrets.ts` — `redactSecrets(text, secrets, replacement?)` defaulting to `SECRET_MASK`; unit-test optional replacement; existing callers unchanged
- `packages/server/src/load-export-request.ts` — `loadMergedRequestForSnippetExport(previewFields)` or `loadMergedRequestForExport(..., { secretReplacement })`; input typed as `PreviewRequestType` (not language-bearing body)
- `packages/server/src/serialize-snippet-javascript.ts` — `serializeSnippetJavaScript(redactedRequest)` → fetch multi-line string
- `packages/server/src/serialize-snippet-python.ts` — `serializeSnippetPython(redactedRequest)` → requests multi-line string with method mapping
- `packages/server/src/serialize-snippet.test.ts` — JS/Python/cURL-tab, secrets, no-body methods, `json`/`form`/`raw` bodies
- `packages/server/src/routes/export.ts` — `POST /api/export/snippet`; strip `language` before loader; dispatch serializer (`curl` → `serializeCurl` on snippet-redacted fields)
- `packages/server/src/export.test.ts` — env sub, `/* SECRET */`, unresolved 400, draft override, invalid language, cURL tab placeholder ≠ `SECRET_MASK`, form/raw bodies
- `packages/web/src/hooks/useExportSnippet.ts` — TanStack mutation + `ExportSnippetError`; validate `typeof data.snippet === 'string'` (and `data.language`)
- `packages/web/src/components/SnippetExportPopover.tsx` — tabs (`role="tablist"` / `role="tab"` / `aria-selected`), mono snippet, Copy, Esc, status, generation+language guard
- `packages/web/src/components/RequestLine.tsx` — optional `onExportSnippet?`; text `"Export"` button when set; `aria-label="Export code snippet"`

### Update

- `packages/server/src/app.ts` — no new registration if `exportRoutes` already registered (add handler inside existing plugin)
- `packages/web/src/components/RequestEditor.tsx` / `WorkspaceShell.tsx` — pass-through snippet export props (same chain as Import / Copy cURL)
- `packages/web/src/components/AppLayout.tsx` — popover open state; `handleExportSnippet(language)` with preview-shaped payload + generation token for tab content and clipboard; clear snippet status on request select/clear; `onExportSnippet={activeRequest && draft ? openPopover : undefined}`

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared-types/src/index.ts` — `SnippetLanguage`, `ExportSnippetRequest` (Intersect/Composite), `ExportSnippetResponse`, `SECRET_SNIPPET_PLACEHOLDER` (AC: #1)
- [x] `packages/server/src/redact-secrets.ts` — optional `replacement`; unit test for `/* SECRET */` + default `SECRET_MASK` (AC: #1, #6)
- [x] `packages/server/src/load-export-request.ts` — snippet redaction loader; `PreviewRequestType` input (AC: #1, #2)
- [x] `packages/server/src/serialize-snippet-javascript.ts` — fetch serializer; body kinds + header quoting (AC: #1)
- [x] `packages/server/src/serialize-snippet-python.ts` — requests serializer; method map + body kinds (AC: #1)
- [x] `packages/server/src/serialize-snippet.test.ts` — serializer unit tests including form/raw/no-body methods (AC: #1)
- [x] `packages/server/src/routes/export.ts` — `POST /api/export/snippet`; strip `language` before loader (AC: #1, #2, #3)
- [x] `packages/server/src/export.test.ts` — integration tests for snippet API (AC: #1, #2, #3, #6)
- [x] `packages/web/src/hooks/useExportSnippet.ts` — mutation + response field validation (AC: #1, #5)
- [x] `packages/web/src/components/SnippetExportPopover.tsx` — tabs + a11y + copy + Esc + stale-tab guard (AC: #1, #3, #4, #5)
- [x] `packages/web/src/components/RequestLine.tsx` — Export text button + aria-label (AC: #5)
- [x] `packages/web/src/components/RequestEditor.tsx` / `WorkspaceShell.tsx` — wire props (AC: #5)
- [x] `packages/web/src/components/AppLayout.tsx` — popover state + handlers + generation guards (AC: #2, #3, #4, #5, #6)
- [x] `pnpm turbo build test typecheck` — workspace passes (AC: #1–#6)

### Review Findings

- [x] [Review][Decision] Centered `<dialog>` modal vs anchored toolbar popover — **Resolved:** accept centered dialog for MVP (matches Import cURL UX); anchoring deferred.

- [x] [Review][Patch] Stale snippet text visible during refetch [packages/web/src/components/SnippetExportPopover.tsx:70-207] — Clear active-tab cache on fetch start; show loading state instead of stale text.
- [x] [Review][Patch] Popover not closed on request select/clear [packages/web/src/components/AppLayout.tsx:287-310] — Close popover in `handleSelectRequest` / `handleClearSelection`.
- [x] [Review][Patch] Internal stale-export error shown to user [packages/web/src/components/AppLayout.tsx:682-684] — Popover silently ignores `ExportSnippetError` with code `STALE`.
- [x] [Review][Patch] String escapers omit control characters [packages/server/src/serialize-snippet-javascript.ts:5-7] — Escape `\n`, `\r`, `\t`, U+2028/U+2029.
- [x] [Review][Patch] String escapers omit control characters [packages/server/src/serialize-snippet-python.ts:15-17] — Same control-character escaping added.
- [x] [Review][Patch] Duplicate header names silently dropped [packages/server/src/serialize-snippet-javascript.ts:46-50] — Headers serialized as array of `[name, value]` pairs.
- [x] [Review][Patch] Duplicate header names silently dropped [packages/server/src/serialize-snippet-python.ts:104-108] — Headers serialized as list of tuples.
- [x] [Review][Patch] Python JSON NaN/Infinity literals invalid [packages/server/src/serialize-snippet-python.ts:26-27] — Emit `float('nan')` / `float('inf')` / `float('-inf')`.
- [x] [Review][Patch] ExportSnippetResponse language unconstrained [packages/shared-types/src/index.ts] — Response uses `SnippetLanguage` union.
- [x] [Review][Patch] Invalid-language test too weak [packages/server/src/export.test.ts:219-237] — Asserts non-200 and body mentions `language` (global validation error envelope not yet wired).
- [x] [Review][Patch] Inactive tab aria-controls targets missing [packages/web/src/components/SnippetExportPopover.tsx:176] — Render all tabpanels with `hidden` on inactive tabs.
- [x] [Review][Patch] Missing JSON body secret redaction integration test [packages/server/src/export.test.ts] — Added end-to-end JSON body secret test.

- [x] [Review][Defer] No web component/hook tests for popover [packages/web/src/components/SnippetExportPopover.tsx] — deferred, pre-existing
- [x] [Review][Defer] Form body percent-encoding not decoded [packages/server/src/serialize-snippet-javascript.ts:30-31] — deferred, pre-existing

## Dev Notes

### Serializer design (JavaScript)

Target readable, paste-ready output:

```javascript
fetch('https://example.com/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer /* SECRET */',
  },
  body: JSON.stringify({ name: 'test' }),
})
```

- Quote **all** header names as strings (or at least every name that is not a valid JS identifier — always-quoting is preferred).
- Use single-quoted strings where practical; escape embedded quotes in values and bodies.
- Body kinds (`RequestBodyDto.kind`):
  - `json` — prefer `JSON.stringify(<parsed>)` when content parses; else string body fallback
  - `form` — string `body: 'a=b&c=d'` (or `new URLSearchParams(...)` when content is simple `key=value&...`)
  - `raw` — string `body: '...'`
- Omit `body` for GET / HEAD / OPTIONS.

### Serializer design (Python)

```python
import requests

response = requests.post(
    'https://example.com/api/users',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer /* SECRET */',
    },
    json={'name': 'test'},
)
```

- Map HTTP method to `requests` helpers: `GET`→`get`, `POST`→`post`, `PUT`→`put`, `PATCH`→`patch`, `DELETE`→`delete`, `HEAD`→`head`, `OPTIONS`→`options`. Fallback: `requests.request('METHOD', url, ...)`.
- Body kinds:
  - `json` — `json=` when content parses as JSON; else `data=` string
  - `form` / `raw` — `data=` string (dict only when form content safely parses to key/value pairs)
- Omit body param for GET / HEAD / OPTIONS.

### cURL tab (inside popover)

- Call existing `serializeCurl` from `@reqor/http-parser` on **snippet-redacted** request fields (`/* SECRET */` in url/header/body values).
- This differs from **Copy cURL** which uses `SECRET_MASK` — intentional per epic-5-context.

### Popover UX

- Trigger: text `"Export"` button in request toolbar (alongside Import cURL / Copy cURL), `aria-label="Export code snippet"`.
- Open: fetch snippet for default tab (JavaScript) on open; lazy-fetch other tabs on first select (acceptable) or prefetch all three.
- Tabs: `role="tablist"` / `role="tab"` / `aria-selected` for the active language.
- Stale responses: bump a generation ref on open, tab change, request select/clear, and close; ignore in-flight results whose generation (and language) no longer match before updating snippet pane or writing clipboard.
- Display: read-only `<pre>` or `<textarea readonly>` with mono font (`DESIGN.md` — 13px mono for snippets).
- Copy: per-tab Copy button → `copyToClipboard(snippet)`; show inline success/error.
- Close: Esc, click outside, or explicit close control.
- Styling: `border border-border bg-surface` — no box-shadow (UX-DR23). Popover may use `<dialog>` with lightweight positioning (same backdrop pattern as import is acceptable if anchored near toolbar).

### AppLayout payload (mirror Copy cURL)

```typescript
{
  collectionId: selectedRequest.collectionId,
  requestIndex: selectedRequest.requestIndex,
  environment: activeEnvironment,
  method: draft.method,
  url: draft.url,
  headers: draft.headers,
  body: draft.body ?? null,
  language: 'javascript' | 'python' | 'curl',
}
```

Apply generation-token pattern from `handleCopyCurl` / `copyCurlGenerationRef` to prevent stale clipboard writes **and** stale tab content on navigation or fast tab switches.

### Hook response validation (mirror `useExportCurl`)

```typescript
if (!data || typeof data.snippet !== 'string') {
  throw new ExportSnippetError('Invalid export response')
}
```

Prefer also checking `typeof data.language === 'string'`.

## Previous Story Intelligence (5.2)

- `loadMergedRequestForExport` returns `SECRET_MASK`-redacted fields — **do not reuse for snippets**; extend loader or add sibling with `/* SECRET */`.
- `POST /api/export/curl` + `ExportCurlRequest = PreviewRequest` — snippet request adds `language` only; strip it before the shared loader.
- `exportRoutes` plugin already registered in `app.ts` with preview-like deps — add snippet route there.
- Copy cURL: one-click, no modal; snippet export: popover with tabs — different UX per FR18 vs FR19.
- Preserve: generation guards, response field validation, preview-shaped body, `--data-raw` for `@` prefix in cURL serializer.
- Toolbar visibility: `onCopyCurl={activeRequest && draft ? … : undefined}` — snippet export must match.
- Toolbar styling: Import/Copy use text buttons with `aria-label` — Export follows the same pattern.

## Architecture Compliance

| Rule | Application |
|------|-------------|
| AD-3 | Server-side serialization; web never generates snippets |
| AD-8 / FR9 / FR14 / FR15 | Single-pass `resolveRequest` + active env + dotenv secrets |
| AD-10 | TanStack mutation; TypeBox DTOs; Fastify schema |
| AD-21 | `collectionId` + `requestIndex`; no `:requestId` export path |
| NFR6 | Secrets as `/* SECRET */` in snippets — never plaintext |
| FR19 | JS fetch, Python requests, cURL tabs with copy |
| UX-DR19 | Popover tabs + secret placeholder comments |
| UX-DR21 | Esc closes popover |
| UX-DR22 | Screen reader label on Export control (`aria-label="Export code snippet"`) |
| UX-DR23 | Flat elevation, no drop shadow |

## Verification

**Commands:**
- `pnpm turbo build test typecheck` — all packages green

**Manual checks:**
- `demo.http` + active env with secret (`http-client.private.env.json`): open popover → JS/Python/cURL tabs show `/* SECRET */` where secrets were; no plaintext secret in snippet or network response
- Edit URL in draft without Save → snippet uses edited URL
- Request with `{{unresolved}}` → error in popover, clipboard unchanged
- Switch tabs quickly while loading → pane shows the selected language only (no stale overwrite)
- Form and raw body requests → sensible JS/Python snippets (not JSON-only assumptions)
- Copy cURL still uses `••••••` masking (regression check)
- Esc closes popover; Tab reaches Export button and Copy controls; tabs expose selected state to assistive tech

## References

- [Source: `_bmad-output/implementation-artifacts/epic-5-context.md`]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.3 / FR19 / UX-DR19]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — Snippet export popover]
- [Source: `packages/server/src/load-export-request.ts`]
- [Source: `packages/server/src/routes/export.ts`]
- [Source: `packages/http-parser/src/serialize-curl.ts`]
- [Source: `packages/shared-types/src/index.ts` — `PreviewRequest`, `RequestBodyDto` kinds]
- [Source: `packages/web/src/hooks/useExportCurl.ts`]
- [Source: `packages/web/src/components/CurlImportDialog.tsx` — dialog/Esc pattern]
- [Source: `packages/web/src/components/AppLayout.tsx` — handleCopyCurl]
- [Source: `packages/web/src/components/RequestLine.tsx` — toolbar button pattern]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

(none)

### Completion Notes List

- Added `POST /api/export/snippet` with draft-aware merge/resolve path and `/* SECRET */` redaction via `loadMergedRequestForSnippetExport`.
- Implemented JavaScript (`fetch`), Python (`requests`), and cURL serializers server-side; cURL tab uses snippet placeholder, Copy cURL unchanged with `SECRET_MASK`.
- Wired Export toolbar button and `SnippetExportPopover` with tabbed UI, Esc close, copy-to-clipboard, stale-response guards, and unresolved-variable error display.
- All workspace tests pass: `pnpm turbo build test typecheck`.
- Code review patches applied: stale-snippet guards, popover lifecycle, serializer hardening, schema/test improvements.

### File List

- packages/shared-types/src/index.ts
- packages/shared-types/src/index.test.ts
- packages/server/src/redact-secrets.ts
- packages/server/src/redact-secrets.test.ts
- packages/server/src/load-export-request.ts
- packages/server/src/serialize-snippet-javascript.ts
- packages/server/src/serialize-snippet-python.ts
- packages/server/src/serialize-snippet.test.ts
- packages/server/src/routes/export.ts
- packages/server/src/export.test.ts
- packages/web/src/hooks/useExportSnippet.ts
- packages/web/src/components/SnippetExportPopover.tsx
- packages/web/src/components/RequestLine.tsx
- packages/web/src/components/RequestEditor.tsx
- packages/web/src/components/WorkspaceShell.tsx
- packages/web/src/components/AppLayout.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-22: Story 5.3 ready-for-dev — code snippet export popover (JS/Python/cURL) with `/* SECRET */` redaction, body-kind serializers, and stale-tab guards.
- 2026-07-22: Implemented snippet export API, serializers, popover UI, and tests; story marked review.
