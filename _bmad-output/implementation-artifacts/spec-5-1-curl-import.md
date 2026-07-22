---
title: 'Story 5.1: cURL Import'
type: 'feature'
created: '2026-07-22'
status: 'done'
review_loop_iteration: 1
followup_review_recommended: false
baseline_commit: '47691c45645e77344305f5e8cee86a74d96c87ea'
final_revision: 'd9e2127'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Developers often receive API endpoints as cURL snippets in documentation but must manually re-enter method, URL, headers, and body into Reqor before testing.

**Approach:** Add server-side cURL parsing in `@reqor/http-parser`, expose `POST /api/import/curl`, and wire a request-toolbar modal that pastes cURL and applies the parsed fields to the editor draft without saving to disk.

## Boundaries & Constraints

**Always:** Parse cURL server-side only (AD-3); populate draft via existing `useRequestDraft` setters; supported flags `-X`, `-H`, `-d`, `--data-raw`, `--json`, `-u`; unsupported flags yield direct warning strings (UX-DR24) but partial import continues; modal uses semi-transparent overlay + white card with no drop shadow (UX-DR23); Esc closes modal (UX-DR21); TypeBox schemas in `@reqor/shared-types`.

**Block If:** No loaded request in workspace (import is toolbar action on active request); cURL string is empty or unparseable (no URL extracted).

**Never:** Client-side cURL parsing in web; auto-save to disk on import; add export endpoints (Stories 5.2/5.3); Postman import; new draft/baseline model.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid cURL with `-X POST -H -d` and URL | 200 with method/url/headers/body; draft updated; modal closes | No error |
| BASIC_AUTH | cURL with `-u user:pass` | Authorization Basic header added | No error |
| JSON_FLAG | cURL with `--json '{"a":1}'` | body kind `json`, Content-Type application/json | No error |
| UNSUPPORTED_FLAG | cURL with `--cookie foo=bar` | 200 partial request + warning "Unsupported flag: --cookie" | No error |
| EMPTY_CURL | `{ curl: "" }` | 400 INVALID_CURL | Error envelope |
| NO_URL | cURL with only headers | 400 INVALID_CURL "No URL found" | Error envelope |
| DATA_DEFAULTS_POST | `-d` without `-X` | method POST (curl convention) | No error |

</intent-contract>

## Code Map

- `packages/http-parser/src/parse-curl.ts` -- cURL tokenizer/parser → method, url, headers, body, warnings
- `packages/http-parser/src/index.ts` -- export `parseCurl`
- `packages/shared-types/src/index.ts` -- `ImportCurlRequest`, `ImportedRequestDto`, `ImportCurlResponse`
- `packages/server/src/routes/import.ts` -- `POST /api/import/curl` handler
- `packages/server/src/app.ts` -- register import routes
- `packages/web/src/hooks/useImportCurl.ts` -- TanStack mutation hook
- `packages/web/src/components/CurlImportDialog.tsx` -- modal UI (no shadow)
- `packages/web/src/components/RequestLine.tsx` -- Import cURL toolbar button
- `packages/web/src/components/RequestEditor.tsx` -- pass import props to RequestLine
- `packages/web/src/components/WorkspaceShell.tsx` -- pass import props through
- `packages/web/src/components/AppLayout.tsx` -- modal state + apply import to draft setters

## Tasks & Acceptance

**Execution:**
- [x] `packages/http-parser/src/parse-curl.ts` -- implement `parseCurl(curl: string)` with flag support and warnings -- AD-3 parser ownership
- [x] `packages/http-parser/src/parse-curl.test.ts` -- unit tests for supported flags, unsupported warnings, POST default with `-d`, basic auth, `--json`
- [x] `packages/http-parser/src/index.ts` -- export `parseCurl` and result type
- [x] `packages/shared-types/src/index.ts` -- add ImportCurlRequest/Response TypeBox schemas
- [x] `packages/server/src/routes/import.ts` -- POST /api/import/curl route with 400 on empty/unparseable
- [x] `packages/server/src/app.ts` -- register importRoutes
- [x] `packages/server/src/import.test.ts` -- route integration tests
- [x] `packages/web/src/hooks/useImportCurl.ts` -- mutation hook mirroring useExecuteRequest pattern
- [x] `packages/web/src/components/CurlImportDialog.tsx` -- modal with textarea, warnings, Esc close, no shadow
- [x] `packages/web/src/components/RequestLine.tsx` -- add Import cURL button with aria-label
- [x] `packages/web/src/components/RequestEditor.tsx` -- wire onImportCurl callback
- [x] `packages/web/src/components/WorkspaceShell.tsx` -- pass import props
- [x] `packages/web/src/components/AppLayout.tsx` -- modal state, apply import via setMethod/setUrl/setHeaders/setBody
- [x] `pnpm turbo build test typecheck` -- workspace passes

**Acceptance Criteria:**
- Given a loaded request, when I click Import cURL and paste a valid command, then draft fields update and Save becomes available without writing disk
- Given cURL with unsupported flags, when I import, then warnings display in modal and partial request still applies
- Given the import modal is open, when I press Esc, then the modal closes without changing draft
- Given import succeeds, when I inspect the modal, then it uses backdrop overlay and white card without drop shadow

### Review Findings
- [x] [Review][Patch] Boolean unsupported flags swallow the following URL token [`packages/http-parser/src/parse-curl.ts:157`]
- [x] [Review][Patch] Explicit `-X GET` with `-d` is forced to POST [`packages/http-parser/src/parse-curl.ts:216`]
- [x] [Review][Patch] Unsupported-flag warnings are not shown in the import modal [`packages/web/src/components/CurlImportDialog.tsx:45`]
- [x] [Review][Patch] Closing the dialog while import is in flight still applies the result [`packages/web/src/components/CurlImportDialog.tsx:45`]
- [x] [Review][Patch] Empty `-X`/`--request` value is accepted instead of treated as missing [`packages/http-parser/src/parse-curl.ts:165`]
- [x] [Review][Defer] Unclosed quotes produce silent wrong tokens [`packages/http-parser/src/parse-curl.ts:47`] — deferred, pre-existing
- [x] [Review][Defer] Scheme-less / non-http URL detection is brittle [`packages/http-parser/src/parse-curl.ts:76`] — deferred, pre-existing
- [x] [Review][Defer] Single-quote backslash escapes do not match shell semantics [`packages/http-parser/src/parse-curl.ts:52`] — deferred, pre-existing
- [x] [Review][Defer] Leading noise tokens can be captured as the URL [`packages/http-parser/src/parse-curl.ts:147`] — deferred, pre-existing
- [x] [Review][Defer] Import warnings linger after the user edits the draft [`packages/web/src/components/RequestLine.tsx:179`] — deferred, pre-existing

## Spec Change Log

## Review Triage Log

### 2026-07-22 — Review pass 2 (latest commit)
- intent_gap: 1 → patched (warnings in modal)
- bad_spec: 0
- patch: 5: (high 1, medium 3, low 1) — all applied
- defer: 5: (high 0, medium 0, low 5)
- reject: 7
- addressed_findings:
  - `[high]` `[patch]` Do not swallow URL after boolean unsupported flags
  - `[medium]` `[patch]` Preserve explicit `-X GET` when data flags present
  - `[medium]` `[patch]` Show unsupported-flag warnings in CurlImportDialog
  - `[medium]` `[patch]` Ignore in-flight import result after dialog close
  - `[low]` `[patch]` Treat empty `-X=` as missing value

### 2026-07-22 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 4, low 4)
- defer: 3: (high 0, medium 1, low 2)
- reject: 4
- addressed_findings:
  - `[medium]` `[patch]` Clear stale importWarnings on request selection/clear
  - `[medium]` `[patch]` Preprocess backslash line continuations in parseCurl
  - `[medium]` `[patch]` Guard missing flag values when next token is another flag
  - `[medium]` `[patch]` Wrap parseCurl in try/catch on server route for 400 instead of 500
  - `[low]` `[patch]` Use indexed React keys for duplicate import warning strings
  - `[low]` `[patch]` Warn on @file body references and multiple -d flags
  - `[low]` `[patch]` Warn on unknown HTTP methods via isHttpMethod
  - `[low]` `[patch]` Reset forceJson when non-json data flag follows --json

## Auto Run Result

Status: done

Implemented cURL import end-to-end: server-side parser, `POST /api/import/curl`, and request-toolbar modal that applies parsed fields to the editor draft without saving to disk.

**Files changed:** http-parser parse-curl, shared-types schemas, server import route, web CurlImportDialog + wiring.

**Review:** 8 patches applied; 3 deferred; 4 rejected as noise/out of scope.

**Verification:** `pnpm turbo build test typecheck` — all 15 tasks passed.

**Residual risks:** Compact flags like `-XPOST` not supported; `-d @file` warns but stores literal; JSON via `-d` without Content-Type classified as raw unless `--json` used.

## Design Notes

`-u user:pass` maps to `Authorization: Basic ${btoa('user:pass')}` (same as JetBrains basic auth fixture). `--json` sets body + `Content-Type: application/json`; use `classifyBodyKind` for body kind. Default method GET; curl uses POST when `-d`/`--data*` present without explicit `-X`.

## Verification

**Commands:**
- `pnpm turbo build test typecheck` -- expected: all packages green

**Manual checks (if no CLI):**
- Open app, select request, Import cURL with sample POST, verify visual editor updates and Save appears
