---
title: 'Story 5.2: cURL Export'
type: 'feature'
created: '2026-07-22'
status: 'ready-for-dev'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-1-curl-import.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Developers configure requests in Reqor with environment variables and secrets but cannot share a terminal-ready cURL command with teammates without manually reconstructing method, URL, headers, and body.

**Approach:** Add server-side `serializeCurl` in `@reqor/http-parser`, expose **`POST /api/export/curl`** (draft-aware; reuse execute’s merge/resolve/block path), and wire a request-toolbar **Copy cURL** action that copies the redacted, environment-resolved command to the clipboard (FR18; depends on FR9/FR14/FR15 for env + secrets).

## Boundaries & Constraints

**Always:** Serialize cURL server-side only (AD-3); `mergeDraftOverrides` → `resolveRequest` → `resolveEnvironmentName` → substring `redactSecrets` on **url, every header value, and body content** → `serializeCurl`; use `SECRET_MASK` (`••••••`) from `@reqor/shared-types` (NFR6); non-secret env vars appear as resolved literals; TypeBox schemas in `@reqor/shared-types`; toolbar control has `aria-label="Copy cURL"` (UX-DR22); clipboard via `copyToClipboard` → `navigator.clipboard.writeText`.

**Block If:** Collection or request not found (`NOT_FOUND`); collection parse errors or empty collection (`INVALID_REQUEST`, same as execute); unresolved variables (`UNRESOLVED_VARIABLE` 400 — **execute semantics, not preview**); no loaded request + draft (omit `onCopyCurl` callback).

**Never:** Client-side cURL generation; plaintext secrets in API/clipboard; `/* SECRET */` (Story 5.3); Postman export; auto-save on export; `GET /api/export/curl/:requestId`; invent Basic-auth password-portion redaction; copy `followRedirects` into export body; reuse `.http` `serializeRequest` for cURL.

## Copy this, not that

| Concern | Use | Do not use |
|---------|-----|------------|
| Unresolved vars | `execute-request.ts` → 400 `UNRESOLVED_VARIABLE` | `preview.ts` 200 + `unresolved` field |
| Redaction | `redactSecrets` on url + headers + **body.content** | Preview’s url/headers-only pattern |
| Request identity / body | `PreviewRequest` fields (no `followRedirects`) | Planning `requestId` path; `ExecuteRequest` extras |
| Toolbar visibility | Optional `onCopyCurl` omitted when `!(activeRequest && draft)` | `disabled={!selection}` — Import never uses that |
| Secrets mask | `SECRET_MASK` from `@reqor/shared-types` | Hardcoded glyph strings of different length |
| Roundtrip tests | Happy paths without embedded `'` | `parseCurl(serializeCurl(...))` with bash `'\''` (deferred tokenizer gap) |

## API Shape (draft-aware POST)

Planning epics originally listed `GET /api/export/curl/:requestId`. **Authoritative contract for this story (and epic-5-context):** draft-aware export cannot be path-only GET.

- **`POST /api/export/curl`**
- Body: **`ExportCurlRequest`** — same fields as `PreviewRequest`: `collectionId`, `requestIndex`, optional `environment`, optional draft `method` / `url` / `headers` / `body` (omit headers = disk; `body: null` = clear; AppLayout should send `body: draft?.body ?? null` like preview)
- Response: **`ExportCurlResponse`** — `{ curl: string }`
- Errors: standard envelope — `NOT_FOUND` (404), `INVALID_REQUEST` (400), `UNRESOLVED_VARIABLE` (400 with `details: { name, raw }` like execute)

**Terminal equivalence (FR18) vs redaction (NFR6):** Non-secret portions (method, URL, headers, body structure after env substitution) must match what Send would use. Secret-bearing values are replaced with `SECRET_MASK` and are **intentionally non-runnable** until the user substitutes real secrets — do not claim paste-and-auth works for secret-backed requests.

Story 5.3 reuses the route module and **`loadMergedRequestForExport`**: return **redacted request fields** (`method`, `url`, `headers`, `body`) suitable for multiple serializers — not a hard-coded cURL string. 5.3 will apply `/* SECRET */` later; 5.2 applies `SECRET_MASK` then `serializeCurl`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Loaded POST with headers + JSON body, env resolves vars | 200 `{ curl }` with `-X POST`, `-H`, `--json '...'`; secrets as `••••••` | No error |
| DRAFT_OVERRIDE | Unsaved URL/method change in editor | Exported cURL reflects **draft**, not disk baseline | No error |
| ENV_SUBSTITUTION | URL `https://{{host}}/api` with env `host=example.com` | cURL contains `https://example.com/api` | No error |
| SECRET_REDACTION | Header/body contains a value present in `getSecretValuesForRedaction` | Substring replaced with `SECRET_MASK` before serialize | No error |
| UNRESOLVED_VAR | `{{missing}}` with no env value | 400 `UNRESOLVED_VARIABLE` — no clipboard write | Error envelope |
| GET_NO_BODY | GET without body | Omit `-X` and omit `-d`/`--json` | No error |
| POST_WITH_DATA | POST + raw body | `-d '...'` (or `--data-raw` for multiline) | No error |
| JSON_BODY | Body kind `json` | `--json '...'`; omit redundant `Content-Type: application/json` header | No error |
| BASIC_AUTH | `Authorization: Basic <token>` | Emit as `-H 'Authorization: Basic …'`; mask only via substring `redactSecrets` if the secret string is known — **no** decode/re-emit `-u`, **no** special password-portion logic | No error |
| EMPTY_COLLECTION | Valid id, zero requests | 400 `INVALID_REQUEST` “Collection has no requests” | Error envelope |
| BAD_COLLECTION | Unknown `collectionId` / bad index | 404 `NOT_FOUND` | Error envelope |
| PARSE_ERROR_COLLECTION | `parseStatus: error` | 400 `INVALID_REQUEST` | Error envelope |
| NON_HTTP_URL | Resolved URL not http(s) | 400 `INVALID_REQUEST` (same as execute) | Error envelope |
| CLIPBOARD | Export 200 + user clicks Copy cURL | `writeText(curl)`; brief success status | Status error if clipboard denied — no silent success |
| NO_SELECTION | No `activeRequest` or no `draft` | Do **not** pass `onCopyCurl` (button omitted, same as Import) | N/A |

</intent-contract>

## Code Map

### New

- `packages/http-parser/src/serialize-curl.ts` — `serializeCurl(input)` where input matches resolved shape: `{ method: string; url: string; headers: { name: string; value: string }[]; body?: { kind: string; content: string } }` → single command string; shell-safe quoting (emit `'\''` for embedded `'`)
- `packages/http-parser/src/serialize-curl.test.ts` — unit tests; roundtrip `parseCurl(serializeCurl(...))` **only** for happy paths **without** embedded single quotes (tokenizer gap in `deferred-work.md`)
- `packages/http-parser/src/index.ts` — export `serializeCurl` + input type
- `packages/shared-types/src/index.ts` — `ExportCurlRequest` / `ExportCurlResponse` TypeBox + types; schema smoke in `index.test.ts`
- `packages/server/src/load-export-request.ts` — collection → request → `mergeDraftOverrides` → `resolveRequest` → block on unresolved (execute style) → `redactSecrets` on url/headers/body → return `{ method, url, headers, body }` for serializers (5.2 + 5.3)
- `packages/server/src/routes/export.ts` — `POST /api/export/curl` → load helper → `serializeCurl`
- `packages/server/src/export.test.ts` — env substitution, `SECRET_MASK` in curl, unresolved 400, draft override, not-found, empty collection, body secret redaction
- `packages/web/src/hooks/useExportCurl.ts` — TanStack mutation + `ExportCurlError` (mirror `useImportCurl` / `ImportCurlError`)
- `packages/web/src/utils/copyToClipboard.ts` — thin `writeText` wrapper with error mapping (first clipboard use in web)

### Update

- `packages/server/src/app.ts` — register `exportRoutes` with `{ collectionStore, configStore, environmentStore, envResolver }` (**preview-like deps**, not bare `importRoutes`)
- `packages/web/src/components/RequestLine.tsx` — optional `onCopyCurl?`; render button only if set; `aria-label="Copy cURL"`; `disabled` while mutation pending; brief success/error status text
- `packages/web/src/components/RequestEditor.tsx` / `WorkspaceShell.tsx` — pass-through props (same chain as Import)
- `packages/web/src/components/AppLayout.tsx` — `onCopyCurl={activeRequest && draft ? handleCopyCurl : undefined}`; build body like preview (`collectionId`, `requestIndex`, `environment: activeEnvironment`, draft fields; **omit** `followRedirects`); on success call `copyToClipboard`; on error show status (no clipboard write)

## Tasks & Acceptance

**Execution:**
- [ ] `packages/http-parser/src/serialize-curl.ts` — `-X` (omit for GET), `-H`, `-d`/`--data-raw`, `--json`
- [ ] `packages/http-parser/src/serialize-curl.test.ts` — POST+JSON, GET, headers, Basic header form, shell escaping emit, roundtrip without embedded `'`
- [ ] `packages/http-parser/src/index.ts` — export public API
- [ ] `packages/shared-types/src/index.ts` — schemas + `index.test.ts` smoke
- [ ] `packages/server/src/load-export-request.ts` — merge + resolve + execute-style unresolved block + redact url/headers/body → redacted fields
- [ ] `packages/server/src/routes/export.ts` — POST handler
- [ ] `packages/server/src/app.ts` — register with preview-like deps
- [ ] `packages/server/src/export.test.ts` — env, secret mask (import `SECRET_MASK`), unresolved 400, draft, not-found, empty collection, body redaction
- [ ] `packages/web/src/hooks/useExportCurl.ts` — mutation hook
- [ ] `packages/web/src/utils/copyToClipboard.ts` — clipboard helper
- [ ] `packages/web/src/components/RequestLine.tsx` — Copy cURL; optional callback; pending disable; status
- [ ] `packages/web/src/components/RequestEditor.tsx` / `WorkspaceShell.tsx` — wire props
- [ ] `packages/web/src/components/AppLayout.tsx` — preview-shaped payload; hide when no selection; copy on success only
- [ ] `pnpm turbo build test typecheck` — workspace passes

**Acceptance Criteria:**
- Given a loaded request with active environment, when I click **Copy cURL**, then the clipboard receives a cURL command with variables substituted and known secrets as `••••••`
- Given unsaved draft edits, when I copy cURL, then the command reflects draft values (not disk-only baseline)
- Given an unresolved variable, when I copy cURL, then the UI shows an error and no clipboard write occurs
- Given export succeeds, when I inspect the toolbar, then Copy cURL has `aria-label="Copy cURL"` and the payload never contains plaintext secrets
- Given a secret-backed auth header, when I paste the exported command, then structure/vars match Send but the secret field remains masked (intentionally non-runnable until substituted)

### Anti-patterns (do not ship)

- Do not implement `GET /api/export/curl/:requestId`
- Do not serialize cURL in `packages/web` (AD-3)
- Do not use `/* SECRET */` in cURL export
- Do not skip `mergeDraftOverrides`
- Do not redact only like preview (missing body) — always redact body content
- Do not return 200 with `unresolved` like preview — block like execute
- Do not invent Basic-auth password-portion redaction beyond `redactSecrets`
- Do not pass `followRedirects` on export
- Do not use `serializeRequest` (`.http`) for cURL
- Do not disable Copy cURL for “no selection” — omit the callback instead
- Do not add snippet popover/tabs (Story 5.3)
- Do not regress Import cURL, preview, execute, save, or history
- Do not invent a new env resolution path — reuse `resolveRequest` + `resolveEnvironmentName`

## Previous Story Intelligence (5.1)

- cURL parse/serialize lives in `@reqor/http-parser`; server owns routes (AD-3)
- `parseCurl` flags: `-X`, `-H`, `-d`, `--data-raw`, `--json`, `-u` — serialize should emit flags import can roundtrip on happy paths
- Import is modal (`CurlImportDialog`); export is **one-click copy**, no modal (FR18)
- `deferred-work.md`: single-quote tokenizer ≠ bash — do not block export on import tokenizer fixes; exclude embedded-`'` roundtrips
- Mirror `useImportCurl` + `ImportCurlError`; toolbar path `AppLayout` → `WorkspaceShell` → `RequestEditor` → `RequestLine`
- Import visibility: `onImportCurl={activeRequest && draft ? … : undefined}` — Copy cURL must match

## Architecture Compliance

| Rule | Application |
|------|-------------|
| AD-3 | Parser owns cURL serialization; web never generates cURL |
| AD-8 / FR9 / FR14 / FR15 | Single-pass `resolveRequest` + active env + dotenv secrets |
| AD-10 | TanStack mutation; TypeBox DTOs; Fastify schema |
| AD-21 | `collectionId` + `requestIndex`; no `:requestId` export path |
| NFR6 | `redactSecrets` + `SECRET_MASK` on url, headers, body before serialize |
| FR18 | Toolbar copy; vars substituted; secrets masked (non-secret portions terminal-equivalent) |
| UX-DR22 | `aria-label="Copy cURL"` |

## serializeCurl Design Notes

- Prefer import fixture style: `curl -X POST 'url' -H '...' --json '...'`
- **GET:** omit `-X`; **other methods:** `-X METHOD`
- **Headers:** one `-H 'Name: Value'` each; skip `Content-Type: application/json` when emitting `--json`
- **Body `json`:** `--json 'content'`; **`raw`/`form`:** `-d 'content'` (form as raw content for MVP)
- **Quoting:** single-quote wrap; escape embedded `'` as `'\''` on emit (roundtrip tests skip embedded `'`)
- **Basic auth:** keep `-H 'Authorization: Basic …'` after redaction; do not re-emit `-u`

## Verification

**Commands:**
- `pnpm turbo build test typecheck` — all packages green

**Manual checks:**
- `demo.http` + active env: Copy cURL → `{{host}}` substituted (structure check). For **secret** masking, use a request with `{{$dotenv …}}` / private-env secret — `demo.http`’s literal `Bearer sample-token` will **not** mask
- Edit URL in draft without Save → Copy cURL uses edited URL
- Request with `{{unresolved}}` → error status, clipboard unchanged

## References

- [Source: `_bmad-output/implementation-artifacts/epic-5-context.md`]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.2 / FR18]
- [Source: `packages/server/src/proxy/execute-request.ts` — unresolved + empty collection + non-http URL]
- [Source: `packages/server/src/routes/preview.ts` — merge + deps injection (not unresolved handling)]
- [Source: `packages/server/src/merge-draft-overrides.ts`]
- [Source: `packages/server/src/resolve-request.ts`]
- [Source: `packages/server/src/redact-secrets.ts`]
- [Source: `packages/server/src/resolve-environment-name.ts`]
- [Source: `packages/http-parser/src/parse-curl.ts`]
- [Source: `packages/web/src/hooks/useImportCurl.ts`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — parse-curl quote gaps]
- [Source: `_bmad-output/implementation-artifacts/1-7-http-proxy-execution-and-response-panel.md` — AD-21]

## Dev Agent Record

### Agent Model Used

(pending dev-story)

### Debug Log References

### Completion Notes List

### File List
