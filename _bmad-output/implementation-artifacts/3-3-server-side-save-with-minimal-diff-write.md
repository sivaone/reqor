---
baseline_commit: 5d875a8
---

# Story 3.3: Server-Side Save with Minimal-Diff Write

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [x] **`PUT /api/collections/*`** persists full-file `content` to disk with server-side minimal-diff (FR13, AD-5, AD-18)
- [x] **Pre-save content resolution:** visual-only edits do not update `draft.content` until sync — Save must run visual→raw sync first when structured fields are dirty vs content, then PUT the synced `content` (AD-18)
- [x] Disk write uses **temp file + rename** for atomicity (AD-4); pattern matches `ConfigStore.save`
- [x] Save accepts **full file `content` only** from web — server alone parses and minimal-diff serializes; **no** `@reqor/http-parser` in `@reqor/web`
- [x] **Minimal-diff** patches changed request block(s) into **on-disk file text** via span line-splice; comments/blank lines outside edited blocks preserved
- [x] **Full-file rewrite fallback** when minimal-diff patch fails — response includes `warning.code === 'FULL_REWRITE'`; amber inline copy per UX-DR17
- [x] **Parse error on save** → `400 PARSE_ERROR` with line; draft retained; inline error (UX-DR17)
- [x] **Disk write failure** (read-only / EACCES) → `500 WRITE_FAILED`; banner `"Cannot write to {path}. File may be read-only."`; draft retained (UX-DR17, UX-DR24)
- [x] **Save success** → apply server `content` + matched request into draft, then `commitBaseline()`; inline `"Saved to {path}"`; dirty clears (UX-DR17, UX-DR24)
- [x] **Save button** hidden when clean, enabled when `canSave`; disabled while sync or save mutation is pending
- [x] **Ctrl/⌘+S** invokes save when `canSave`; still `preventDefault()` (UX-DR21)
- [x] **Navigate-away confirm** when draft dirty and user selects different request or clears selection (UX-DR26); Esc closes dialog (UX-DR21)
- [x] After save: TanStack Query `['collection', id]` cache updated; `CollectionStore` refreshed; selection stable (no draft wipe via identity trap)
- [x] Write path: collection id must exist in store; resolved path must stay under `repositoryRoot` (`path.resolve` containment)
- [x] Shared span-splice helper extracted for sync + save (no duplicated private `splitLines`/`joinLines`)
- [x] Story 3.1 Send/preview/validation and Story 3.2 raw/sync/tab-switch behavior **non-regressed**
- [x] `pnpm turbo build test typecheck` passes workspace-wide

### Anti-patterns (do not ship)

- Do not import `@reqor/http-parser` or serialize `.http` text in `@reqor/web` (AD-3, AD-18, AD-22)
- Do not use Fastify `:id` for collection routes — ids contain slashes; use existing `*` wildcard pattern
- Do not write client draft directly to disk without server parse + minimal-diff path (AD-5)
- Do not PUT stale `draft.content` after visual-only edits — structured fields alone are not on disk until visual→raw sync produces updated `content` (AD-18)
- Do not client-side synthesize `.http` text to “fix” content before save — use existing `POST .../sync` + `buildSyncPayload('to-raw', …)` only
- Do not copy-paste private `splitLines`/`joinLines` from `sync-collection.ts` — extract a shared `spliceRequestSpan` (or export helpers) used by sync and save
- Do not call `applyVisualPatch` as the full save algorithm — it patches one structured request; save compares full files then splices changed spans into **disk** text
- Do not use full-file `serializeHttpFile()` as the **primary** save path when span splice is viable — only as fallback with warning
- Do not clear dirty / update baseline until PUT succeeds; after success always align draft to **response `content`** (disk bytes), then `commitBaseline`
- Do not reset draft via `selectionIdentity` change after save — update baseline in place via `commitBaseline`
- Do not conflate sync with save — sync may be a **pre-step**; only PUT writes disk
- Do not write ids not already in `CollectionStore`, or paths that resolve outside `repositoryRoot`
- Do not implement create-new `.http` file from UI — edit-only MVP (AD-4)
- Do not block DoD on full SourceSpan / intra-request `#` comment serializer rewrite — AC#7 is inter-request preservation via disk span splice
- Do not break Story 3.2 sync sequencing, rematch policy, or `applySyncResult` baseline semantics during save work
- Do not block Send solely because raw parse errors if structured draft + preview path still valid (3.1/3.2 behavior)
- Do not add toast notifications for save feedback — inline only (UX-DR17)

## Story

As a **developer committing `.http` changes via Git PRs**,
I want saves to write atomically with minimal formatting changes,
So that my teammates see clean, reviewable diffs.

## Acceptance Criteria

1. **Given** I have unsaved edits in the request workspace  
   **When** I click **Save** or press **Ctrl/S** / **⌘+S** (UX-DR21)  
   **Then** if structured draft fields differ from what `draft.content` represents, the client first runs visual→raw `POST .../sync` (reuse `buildSyncPayload('to-raw', …)` + `applySyncResult`) so `content` includes those edits (AD-18, FR11)  
   **And** the client then sends `PUT /api/collections/*` with `{ content }` equal to the resolved full-file text (FR13, AD-18)  
   **And** the server parses incoming content, applies minimal-diff against on-disk file, and atomically writes (AD-5, AD-4)  
   **And** raw-only edits (content already current) skip the pre-save sync and PUT `draft.content` directly

2. **And** on success the UI shows inline confirmation **"Saved to {path}"** using the collection filename (e.g. `auth.http`) (UX-DR17, UX-DR24)  
   **And** draft is updated from response `content` + matched request DTO (disk bytes), then baseline commits so dirty clears  
   **And** Save button hides (clean state)

3. **When** minimal-diff patch fails on the server  
   **Then** the server falls back to full-file rewrite of valid parsed content  
   **And** response includes a warning (`FULL_REWRITE`)  
   **And** amber inline message reads **"File rewritten with formatting changes. Review git diff."** (UX-DR17)

4. **When** incoming content fails parse  
   **Then** server returns `400` with `PARSE_ERROR` and line details  
   **And** draft is retained; inline parse error shown (UX-DR17)

5. **When** disk write fails (read-only file, permission denied)  
   **Then** error banner reads **"Cannot write to {path}. File may be read-only."** (UX-DR17, UX-DR24)  
   **And** draft and dirty state are retained

6. **When** I navigate to a different request or clear selection with unsaved changes  
   **Then** a confirm dialog prompts before discarding the draft (UX-DR26)  
   **And** Esc closes the dialog without navigating (UX-DR21)  
   **And** confirming discards draft and proceeds; cancel keeps current selection and draft

7. **And** existing comments and blank lines outside edited Request blocks are preserved on minimal-diff save (FR13, AD-5)

8. **And** UJ-2 completes — edit + save + git diff shows clean single-line change in test sessions (SM-4 / NFR14)

## Tasks / Subtasks

- [x] Task 1: Shared types + server save module (AC: #1, #3, #4, #5, #7)
  - [x] 1.0 Extract shared splice helper from `sync-collection.ts` (e.g. `packages/server/src/splice-request-span.ts`):
    - Move/export `splitLines`, `joinLines`, and span line-splice used by `applyVisualPatch`
    - Signature sketch: `spliceRequestSpan(content, span, serializedBlock) → string`
    - Refactor `applyVisualPatch` to call the helper — **one** splice implementation for sync + save
  - [x] 1.1 Add to `packages/shared-types/src/index.ts`:
    - `SaveCollectionRequest` — `{ content: string }`
    - `SaveCollectionWarning` — `{ code: Type.Literal('FULL_REWRITE'), message: string }`
    - `SaveCollectionResponse` — `{ savedAt: string, content: string, parseStatus, requests[], diagnostics[], warning?: SaveCollectionWarning }`
  - [x] 1.2 Add `packages/server/src/save-collection.ts`:
    - `minimalDiffSave(diskContent, incomingContent)` — parse incoming; on error return `{ ok: false, code: 'PARSE_ERROR', ... }`
    - Compare disk vs incoming parsed requests (by index; fingerprint fallback if feasible for MVP)
    - For each changed request: `serializeRequest` + `spliceRequestSpan` into **disk** text (not a second copy of private helpers)
    - Preserve file-level comments and inter-request blank lines outside patched spans
    - On splice/span failure → fallback: `serializeHttpFile(parsedIncoming)`; set `warning: FULL_REWRITE`
    - Return `{ ok: true, content: finalText, warning?, parseResult }`
  - [x] 1.3 Add `CollectionStore.save(id, content, repositoryRoot)`:
    - Require `collections.has(id)` (known scanned id only)
    - Resolve: `path.resolve(repositoryRoot, ...id.split('/'))`; reject if not under `path.resolve(repositoryRoot)` (+ path separator boundary)
    - Atomic write: temp `.${basename}.${pid}.${Date.now()}.tmp` + `rename` (mirror `config-store.ts`)
    - On success update in-memory map via `toCollectionDetail`
    - Map `EACCES` / `EPERM` / `ENOSPC` → `{ ok: false, code: 'WRITE_FAILED', message }`
  - [x] 1.4 Server unit tests in `save-collection.test.ts`:
    - Single-request method change → only that block’s lines differ from disk
    - Multi-request file — edit one block, others untouched; inter-request `#` comments preserved
    - Fallback returns `FULL_REWRITE` when forced (invalid span)
    - Parse error on incoming → no disk mutation
    - Path escape / unknown id rejected; atomic write failure (mock fs)

- [x] Task 2: PUT route (AC: #1, #4, #5)
  - [x] 2.1 Add `PUT /api/collections/*` in `packages/server/src/routes/collections.ts`:
    - Same slash-safe wildcard as GET detail (not `/sync` suffix)
    - Body: `SaveCollectionRequest`; response: `SaveCollectionResponse` or `ApiErrorEnvelope`
    - Flow: verify collection exists → read disk → `minimalDiffSave` → `collectionStore.save` → return DTO
    - `400 PARSE_ERROR`, `500 WRITE_FAILED`, `404 NOT_FOUND`
  - [x] 2.2 Extend `packages/server/src/collections.test.ts`:
    - PUT happy path writes disk; GET detail reflects new content
    - PUT does not corrupt file on parse error
    - Nested collection id path (`http/nested/demo.http`)
    - Warning field present on fallback rewrite

- [x] Task 3: Web save hook + baseline commit (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Add `packages/web/src/hooks/useSaveCollection.ts`:
    - Mutation `PUT /api/collections/${collectionId}` with `{ content }`
    - On success: `queryClient.setQueryData(['collection', id], …)` with response fields
  - [x] 3.2 Extend `useRequestDraft.ts`:
    - `applySaveResult({ content, request })` — set draft from response (disk-normalized `content` + matched request); then `commitBaseline()` from that draft
    - `commitBaseline()` alone is insufficient if response `content` differs from client draft (minimal-diff / FULL_REWRITE)
  - [x] 3.3 Wire `AppLayout.tsx` `handleSave`:
    - Guard: `canSave`, `selectedRequest`, `draft`; **no concurrent Save** while `syncMutation.isPending` or `saveMutation.isPending` (disable button / early-return; mirror RequestEditor sync sequencing)
    - **Pre-save content resolution:** visual edits leave `draft.content` stale until sync. Before PUT:
      1. If structured fields need folding into content → `await syncCollection({ body: buildSyncPayload('to-raw', draft, requestIndex) })` → `applySyncResult` → use returned `content`
      2. Else (raw-only / already synced) → use `draft.content`
      3. Pre-save sync `parseStatus === 'error'` → abort PUT; show diagnostics; keep dirty
    - PUT resolved `content`
    - On success: `applySaveResult` from response (matched request by index/fingerprint) → status message; clear status on selection change
    - On `FULL_REWRITE`: amber warning alongside success copy
    - On error: error banner; retain draft
  - [x] 3.4 Tests: mutation URL/body; visual-only Save syncs then PUTs patched content; after success draft `content` equals response `content` and `isDirty === false`

- [x] Task 4: Save UX + keyboard (AC: #2, #3, #4, #5, UX-DR17/21/24)
  - [x] 4.1 Extend `RequestLine.tsx` (or adjacent status strip):
    - Props: `saveStatus?: { kind: 'success' | 'warning' | 'error'; message: string }`; `savePending?: boolean`
    - Success: `role="status"` — `"Saved to {path}"` (basename of collection id)
    - Warning: amber — `"File rewritten with formatting changes. Review git diff."`
    - Error: `role="alert"` for write/parse failures
    - Disable Save when `!canSave || savePending || syncPending`
  - [x] 4.2 `AppLayout` keydown: Ctrl/⌘+S → `handleSave()` when `canSave` and not pending (keep `preventDefault`)
  - [x] 4.3 `App.test.tsx`: Ctrl+S save; success/error copy; Save no-ops while sync pending

- [x] Task 5: Navigate-away confirm (AC: #6, UX-DR26)
  - [x] 5.1 Add `packages/web/src/components/UnsavedChangesDialog.tsx`:
    - Modal/dialog with focus trap; Esc closes (UX-DR21)
    - Copy: direct developer voice — e.g. "Discard unsaved changes?" with **Discard** / **Cancel**
    - `role="dialog"`, `aria-modal="true"`
  - [x] 5.2 Gate navigation in `AppLayout.tsx`:
    - Wrap `handleSelectRequest` / `handleClearSelection` — if `isDirty`, stash pending action, show dialog
    - On confirm: proceed with pending selection change (draft resets via existing `draftSelectionKey` logic)
    - On cancel: noop
  - [x] 5.3 Component tests: dialog renders; Esc closes; confirm invokes pending navigation

- [x] Task 6: Diff-quality polish — **best-effort, non-blocking** (AC: #7)
  - [x] 6.1 AC#7 is satisfied when minimal-diff splices into **disk** text (inter-request comments/blanks outside edited spans preserved). That is the DoD bar.
  - [x] 6.2 Optional if cheap: preserve outer CRLF via shared `joinLines`; do **not** block story on intra-request `#` comment preservation or full SourceSpan redesign (`deferred-work.md` may remain open)
  - [x] 6.3 If any optional polish lands, add a focused parser/server fixture; otherwise leave deferred items documented

- [x] Task 7: Integration + regression (AC: #8)
  - [x] 7.1 Server: fixture → PUT edit → disk shows single-block git-friendly diff
  - [x] 7.2 `App.test.tsx`: 3.1/3.2 regression; raw save; visual-only save (sync then PUT); Save disabled while sync pending
  - [x] 7.3 `pnpm turbo build test typecheck`

## Dev Notes

### Save flow (authoritative)

**Critical:** Visual editors mutate structured draft fields only. `draft.content` stays at last disk/sync text until `POST .../sync` with a visual patch (tab switch or pre-save). PUT must never send that stale content after visual-only edits.

```mermaid
sequenceDiagram
  participant Web as AppLayout
  participant Sync as POST .../sync
  participant API as PUT /api/collections/*
  participant Save as save-collection.ts
  participant Store as CollectionStore
  participant Disk as .http file

  alt structured fields dirty vs content
    Web->>Sync: buildSyncPayload to-raw
    Sync-->>Web: content + request DTOs
    Web->>Web: applySyncResult
  end
  Web->>API: { content: resolvedFullFile }
  API->>Save: minimalDiffSave(disk, incoming)
  alt parse error
    Save-->>API: PARSE_ERROR
    API-->>Web: 400 + line
  else valid
    Save->>Save: splice changed request spans into disk text
    alt patch failure
      Save->>Save: full rewrite + FULL_REWRITE warning
    end
    API->>Store: save(id, finalContent)
    Store->>Disk: tmp + rename
    Store-->>API: updated CollectionDetailDto
    API-->>Web: 200 { savedAt, content, warning? }
    Web->>Web: applySaveResult(content, request); "Saved to {path}"
  end
```

### Pre-save content resolution (AD-18)

| User path | `draft.content` before Save | Required client step before PUT |
|-----------|----------------------------|----------------------------------|
| Edited Raw tab only | Already includes edits | PUT `draft.content` directly |
| Edited visual fields, then switched to Raw (synced) | Already patched by tab sync | PUT `draft.content` directly |
| Edited visual fields only (still on Params/Headers/Body) | **Stale** (still disk/last sync) | `POST .../sync` with `buildSyncPayload('to-raw', draft, requestIndex)` → `applySyncResult` → PUT returned `content` |
| Pre-save sync returns `parseStatus === 'error'` | Unchanged | **Abort PUT**; show diagnostics; keep dirty |

Reuse existing `syncMutateAsync` / `handleSyncSuccess` paths — do not invent a second visual patch client. Web still never serializes `.http` (AD-18).

### PUT API contract

**Endpoint:** `PUT /api/collections/*`  
(Collection id = repo-relative path, e.g. `http/users.http` — same wildcard as GET detail.)

**Request (`SaveCollectionRequest`):**

```typescript
{ content: string }
```

**Response (`SaveCollectionResponse`):**

```typescript
{
  savedAt: string           // ISO-8601 UTC
  content: string           // final text written to disk
  parseStatus: 'ok' | 'error'
  requests: RequestDto[]
  diagnostics: DiagnosticDto[]
  warning?: { code: 'FULL_REWRITE'; message: string }
}
```

**Errors (`ApiErrorEnvelope`):**

| Code | HTTP | When |
|------|------|------|
| `PARSE_ERROR` | 400 | Incoming content fails parse |
| `WRITE_FAILED` | **500** | EACCES/EPERM/ENOSPC (or other write I/O failure) |
| `NOT_FOUND` | 404 | Unknown collection id |

Path escape / unresolved outside repo → treat as `WRITE_FAILED` or `NOT_FOUND` (prefer reject before write; do not create files outside root).

### Minimal-diff algorithm (server — required)

1. Read **diskContent** (authoritative pre-save state)
2. `parseHttpFile(incomingContent)` — fatal diagnostics → `PARSE_ERROR`
3. `parseHttpFile(diskContent)` — disk corrupt → full rewrite of valid incoming + `FULL_REWRITE`
4. Diff requests by index (AST equivalence ignoring spans; optional fingerprint fallback)
5. For each changed index `i`: `serializeRequest(incoming[i])` then `spliceRequestSpan(diskText, disk.requests[i].span, block)` — **shared helper**, not duplicated locals from `sync-collection.ts`
6. Splice failure → `serializeHttpFile(incomingParse)` + `FULL_REWRITE`
7. Atomic write; `toCollectionDetail` for response DTOs; update store

Do not write raw `incomingContent` when minimal-diff succeeds — preserve disk formatting outside edited spans.

### Post-save draft state (critical)

| Event | draft | baseline | isDirty |
|-------|-------|----------|---------|
| User edits | updated | unchanged (disk) | true |
| Sync (tab / pre-save) | updated in place | unchanged (disk) | true if ≠ disk |
| **Save success** | **`applySaveResult` from response `content` + matched request** | **= that draft** | **false** |
| Save failure | unchanged | unchanged | true |
| Selection change (confirmed) | reset from loaded | reset | false |

**Always** set draft from server response before baseline — client draft may differ after minimal-diff or FULL_REWRITE. Then `commitBaseline()`.

**Identity trap:** update query cache / optional fingerprint on `selectedRequest`; never change `draftSelectionKey` to “refresh” after save.

### Save vs sync race

- While `syncMutation.isPending` or `saveMutation.isPending`: disable Save / no-op `handleSave` and Ctrl/⌘+S
- Pre-save sync and PUT are sequential in one `handleSave` async flow — do not start a second Save overlapping the first
- Tab-switch sync in `RequestEditor` must not interleave mid-save; pending save should finish or button stay disabled until sync settles

### Save vs sync

| | POST `.../sync` | PUT `.../*` |
|--|-----------------|-------------|
| Purpose | Re-parse / visual patch for tab switch **and pre-save fold** | Persist to disk |
| Disk | Unchanged | Atomically updated |
| Client payload | content + optional patch | content only (must already include visual edits) |
| Baseline | Unchanged (stays disk) | Updated on success |

Sync alone is not persistence. Save may call sync first so the PUT body is truthful full-file text.

### Navigate-away confirm

Intercept when `isDirty === true`:

- Sidebar request selection (`onSelectRequest`)
- Clear selection (`onClearSelection`)
- Collection change that clears selection (via `SidebarShell` → `onClearSelection` when collection disappears)

**Not in scope:** browser `beforeunload` tab close — optional enhancement; UX-DR26 specifies request/collection navigation.

### Ctrl/⌘+S

Extend existing handler in `AppLayout.tsx` (~289–312):

```typescript
if (event.key.toLowerCase() === 's') {
  event.preventDefault()
  if (canSave) handleSave()
  return
}
```

Mirror `deriveCanSend` pattern — shared gate for button and shortcut.

### Save status microcopy (UX-DR24)

| Situation | Copy |
|-----------|------|
| Success | `Saved to auth.http` (basename of collection id) |
| Full rewrite | `File rewritten with formatting changes. Review git diff.` (amber) |
| Write failure | `Cannot write to http/auth.http. File may be read-only.` |
| Parse on save | Use diagnostic line: `Parse error at line {n}` or server message |

Inline only — `role="status"` for success, `role="alert"` for errors.

### Architecture compliance (MUST follow)

| AD / FR / UX | Requirement for 3.3 |
|--------------|---------------------|
| AD-4 | Disk source of truth; atomic tmp+rename; edit-only MVP |
| AD-5 | Minimal-diff primary; full rewrite fallback + warning |
| AD-10 | TypeBox schemas for save request/response |
| AD-18 | PUT full content only; pre-save visual→raw sync when needed; server parse + serialize; web never serializes |
| AD-22 | Web imports DTOs only |
| FR13 | Persist edits; formatting preservation; atomic write |
| UX-DR17 | Inline save success/failure/warning — not toast |
| UX-DR21 | Ctrl/⌘+S save; Esc closes confirm |
| UX-DR24 | Prescribed microcopy |
| UX-DR26 | Navigate-away confirm when dirty |

### Scope boundaries

**In scope:** PUT; shared `spliceRequestSpan`; `save-collection.ts`; `CollectionStore.save` (containment); web save + pre-save sync; `applySaveResult`; Ctrl+S; save status; navigate-away; pending-mutation gating; tests.

**Out of scope:**
- Create-new `.http` from UI
- Auto `POST /collections/refresh` after save
- Browser `beforeunload`
- History on save (Epic 4)
- Full SourceSpan redesign / intra-request `#` comment preservation (deferred unless trivial)
- Deferred URL-encoding polish

### Current code state (touch points)

| File | Current state | This story |
|------|---------------|------------|
| `packages/server/src/routes/collections.ts` | GET, POST sync, POST refresh | **UPDATE** — PUT |
| `packages/server/src/collection-store.ts` | Read-only cache | **UPDATE** — `save()` + containment |
| `packages/server/src/sync-collection.ts` | Private splice helpers | **UPDATE** — extract shared helper |
| `packages/server/src/splice-request-span.ts` | — | **NEW** (or equivalent extract) |
| `packages/server/src/config-store.ts` | Atomic write pattern | **READ** |
| `packages/server/src/save-collection.ts` | — | **NEW** |
| `packages/shared-types/src/index.ts` | Sync types | **UPDATE** — Save types |
| `packages/web/src/hooks/useRequestDraft.ts` | No commit/save apply | **UPDATE** — `applySaveResult` / `commitBaseline` |
| `packages/web/src/components/AppLayout.tsx` | Save stub | **UPDATE** — save + pre-sync + confirm |
| `packages/web/src/components/RequestLine.tsx` | Save button | **UPDATE** — status + pending disable |
| `packages/web/src/hooks/useSaveCollection.ts` | — | **NEW** |
| `packages/web/src/components/UnsavedChangesDialog.tsx` | — | **NEW** |
| `packages/http-parser` serialize/spans | Known deferred limits | **OPTIONAL** polish only |

### Previous story intelligence (3.2)

- Baseline stays disk until Save — `applySyncResult` must not clear dirty; Save uses `applySaveResult` + baseline
- `draftSelectionKey` = `collectionId:requestIndex` — do not conflate with fingerprint
- Extract shared splice — `applyVisualPatch` already has the algorithm; helpers are currently **private**
- Gate Save while sync pending (RequestEditor sequencing)
- Do not regress rematch / `body: null` / tab bounce

### Previous story intelligence (3.1)

- `showSave = isDraftDirty`; `canSave = dirty && valid && !parseBlockingSave`
- Mirror shared gate for button + Ctrl+S; extend with `!syncPending && !savePending`
- Save errors via `role="alert"` adjacent to RequestLine — no toasts

### Git intelligence

- Baseline commit: `5d875a8` (3.2 harden). Prior: `2cea3a2` raw editor, `32a06a8` 3.1 review fixes.
- Patterns: span splice, `draftSelectionKey`, TanStack `setQueryData`, Vitest fixtures

### Testing standards

- `save-collection.test.ts` — minimal-diff line assertions; containment reject
- `collections.test.ts` — PUT + temp repo; `500 WRITE_FAILED`
- Hooks/components/App — visual-only save path; post-save `content` === response; pending disable
- Gate: `pnpm turbo build test typecheck`

### Latest technical information

- React 19 + TanStack Query v5 mutation + `setQueryData`
- Vitest 3 + RTL; Fastify 5 + TypeBox; Node `>=24 <25` `fs.promises` rename
- Native `<dialog>` / modal matching design tokens — no new UI library

### Project context reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.3, FR13, UX-DR17/21/24/26]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-4, AD-5, AD-18]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — §4.3 Edit and save]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/addendum.md` — minimal-diff]
- [Source: `_bmad-output/implementation-artifacts/3-2-raw-http-editor-with-syntax-highlighting.md`]
- [Source: `_bmad-output/implementation-artifacts/3-1-visual-request-editor.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]
- [Source: `packages/server/src/sync-collection.ts` — private splice to extract]
- [Source: `packages/server/src/config-store.ts` — atomic write]
- [Source: `packages/web/src/hooks/useRequestDraft.ts`]
- [Source: `packages/web/src/utils/syncOnTabSwitch.ts` — pre-save `to-raw`]
- [Source: `packages/web/src/components/AppLayout.tsx`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Pre-save sync uses `structuredFieldsDifferFromBaseline` so raw-only edits PUT without overwriting via stale visual patch.
- Shared `joinLines` preserves CRLF from disk content during span splice.

### Completion Notes List

- Implemented `PUT /api/collections/*` with `minimalDiffSave`, atomic `CollectionStore.save`, and TypeBox DTOs.
- Extracted `splice-request-span.ts`; refactored sync visual patch to reuse the same helper.
- Wired web save flow: pre-save visual→raw sync, PUT mutation, `applySaveResult`, inline status copy, Ctrl/⌘+S, navigate-away confirm dialog.
- Added server/web tests; `pnpm turbo build test typecheck` passes (15 tasks).

### File List

- packages/server/src/splice-request-span.ts (new)
- packages/server/src/save-collection.ts (new)
- packages/server/src/save-collection.test.ts (new)
- packages/server/src/sync-collection.ts (modified)
- packages/server/src/collection-store.ts (modified)
- packages/server/src/routes/collections.ts (modified)
- packages/server/src/collections.test.ts (modified)
- packages/shared-types/src/index.ts (modified)
- packages/web/src/hooks/useSaveCollection.ts (new)
- packages/web/src/hooks/useRequestDraft.ts (modified)
- packages/web/src/utils/requestDraft.ts (modified)
- packages/web/src/utils/requestDraft.test.ts (modified)
- packages/web/src/components/AppLayout.tsx (modified)
- packages/web/src/components/RequestLine.tsx (modified)
- packages/web/src/components/RequestEditor.tsx (modified)
- packages/web/src/components/WorkspaceShell.tsx (modified)
- packages/web/src/components/UnsavedChangesDialog.tsx (new)
- packages/web/src/components/UnsavedChangesDialog.test.tsx (new)
- packages/web/src/App.test.tsx (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

## Change Log

- 2026-07-21: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-21: Pre-save visual→raw sync so PUT never persists stale visual-only `draft.content`
- 2026-07-21: Shared splice extract; path containment; `applySaveResult` disk alignment; `WRITE_FAILED`→500; Task 6 best-effort; save/sync pending gate
- 2026-07-21: Story 3.3 implemented — server minimal-diff save, web save UX, navigate-away confirm, full test suite green
