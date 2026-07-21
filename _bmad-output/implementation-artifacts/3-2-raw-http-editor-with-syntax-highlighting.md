---
baseline_commit: 32a06a8
---

# Story 3.2: Raw `.http` Editor with Syntax Highlighting

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [ ] **Raw `.http` sub-tab** added to request workspace (UX-DR11, DESIGN.md) alongside Params | Headers | Body
- [ ] Raw editor shows **full collection file text** (`CollectionDetailDto.content`) with JetBrains-oriented syntax highlighting (FR12)
- [ ] Visual and raw modes share **one draft** including `content` string — tab switches do not discard unsaved edits (AD-18, UX-DR11)
- [ ] **Mode switch** (visual ↔ raw) POSTs current draft to server for re-parse/sync **before** updating the target mode’s display (AD-18)
- [ ] Sync uses slash-safe route `POST /api/collections/*/sync` (collection ids are path strings); `serializeRequest` exported from `@reqor/http-parser` for server patch
- [ ] After successful sync: draft/baseline updated in place; TanStack Query `['collection', id]` cache updated via `setQueryData`; **no** `selectionIdentity` change that would reset the draft
- [ ] **Web never serializes `.http` text** — no `@reqor/http-parser` in `@reqor/web`; server alone parses/patches/serializes request blocks (AD-3, AD-18, AD-22)
- [ ] Raw syntax/parse errors display **inline with line number** via `role="alert"` — UI does not crash (FR12, UX-DR17)
- [ ] Visual draft overrides for Send/preview from Story 3.1 **non-regressed**; after successful sync, structured fields and `content` stay coherent
- [ ] Save remains **stub** (no disk write, no `PUT`) — Story 3.3
- [ ] `pnpm turbo build test typecheck` passes workspace-wide

### Anti-patterns (do not ship)

- Do not write to disk or implement `PUT /api/collections/:id` — Story 3.3
- Do not use Fastify `:id` for collection routes — ids contain slashes (`http/users.http`); match existing `*` wildcard pattern
- Do not import `@reqor/http-parser` or call `serializeHttpFile` from `@reqor/web` (AD-3, AD-18, AD-22)
- Do not client-side generate `.http` syntax when switching visual → raw (AD-18) — server patch only
- Do not call full-file `serializeHttpFile()` for visual→raw patch when span-based splice is available — preserves comments/formatting outside the edited request
- Do not change `selectionIdentity` (or rematch selection) solely because sync returned a new fingerprint — that resets `useRequestDraft` and wipes edits
- Do not leave TanStack Query collection detail stale after sync — rematch/UI would read old `detail.requests`
- Do not break Story 3.1 draft dirty/Save UX, validation matrix, or selection-only reset behavior
- Do not break Story 2.5 Send gating, preview debounce (`PREVIEW_DEBOUNCE_MS = 300`), `lastPreviewRef`, or `body: null` clear semantics
- Do not block Send solely because raw text has parse errors if structured draft + preview path still valid — parse errors are editor UX; Send uses structured overrides (same as 3.1)
- Do not add navigate-away confirm — Story 3.3 (UX-DR26)
- Do not wire Ctrl/⌘+S to save — Story 3.3

## Story

As a **developer who maintains `.http` files in Git**,
I want a raw text editor with JetBrains syntax highlighting,
So that I can edit requests exactly as they appear on disk.

## Acceptance Criteria

1. **Given** a request is loaded in the workspace  
   **When** I switch to the **Raw `.http`** sub-tab (UX-DR11, DESIGN.md)  
   **Then** I see the **full `.http` file content** for the selected collection with syntax highlighting (FR12)  
   **And** the editor uses mono typography (`text-mono`, 13px) on a surface background

2. **And** visual (Params/Headers/Body) and raw modes share **one draft** with bidirectional sync (AD-18)  
   **And** `RequestDraft` includes `content: string` initialized from `CollectionDetailDto.content`  
   **And** dirty detection compares structured fields **and** `content` against baseline

3. **When** I switch **from visual to raw** (Params/Headers/Body → Raw)  
   **Then** the client POSTs the current draft to `POST /api/collections/*/sync` **before** showing raw text (AD-18)  
   **And** the server applies structured field changes to the active `requestIndex` block and returns updated `content` + re-parsed DTOs  
   **And** the raw editor displays the server-returned `content`

4. **When** I switch **from raw to visual** (Raw → Params/Headers/Body)  
   **Then** the client POSTs current `draft.content` to the server for re-parse **before** updating visual panels (AD-18)  
   **And** on success, structured fields for the active request update from server DTOs (rematch policy below)  
   **And** on parse failure, inline diagnostics appear with **line number**; UI remains usable and raw edits are retained in draft

5. **When** I edit raw text with a syntax error while on the Raw tab  
   **Then** parse errors display inline with line number without crashing the UI (FR12)  
   **And** debounced server re-parse uses **exactly 300ms** (`PREVIEW_DEBOUNCE_MS` in `usePreviewRequest.ts`) for diagnostics  
   **And** diagnostics use `DiagnosticDto` shape and `role="alert"` styling consistent with draft validation

6. **And** switching among Params, Headers, Body, and Raw **does not discard** unsaved draft edits (UX-DR11)  
   **And** selection change still resets draft from loaded collection + request (Story 3.1 behavior)  
   **And** successful sync updates draft/baseline **in place** without treating the response as a selection change

7. **And** Save button behavior unchanged from Story 3.1 — hidden when clean, enabled when dirty+valid, **stub handler** (Story 3.3 persists)  
   **And** parse errors on raw tab may disable Save (`canSave`) when `parseStatus === 'error'` — product-consistent with “invalid draft”

8. **And** Send, preview, and Ctrl/⌘+Enter continue using structured draft overrides (method, url, headers, body) from Story 3.1 — not stale disk-only values

## Tasks / Subtasks

- [x] Task 1: Extend draft model for `content` (AC: #2, #6)
  - [x] 1.1 Extend `RequestDraft` in `packages/web/src/utils/requestDraft.ts`:
    - Add `content: string`
    - Extend existing `draftFromRequest(activeRequest, content)` — structured fields from request + full file text (do **not** invent a parallel helper name)
    - Extend `draftEquals` to compare `content`
    - Extend `validateRequestDraft` — optional: when `parseErrors.length > 0`, return invalid with first diagnostic message (or separate `canSave` gate in hook)
  - [x] 1.2 Update `useRequestDraft` — accept `collectionContent: string | undefined`; init/reset baseline+draft with content; add `setContent(text: string)`; add `applySyncResult(...)` (or equivalent) that updates draft **and** baseline fields from sync without requiring a new `selectionIdentity`; preserve selection-only reset (not refetch)
  - [x] 1.3 Update `AppLayout.tsx` — pass `detail?.content` into `useRequestDraft`; thread `requestIndex` for sync calls
  - [x] 1.4 Unit tests: content in dirty detection; reset includes content; selection reset clears raw edits; `applySyncResult` does not wipe dirty state incorrectly when only normalizing content

- [x] Task 2: Export parser serialize helper + server sync endpoint (AC: #3, #4, #5) — AD-18, AD-22
  - [x] 2.0 Export `serializeRequest` from `packages/http-parser/src/index.ts` (today only `serializeHttpFile` is public; internal helper already exists in `serialize.ts`)
  - [x] 2.1 Add shared-types schemas in `packages/shared-types/src/index.ts`:
    - `SyncCollectionRequest` — `content: string`; optional `requestIndex` + structured patch (`method`, `url`, `headers`, `body?: RequestBodyDto | null`) for visual→raw
    - `SyncCollectionResponse` — `content`, `parseStatus`, `requests[]`, `diagnostics[]` (reuse DTO shapes from `CollectionDetailDto` fields)
  - [x] 2.2 Add `packages/server/src/sync-collection.ts`:
    - `applyVisualPatch(content, requestIndex, patch)` — parse → locate request span → serialize **single** request block via `serializeRequest` → **line-splice** into original `content` using `ParsedRequest.span` (1-based lines) → return patched string
    - `syncCollection(content, patch?)` — apply patch if present → `parseHttpFile` → return `{ content, parseResult }`
    - Do **not** use full-file `serializeHttpFile` for patch path when file has multiple requests/comments
    - Spans are MVP-usable but known imperfect (`deferred-work.md` / Story 1.2); line-splice is still required vs rewriting the whole file
  - [x] 2.3 Add route `POST /api/collections/*/sync` in `packages/server/src/routes/collections.ts`:
    - Extract id the same way as `GET /api/collections/*` (wildcard path)
    - Register so it does not collide with `GET /api/collections/*` or `POST /api/collections/refresh`
    - Missing `requestIndex` on patch path → `400` with `{ error: { code: 'INVALID_REQUEST_INDEX', message } }` (AD error envelope)
  - [x] 2.4 Server tests: visual patch updates one request block; raw reparse returns diagnostics on bad syntax; multi-request file preserves other blocks; `body: null` patch clears body; nested collection id path works

- [x] Task 3: Web sync hook + tab-switch orchestration (AC: #3, #4, #5, #6)
  - [x] 3.1 Add `packages/web/src/hooks/useSyncCollection.ts` — mutation `POST /api/collections/${encodeURIComponent(id)}/sync` (or same encoding pattern as detail GET); typed request/response
  - [x] 3.2 On sync success:
    - Apply response into draft/baseline via `applySyncResult` (structured fields + `content`)
    - `queryClient.setQueryData(['collection', id], …)` so `detail.requests` / `detail.content` match sync (preserve existing detail shape)
    - **Do not** update `selectedRequest.fingerprint` / `selectionIdentity` just because method/url changed — keep current selection index stable; update structured draft fields from the response request at that index
  - [x] 3.3 Rematch policy (AD-21, safe for draft):
    - **Visual → raw:** prefer `requestIndex` (patch targeted that block)
    - **Raw → visual:** prefer `requestIndex` if still in range; if that index is gone or method+url no longer match, rematch by `fingerprint` of the pre-sync active request; if neither matches, keep raw text + show diagnostic — **never** change `selectionIdentity` mid-sync in a way that triggers draft reset
  - [x] 3.4 Add `packages/web/src/utils/syncOnTabSwitch.ts` (or logic in `RequestEditor`) — payload:
    - **To Raw:** `{ content, requestIndex, patch }` from structured draft
    - **To visual / debounced diagnostics:** `{ content }` only
  - [x] 3.5 Update `RequestEditor.tsx`:
    - Extend `RequestSubTab` with `'raw'`
    - On tab change: await sync when crossing raw ↔ visual boundary; surface `diagnostics` as parse errors
    - Debounced raw re-parse: **300ms** exactly (reuse `PREVIEW_DEBOUNCE_MS` constant or duplicate `300` with a comment pointing at preview)
  - [x] 3.6 Hook/component tests: tab switch calls sync; parse error displayed; edits preserved on failed parse; sync success does not reset draft via identity change; query cache updated

- [x] Task 4: Raw editor UI + syntax highlighting (AC: #1, #5)
  - [x] 4.1 Add `packages/web/src/components/RequestRawPanel.tsx`:
    - Controlled `content` + `onContentChange`
    - Syntax highlighting for JetBrains `.http` (method line, headers, `###` separators, `#` comments, body)
    - **Recommended:** CodeMirror 6 — pin in `pnpm-workspace.yaml` catalog: `@codemirror/view` (~6.43.x), `@codemirror/state`, `@codemirror/language`, optional `@uiw/react-codemirror` — architecture allows Monaco/CodeMirror; CM6 preferred (lighter)
    - **Fallback:** editable `<textarea className="text-mono">` plus highlighted overlay only if CM bundle rejected — must still satisfy FR12 highlighting while editing
  - [x] 4.2 Add `packages/web/src/utils/highlightHttp.ts` if using custom tokenizer (mirror `formatResponseBody.ts` token pattern)
  - [x] 4.3 Parse error strip below editor: `Line {n}: {message}` with `role="alert"`
  - [x] 4.4 Update `RequestSubTabs.tsx` — add `{ id: 'raw', label: 'Raw .http' }`; update `RequestSubTabs.test.tsx` (remove “Raw absent” assertion)
  - [x] 4.5 Component tests: renders content; onChange updates draft; highlights visible; parse error alert

- [x] Task 5: Integration + regression (AC: #6–#8)
  - [x] 5.1 Update `WorkspaceShell.tsx` / `AppLayout.tsx` props for `setContent`, parse diagnostics, sync pending state (optional muted “Syncing…” on tab switch)
  - [x] 5.2 `App.test.tsx` — switch to Raw shows file content; edit raw → switch to Headers updates structured fields when valid; parse error shows line; Story 3.1 Send/validation tests pass; nested collection id sync mocked
  - [x] 5.3 Run `pnpm turbo build test typecheck`

## Dev Notes

### Draft model (extended — authoritative)

```typescript
type RequestDraft = {
  content: string           // full .http file text (collection scope)
  method: string
  url: string
  headers: RequestHeaderDto[]
  body?: RequestBodyDto
}
```

| Event | Behavior |
|-------|----------|
| Collection detail loaded + request selected | `draft = draftFromRequest(activeRequest, detail.content)`; baseline = same |
| User edits visual fields | Update structured fields immutably; dirty if differs from baseline |
| User edits raw `content` | `setContent(text)`; dirty if content differs from baseline |
| Switch visual → Raw | POST sync with visual patch → `applySyncResult` (content + structured); `setQueryData` |
| Switch Raw → visual | POST sync with `content` → on success `applySyncResult`; on error show diagnostics, keep raw text |
| Selection changes | Discard draft; re-init from new collection content + request (no confirm — Story 3.3) |
| Save clicked | No-op stub — Story 3.3 |

**Initialization source:** `useCollectionDetail` already returns `content` — Story 1.3 stored it for 3.2. Wire `detail.content` into draft init; do not fetch separately.

**Critical — `selectionIdentity` trap:** AppLayout builds  
`` `${collectionId}:${requestIndex}:${fingerprint}` ``  
and `useRequestDraft` **resets** when that string changes. Visual edits that change method/URL change fingerprint. After sync, apply the response into draft/baseline and query cache; **do not** push a new selection object that only differs by fingerprint, or the draft (including dirty raw edits) will be wiped.

### Server sync contract (new — required for AD-18)

**Endpoint:** `POST /api/collections/*/sync`  
(Same slash-safe wildcard pattern as `GET /api/collections/*`. Collection id = repo-relative path, e.g. `http/users.http`.)

**Request body (`SyncCollectionRequest`):**

```typescript
{
  content: string
  requestIndex?: number
  patch?: {
    method: string
    url: string
    headers: RequestHeaderDto[]
    body?: RequestBodyDto | null  // null = clear body
  }
}
```

| Caller intent | Payload |
|---------------|---------|
| Raw → visual (re-parse) | `{ content }` only |
| Visual → raw (apply edits) | `{ content, requestIndex, patch }` |
| Debounced raw validation | `{ content }` only |

**Response (`SyncCollectionResponse`):**

```typescript
{
  content: string
  parseStatus: 'ok' | 'error'
  requests: RequestDto[]
  diagnostics: DiagnosticDto[]
}
```

**Error envelope (AD):** `{ error: { code: string, message: string, details?: unknown } }`  
Example: missing/out-of-range `requestIndex` on patch → `400` / `INVALID_REQUEST_INDEX`.

**Visual patch algorithm (server — required):**

1. `parseHttpFile(content)` — if fatal/empty requests, return diagnostics without throwing
2. Find `requests[requestIndex]` — if missing, return 400 `INVALID_REQUEST_INDEX`
3. Build updated `ParsedRequest` from patch (method, url, headers, body/null)
4. `serializedBlock = serializeRequest(updatedRequest)` from `@reqor/http-parser` (**export required** — not public today)
5. Splice into original `content` by **line range** `[span.startLine, span.endLine]` (1-based, inclusive) — preserve text outside span
6. Re-parse patched content; map through existing `toCollectionDetail` / `toRequestDto` in `packages/server/src/to-dto.ts`
7. Return updated `content` + DTOs + diagnostics

**Do not** call full-file `serializeHttpFile()` for patch path — it drops inter-request comments and reformats unrelated blocks. Spans are imperfect (serializer historically lacked original line tracking; Story 3.3 improves tracking) but line-splice remains the 3.2 minimum.

### Tab switch UX

| From | To | Action |
|------|-----|--------|
| Params/Headers/Body | Raw | Sync with patch |
| Raw | Params/Headers/Body | Sync re-parse only |
| Params ↔ Headers ↔ Body | — | No sync (structured-only) |
| Raw | Raw | Local edit only + **300ms** debounced re-parse for diagnostics |

Copy a11y pattern from existing `RequestSubTabs` / `ResponsePanel`: `role="tablist"`, `aria-controls`, `tabpanel` + `hidden`.

**Sub-tab label:** `Raw .http` per DESIGN.md.

### Rematch after sync (AD-21, draft-safe)

| Direction | Prefer | Fallback |
|-----------|--------|----------|
| Visual → raw | `requestIndex` (patch target) | N/A |
| Raw → visual | Same `requestIndex` if still valid | Pre-sync `fingerprint`; else keep raw + diagnostic |

Never rematch by inventing a new `selectionIdentity` mid-edit. Update draft fields from the matched `RequestDto`; refresh query cache so sidebar/detail stay coherent.

### Syntax highlighting (FR12)

| Approach | Notes |
|----------|-------|
| **CodeMirror 6 (recommended)** | Pin catalog: `@codemirror/view` ~6.43.x (+ state/language); optional `@uiw/react-codemirror`. No CM/Monaco in catalog yet. |
| Custom tokenizer | Follow `ResponsePanel.tsx` / `formatResponseBody.ts` if avoiding new deps — harder for caret sync |

Highlight targets (minimum):

- HTTP method token on request line
- URL / template placeholders `{{...}}`
- Header names vs values
- `###` request separators
- `#` line comments
- Body content (neutral mono)

Use design tokens: `text-mono`, `text-primary`, `text-success`, `text-foreground-muted` — align with response body highlighting.

### Parse errors vs validation errors

| Source | Display location | Blocks Save |
|--------|------------------|-------------|
| `validateRequestDraft` (GET+body etc.) | Request line area (Story 3.1) | Yes |
| `SyncCollectionResponse.diagnostics` (parse) | Raw panel alert strip | Yes when `parseStatus === 'error'` |
| Story 2.5 unresolved variables | Request line / preview | Blocks Send only |

Show first parse diagnostic in alert; optional list if multiple. Include `Line {line}:` prefix per UX empty-state patterns for sidebar parse errors.

### Epic context

Epic 3 (UJ-2): Priya edits `.http` in Git-friendly workflow.

| Story | Scope |
|-------|-------|
| 3.1 ✅ | Visual editor + draft + preview/execute overrides |
| **3.2** | Raw tab + highlighting + AD-18 bidirectional sync via server |
| 3.3 | Disk save, minimal-diff, Ctrl/⌘+S, navigate-away confirm |

**FR11 consequence:** “Changes in visual editor update the raw `.http` representation” — satisfied by visual→raw sync on tab switch (raw display shows server-returned `content`).

### Architecture compliance (MUST follow)

| AD / FR / UX | Requirement for 3.2 |
|--------------|---------------------|
| AD-3 | Web never parses `.http` — server sync only |
| AD-4 | Draft in memory until Save (3.3) |
| AD-8 | Preview/execute still use `mergeDraftOverrides` — unchanged |
| AD-10 | TypeBox schemas for sync request/response |
| AD-18 | Mode switch server re-parse; web never serializes `.http` |
| AD-21 | Rematch by index first, fingerprint if index invalid — **without** resetting draft via `selectionIdentity` |
| AD-22 | Web imports DTOs only; export `serializeRequest` for **server** use |
| FR11 | Raw representation reflects visual edits after sync |
| FR12 | Raw editor + highlighting + inline parse errors |
| UX-DR11 | Sub-tabs include Raw; edits preserved across tabs |
| UX-DR17 | Inline parse/validation copy — not toast |

### Scope boundaries

**In scope:** Raw tab UI; syntax highlighting; `content` in draft; sync API; tab-switch + 300ms debounced re-parse; parse error UX; export `serializeRequest`; query cache update; tests.

**Out of scope:**
- Disk persistence (`PUT`), minimal-diff save, atomic write — Story 3.3 (FR13, AD-5)
- Ctrl/⌘+S save, “Saved to {path}”, navigate-away confirm — Story 3.3
- Create-new `.http` file — post-MVP
- Client-side `.http` serialization or `@reqor/http-parser` in web
- History replay into editor — Epic 4

### Current code state (touch points)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/web/src/utils/requestDraft.ts` | `draftFromRequest` — structured only | **UPDATE** — add `content`, extend equals/validation |
| `packages/web/src/hooks/useRequestDraft.ts` | Init from `RequestDto` only; resets on `selectionIdentity` | **UPDATE** — accept `content`; `applySyncResult` without identity change |
| `packages/web/src/components/RequestSubTabs.tsx` | params/headers/body only | **UPDATE** — add Raw tab |
| `packages/web/src/components/RequestEditor.tsx` | No raw panel | **UPDATE** — raw tabpanel + sync on switch |
| `packages/web/src/components/AppLayout.tsx` | Ignores `detail.content` | **UPDATE** — pass content; wire sync + `setQueryData` |
| `packages/server/src/routes/collections.ts` | `GET *`, `POST refresh` | **UPDATE** — `POST /api/collections/*/sync` |
| `packages/server/src/to-dto.ts` | `toRequestDto` / `toCollectionDetail` | **READ** — reuse after sync parse |
| `packages/shared-types/src/index.ts` | No sync types | **UPDATE** — SyncCollectionRequest/Response |
| `packages/http-parser/src/serialize.ts` | `serializeRequest` exists, **not exported** | **UPDATE** — export from `index.ts` |
| `packages/http-parser/src/index.ts` | Exports `serializeHttpFile` only | **UPDATE** — also export `serializeRequest` |
| `packages/web/src/components/ResponsePanel.tsx` | Custom highlighters | **READ** — token color pattern |
| `packages/web/src/hooks/usePreviewRequest.ts` | `PREVIEW_DEBOUNCE_MS = 300` | **READ** — exact debounce for raw re-parse |
| `pnpm-workspace.yaml` | No CodeMirror/Monaco | **UPDATE** if CM6 chosen — catalog pins |

### Previous story intelligence (3.1 — visual editor)

- `useRequestDraft` resets on **`selectionIdentity` only** — not TanStack Query refetch; preserve this when adding `content`; sync must not fake a selection change
- Save hidden when clean; stub until 3.3
- Preview/execute always send draft headers + `body: null` when cleared
- `RequestSubTabs.test.tsx` explicitly asserts Raw tab **absent** — update in 3.2
- Review patches to preserve: URL `#fragment`, empty param key validation, sub-tab reset on selection, bodyless empty-body dirty normalization
- Raw tab was **deliberately omitted** in 3.1 — do not refactor visual panels unnecessarily

### Previous story intelligence (1.3 — collection detail)

- `CollectionDetailDto.content` is full file text from disk scan — already in API response
- `diagnostics[]` on collection uses same shape as parse errors for sidebar badges
- Detail GET already uses slash-safe `*` route — sync must match

### Git intelligence (recent)

- Baseline: `32a06a8` — 3.1 review harden (draft, URL fragments, tests)
- Prior: `0bdd023` — visual request editor + draft overrides
- No 3.2 implementation commits yet

### Tab UI pattern

Extend existing `RequestSubTabs` — do not create parallel tab bar. Raw tabpanel id: `request-panel-raw`, tab id: `request-tab-raw`.

### Testing standards

- **Unit:** `requestDraft.test.ts` — content in equals/dirty; `applySyncResult` identity-safe; `highlightHttp.test.ts` if custom
- **Parser:** export smoke — `serializeRequest` importable from package entry
- **Server:** `sync-collection.test.ts` — patch splice, parse errors, multi-request preservation, nested id route
- **Hook:** `useSyncCollection.test.tsx` — mutation URL/body; cache update
- **Components:** `RequestRawPanel.test.tsx`, updated `RequestSubTabs.test.tsx`, `RequestEditor.test.tsx` tab-switch sync
- **Integration:** `App.test.tsx` — raw ↔ visual round-trip; parse error inline; 3.1 regression
- **Gate:** `pnpm turbo build test typecheck`

### Latest technical information

- **React 19 + TanStack Query v5** — sync is a mutation; on success also `setQueryData` for collection detail
- **Vitest 3 + RTL** — mock `fetch` for `/api/collections/*/sync` in App tests
- **Fastify 5 + TypeBox** — new schemas in `@reqor/shared-types`; wildcard routes like detail GET
- **CodeMirror 6** — `@codemirror/view` ~6.43.x if added; pin in workspace catalog; verify Vite bundle size for local tool
- **Node `>=24 <25`**

### Project context reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.2, FR11/FR12, AD-18]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-3, AD-18, AD-21, AD-22, error envelope]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — §4.3 Editor sync model]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/DESIGN.md` — Raw sub-tab, mono editor]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — UJ-2 Raw tab flow]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/prd.md` — §4.6 FR-11/FR-12]
- [Source: `_bmad-output/implementation-artifacts/3-1-visual-request-editor.md` — draft model, anti-patterns, review patches]
- [Source: `packages/shared-types/src/index.ts` — CollectionDetailDto.content, DiagnosticDto]
- [Source: `packages/http-parser/src/serialize.ts` — serializeRequest (export needed)]
- [Source: `packages/server/src/routes/collections.ts` — `GET /api/collections/*` pattern]
- [Source: `packages/web/src/hooks/useRequestDraft.ts` — selectionIdentity reset]
- [Source: `packages/web/src/hooks/usePreviewRequest.ts` — PREVIEW_DEBOUNCE_MS = 300]
- [Source: `packages/web/src/components/RequestEditor.tsx`, `RequestSubTabs.tsx`, `AppLayout.tsx`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

### Completion Notes List

- Implemented Raw .http sub-tab with textarea + highlight overlay (custom tokenizer; no CodeMirror dep)
- Added POST /api/collections/*/sync with span-based visual patch via exported serializeRequest
- Draft model includes content; draft reset key is collectionId:requestIndex to avoid fingerprint wipe
- Sync updates TanStack cache; preserves prior requests on parse-error empty lists
- Debounced 300ms raw re-parse + blur diagnostics; tab-switch sync before display update
- pnpm turbo build test typecheck green workspace-wide

### File List

- packages/http-parser/src/index.ts
- packages/http-parser/src/serialize.ts
- packages/shared-types/src/index.ts
- packages/server/src/sync-collection.ts
- packages/server/src/sync-collection.test.ts
- packages/server/src/routes/collections.ts
- packages/server/src/collections.test.ts
- packages/web/src/utils/requestDraft.ts
- packages/web/src/utils/requestDraft.test.ts
- packages/web/src/utils/syncOnTabSwitch.ts
- packages/web/src/utils/highlightHttp.ts
- packages/web/src/utils/highlightHttp.test.ts
- packages/web/src/hooks/useRequestDraft.ts
- packages/web/src/hooks/useRequestDraft.test.tsx
- packages/web/src/hooks/usePreviewRequest.ts
- packages/web/src/hooks/useSyncCollection.ts
- packages/web/src/hooks/useSyncCollection.test.tsx
- packages/web/src/components/RequestSubTabs.tsx
- packages/web/src/components/RequestSubTabs.test.tsx
- packages/web/src/components/RequestRawPanel.tsx
- packages/web/src/components/RequestRawPanel.test.tsx
- packages/web/src/components/RequestEditor.tsx
- packages/web/src/components/RequestEditor.test.tsx
- packages/web/src/components/WorkspaceShell.tsx
- packages/web/src/components/WorkspaceShell.test.tsx
- packages/web/src/components/AppLayout.tsx
- packages/web/src/App.test.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/3-2-raw-http-editor-with-syntax-highlighting.md

## Change Log

- 2026-07-21: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-21: Story context hardened — slash-safe sync route, export serializeRequest, selectionIdentity/draft-reset guard, query cache update, rematch policy, 300ms debounce, CodeMirror catalog pins, AD error envelope
- 2026-07-21: Implemented raw editor, server sync API, bidirectional tab sync, highlighting, and tests — status review
