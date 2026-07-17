---
baseline_commit: e0a7201
---

# Story 3.1: Visual Request Editor

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [ ] Unified in-memory **request draft** holds method, URL, headers, and body — initialized from loaded `RequestDto`, reset on selection change (AD-4)
- [ ] Request workspace shows **Params**, **Headers** (count badge), and **Body** sub-tabs below the request line (UX-DR11); **Raw `.http` tab deferred to Story 3.2**
- [ ] Visual panels edit draft fields; switching sub-tabs **does not discard** unsaved edits
- [ ] **Save** secondary button visible and enabled only when draft is dirty **and** validation passes (UX-DR10); click handler is a no-op stub — disk save is Story 3.3
- [ ] Invalid combinations (GET/HEAD/OPTIONS with body content or Content-Type conflict) show **inline validation feedback** before save
- [ ] Send and preview use **draft** method/url/headers/body via extended API overrides — not stale disk-only headers/body (AD-8 continuity with Story 2.5)
- [ ] Clearing draft body sends `body: null` so server does not fall back to disk body
- [ ] Story 2.5 Send gating, pre-send preview, env toolbar, and response panel **non-regressed**
- [ ] FR11 visual form editing complete; FR11 “update raw `.http` representation” consequence is **Story 3.2**, not this story
- [ ] `pnpm turbo build test typecheck` passes workspace-wide

### Anti-patterns (do not ship)

- Do not write to disk or add `PUT /api/collections/:id` — Story 3.3
- Do not implement Raw `.http` editor, syntax highlighting, or mode switch re-parse — Story 3.2 (AD-18)
- Do not claim FR11 fully done via client-side raw sync — Raw representation update is Story 3.2
- Do not serialize `.http` text client-side or import `@reqor/http-parser` in `@reqor/web` (AD-3, AD-18, AD-22)
- Do not add navigate-away confirm dialog — Story 3.3 (UX-DR26); selection change in 3.1 discards dirty draft without confirm
- Do not wire Ctrl/⌘+S to save — Story 3.3 (keep `preventDefault()` only in `AppLayout`)
- Do not mutate React Query `CollectionDetailDto` cache in place — draft is separate session state
- Do not break Story 2.5 preview debounce, `deriveCanSend`, or `lastPreviewRef` stale-preview behavior
- Do not show Save when draft is clean — **hide** until dirty (UX-DR10)
- Do not use bare `new URL(draft.url)` for Params — template URLs like `{{host}}/path` must not throw
- Do not omit `body` from preview/execute when the user cleared it — omission means “no override” and keeps disk body; use `null` to clear
- Do not add npm dependencies for URL/query parsing — use string/`URL` / `URLSearchParams` built-ins only

## Story

As a **developer who prefers form-based editing**,
I want to modify method, URL, headers, and body via visual fields,
So that I can adjust requests without writing raw `.http` syntax.

## Acceptance Criteria

1. **Given** a request is loaded in the workspace  
   **When** I use the visual editor sub-tabs **Params**, **Headers** (with count badge), and **Body** (UX-DR11)  
   **Then** I can modify method, URL, headers, and body via form fields (FR11)  
   **And** the **Params** tab edits query-string key/value pairs derived from the draft URL (updates `url` in draft)  
   **And** the **Headers** tab edits `{ name, value }` rows with add/remove  
   **And** the **Body** tab edits `body.kind` (`raw` | `json` | `form`) and `body.content` when a body exists; when `body` is absent, an **Add body** control creates `{ kind: 'raw', content: '' }`

2. **And** changes update **draft state only** — no disk write until Save (AD-4)  
   **And** draft resets to the loaded `RequestDto` when selection changes (`collectionId` + `requestIndex` + `fingerprint`)  
   **And** dirty flag is `true` when draft differs from baseline snapshot

3. **When** invalid combinations exist (e.g., GET/HEAD/OPTIONS with non-empty body, or Content-Type header with empty body on bodyless methods)  
   **Then** inline validation feedback appears in the request workspace (FR11)  
   **And** Save stays disabled while validation fails  
   **And** Send may still work for bodyless GET (validation is pre-save UX, not a hard execute block unless productively impossible)

4. **When** I switch between Params, Headers, and Body sub-tabs  
   **Then** unsaved draft edits are preserved (UX-DR11)

5. **And** Save button appears as secondary button (`bg-surface border-border`), **enabled only when draft is dirty and valid** (UX-DR10)  
   **And** Save is **hidden** when draft is clean  
   **And** Save click does not persist to disk in this story — handler stub only (Story 3.3 wires PUT)

6. **And** `POST /api/preview` and `POST /api/execute` accept draft **headers** and **body** overrides so Send/preview reflect visual edits (extends Story 2.5 method/url override pattern)  
   **And** web always sends draft `headers` (array, may be empty) with preview/execute  
   **And** draft body absent → send `body: null` (clear); body present → send body object; never omit body when using draft overrides (omission would keep disk body via `??`)  
   **And** Ctrl/⌘+Enter and `handleSend` read the **full current draft** (method, url, headers, body) — not a stale method/url-only payload  
   **And** unresolved-variable gating and pre-send preview from Story 2.5 continue to work against draft values

## Tasks / Subtasks

- [ ] Task 1: Draft state model + utilities (AC: #1–#4) — AD-4, AD-22
  - [ ] 1.1 Add `packages/web/src/utils/requestDraft.ts`:
    - `draftFromRequest(req: RequestDtoType): RequestDraft`
    - `draftEquals(a, b): boolean` for dirty detection
    - `parseUrlParams(url: string)` / `applyUrlParams(url, params[])` — see Params↔URL algorithm in Dev Notes (never throw on `{{var}}` / relative URLs)
    - `validateRequestDraft(draft): { valid: boolean; message?: string }` — GET/HEAD/OPTIONS + body/content-type rules (header name match case-insensitive)
  - [ ] 1.2 Add `packages/web/src/hooks/useRequestDraft.ts` — owns draft, baseline, dirty, validation message; resets on `selectionIdentity` + `activeRequest` change; exposes `setDraft` / field updaters including `addBody()` / `clearBody()`
  - [ ] 1.3 Unit tests: `requestDraft.test.ts`, `useRequestDraft.test.tsx` — params round-trip for absolute, relative, and `{{host}}/path?x=1` URLs; dirty detection; validation cases; reset on selection

- [ ] Task 2: Visual editor UI (AC: #1, #4, #5) — UX-DR10, UX-DR11
  - [ ] 2.1 Add `packages/web/src/components/RequestSubTabs.tsx` — copy a11y + underline pattern from **`ResponsePanel.tsx`** (preferred: `id` / `aria-controls` / `tabpanel` / `hidden`); visual classes match SidebarTabs; tabs: Params | Headers (badge `{count}`) | Body
  - [ ] 2.2 Add `RequestParamsPanel.tsx` — key/value rows, add/remove, controlled from draft URL via utils
  - [ ] 2.3 Add `RequestHeadersPanel.tsx` — name/value rows, add/remove; label grid matches `PreSendPreview` / `EnvironmentVariablesStrip`
  - [ ] 2.4 Add `RequestBodyPanel.tsx` — when `body` undefined: show **Add body** button that sets `{ kind: 'raw', content: '' }`; when present: kind `<select>` + `<textarea>` + optional remove/clear; section label `text-label`
  - [ ] 2.5 Add `RequestEditor.tsx` — composes `RequestLine` + sub-tabs + active panel; threads draft props
  - [ ] 2.6 Update `RequestLine.tsx` — accept `isDraftDirty`, `canSave`, `validationError`, `onSave`; **hide** Save when clean; enable when `canSave`; keep existing focus-ring classes on Save when visible
  - [ ] 2.7 Update `RequestLine.test.tsx` — Save focus-ring test must render with dirty draft (or assert Save absent when clean); add dirty/valid Save enablement cases
  - [ ] 2.8 Component tests for each panel + sub-tab switching preserves draft

- [ ] Task 3: App integration (AC: #2, #5, #6) — preserve Story 2.5
  - [ ] 3.1 Refactor `AppLayout.tsx` — replace separate `lineMethod`/`lineUrl` with `useRequestDraft`; pass full draft to preview/execute; Ctrl/⌘+Enter and `handleSend` use current draft method/url/headers/body
  - [ ] 3.2 Update `WorkspaceShell.tsx` — render `RequestEditor` instead of bare `RequestLine`; thread draft + validation props
  - [ ] 3.3 Extend `usePreviewRequest` query key + body with draft `headers` and `body` (`null` when cleared)
  - [ ] 3.4 Extend execute mutation payload in `AppLayout.handleSend` with draft `headers` and `body` (`null` when cleared)
  - [ ] 3.5 Integration tests in `App.test.tsx` — sub-tab edit survives tab switch; dirty enables Save / clean hides Save; validation message for GET+body; cleared body sends `null`

- [ ] Task 4: Server draft overrides for preview + execute (AC: #6) — AD-8, AD-10
  - [ ] 4.1 Extend `@reqor/shared-types`: `headers?: RequestHeaderDto[]` and `body?: RequestBodyDto | null` on `PreviewRequest` and `ExecuteRequest` (`null` = clear body)
  - [ ] 4.2 Update `packages/server/src/routes/preview.ts` and `proxy/execute-request.ts` — merge rules in Dev Notes; method/url override behavior unchanged
  - [ ] 4.3 Update `preview.test.ts` and `execute.test.ts` — header override; body override; `body: null` clears disk body
  - [ ] 4.4 Update `shared-types` schema tests

- [ ] Task 5: Regression gate (AC: all)
  - [ ] 5.1 Run `pnpm turbo build test typecheck`
  - [ ] 5.2 Smoke: edit header in visual tab → Send uses edited header; Story 2.5 preview/Send gating still passes existing tests

## Dev Notes

### Draft model (authoritative)

```typescript
type RequestDraft = {
  method: string
  url: string
  headers: RequestHeaderDtoType[]
  body?: RequestBodyDtoType
}
```

| Event | Behavior |
|-------|----------|
| Request selected / `activeRequest` loaded | `baseline = draftFromRequest(activeRequest)`; `draft = baseline`; dirty = false |
| User edits any field | Update draft immutably; dirty = !draftEquals(draft, baseline) |
| Selection changes | Discard draft (no confirm in 3.1); re-init from new `activeRequest` |
| Save clicked (3.1) | No-op stub — Story 3.3 persists |
| Send / Preview / Ctrl+Enter | Pass draft method, url, headers, and body (`null` if cleared) as API overrides |

**Params ↔ URL:** Params tab is a view over the query string portion of `draft.url`. Do not add a separate params DTO field.

**Params ↔ URL algorithm (required):**

1. Split `url` on the **first** `?` into `base` + `query` (if no `?`, `query` is empty). Never throw.
2. Parse `query` with `URLSearchParams` for the Params rows; `applyUrlParams` rebuilds `base + (params.length ? '?' + serialized : '')`.
3. Optional enhancement: when `url` is a valid absolute URL, may use `URL` + `searchParams` — but fallback to step 1–2 must cover:
   - relative paths (`/api/users?x=1`)
   - template hosts (`{{host}}/path?x=1`, `http://{{host}}/path`)
4. Preserve characters outside the query string exactly (including `{{...}}` in the base).
5. Unit-test at least: absolute URL, relative path with query, `{{host}}/get?retry=1`.

### Body panel UX

| Draft `body` | Body tab UI |
|--------------|-------------|
| `undefined` | Empty state + **Add body** → sets `{ kind: 'raw', content: '' }` |
| Present | Kind select (`raw` \| `json` \| `form`) + content textarea; **Remove body** clears to `undefined` |
| Cleared for API | Preview/execute send `body: null` |

### Validation matrix (MVP — expand only if tests require)

| Condition | Feedback | Blocks Save |
|-----------|----------|-------------|
| Method ∈ `{GET, HEAD, OPTIONS}` and `body.content` trimmed non-empty | e.g. `GET requests should not include a body` | Yes |
| Method ∈ `{GET, HEAD, OPTIONS}` and a header whose name equals `content-type` **case-insensitively** is present, but body empty/absent | e.g. `Content-Type header requires a request body` | Yes |
| Empty header name row | e.g. `Header name is required` | Yes (optional: filter blank rows on send — prefer explicit validation) |

Use `role="alert"` for validation messages (UX-DR17 pattern). Do not use toast/modal. Place draft validation near the request line / Save (distinct from Story 2.5 unresolved-variable alert).

### Save button behavior (Story 3.1 vs 3.3)

| State | Save button |
|-------|-------------|
| Draft clean | **Hidden** (UX-DR10 “visible only when draft dirty”) |
| Draft dirty + valid | Visible, enabled, secondary styling |
| Draft dirty + invalid | Visible, disabled, validation message shown |
| Click | No disk I/O — Story 3.3 adds `PUT` + confirmation |

**Test note:** `RequestLine.test.tsx` currently expects Save always present for focus rings. Update tests to assert focus rings when Save is shown (dirty), and assert Save is not in the document when clean.

### Sub-tabs scope

| Tab | Story 3.1 | Notes |
|-----|-----------|-------|
| Params | ✅ | Query string editor |
| Headers | ✅ | Badge = `draft.headers.length` |
| Body | ✅ | kind + content + Add/Remove body |
| Raw `.http` | ❌ Story 3.2 | Do not render disabled placeholder — omit tab |

### API override extension (required for coherent editor)

Story 2.5 added optional `method` / `url` on preview + execute. Visual editing of headers/body is useless if proxy still reads disk DTO only.

**Extend request bodies:**

```typescript
// PreviewRequest & ExecuteRequest — add:
headers?: RequestHeaderDto[]
body?: RequestBodyDto | null  // null = clear body; omit only when not using draft overrides
```

**Web send contract (always when draft is active):**

- Always include `method`, `url`, `headers` from draft (`headers` may be `[]`)
- If `draft.body` is defined → send `body: draft.body`
- If `draft.body` is undefined → send `body: null` (user cleared or never had body — must not fall back to disk via `??`)

**Server merge rule:**

```typescript
const headers = body.headers !== undefined
  ? body.headers.map(...)
  : req.headers.map(...)

const resolvedBody =
  body.body === null ? undefined           // explicit clear
  : body.body !== undefined ? body.body    // override object
  : req.body                               // no override key (legacy callers)
```

Then pass into existing `resolveRequest()` unchanged.

### Epic context

Epic 3 (UJ-2): Priya edits `.http` in Git-friendly workflow. **3.1** = visual form editor + draft. **3.2** = raw editor + bidirectional sync via server re-parse (completes FR11 raw-representation consequence). **3.3** = atomic save + Ctrl/⌘+S + navigate-away confirm.

Epic 3 depends on Epic 1 only for core editing; Epic 2 Send gating is already shipped and must not regress.

### Architecture compliance (MUST follow)

| AD / FR / UX | Requirement for 3.1 |
|--------------|----------------------|
| AD-3 | Web never parses `.http` — edit structured DTO fields only |
| AD-4 | Draft in React state until explicit Save (3.3) |
| AD-8 | Preview + execute share server `resolveRequest()` — pass draft overrides into same path |
| AD-10 | TypeBox schema changes in `@reqor/shared-types` |
| AD-18 | Web mutates DTO-shaped draft only — no client `.http` serialization |
| AD-22 | Web imports DTO types from `@reqor/shared-types` only |
| FR11 | Visual editing of method, URL, headers, body; raw sync → Story 3.2 |
| UX-DR10 | Save secondary, dirty-gated (hidden when clean); Send primary unchanged |
| UX-DR11 | Underline sub-tabs; tab switch preserves draft |
| UX-DR17 | Inline validation copy — not marketing fluff |
| UX-DR21 | Ctrl/⌘+Enter Send — uses `canSend` + **full draft** from Story 2.5 path |
| UX-DR22 | Focus rings on Send/Save buttons |

### Scope boundaries

**In scope:** Draft model; Params/Headers/Body panels; dirty Save UX (stub handler); validation feedback; preview/execute header/body overrides (incl. `null` clear); tests.

**Out of scope:**
- Raw editor, syntax highlighting, visual↔raw sync — Story 3.2 (FR12 + FR11 raw consequence)
- Disk save, minimal-diff, Ctrl/⌘+S save, “Saved to {path}”, navigate-away confirm — Story 3.3 (FR13, UX-DR26)
- Create-new `.http` file UI — post-MVP (AD-4)
- History replay into editor — Epic 4
- cURL import/export — Epic 5

### Current code state (touch points)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/web/src/components/AppLayout.tsx` | `lineMethod`/`lineUrl` session overrides; Ctrl+Enter sends method/url only | **UPDATE** — `useRequestDraft`; full draft to preview/execute/keyboard send |
| `packages/web/src/components/WorkspaceShell.tsx` | Renders `RequestLine` only | **UPDATE** — `RequestEditor` + draft props |
| `packages/web/src/components/RequestLine.tsx` | Method/URL/Send; Save always visible + disabled | **UPDATE** — hide Save when clean; dirty Save; validation display |
| `packages/web/src/components/RequestLine.test.tsx` | Assumes Save always present | **UPDATE** — dirty/clean Save visibility + focus rings |
| `packages/web/src/hooks/usePreviewRequest.ts` | method/url overrides only | **UPDATE** — headers/body (`null` clear) in query key + POST body |
| `packages/shared-types/src/index.ts` | Preview/Execute without header/body overrides | **UPDATE** — `headers?`, `body?: RequestBodyDto \| null` |
| `packages/server/src/routes/preview.ts` | method/url overrides | **UPDATE** — header/body/`null` merge |
| `packages/server/src/proxy/execute-request.ts` | method/url overrides | **UPDATE** — header/body/`null` merge |
| `packages/web/src/utils/deriveCanSend.ts` | Story 2.5 Send matrix | **UNCHANGED** — consume from AppLayout |
| `packages/web/src/components/PreSendPreview.tsx` | Story 2.5 preview panel | **UNCHANGED** |
| `packages/web/src/components/ResponsePanel.tsx` | Full tablist/tabpanel a11y pattern | **READ** — copy for `RequestSubTabs` |
| `packages/web/src/hooks/useCollectionDetail.ts` | Read-only fetch | **UNCHANGED** |

### Previous story intelligence (2.5 — Send/preview)

- Preview debounce 300ms via `usePreviewRequest`; include draft headers/body in debounce deps + query key
- `deriveCanSend` extracted to `utils/deriveCanSend.ts` — do not duplicate Send matrix
- `lastPreviewRef` preserves last good preview on refresh failure for static requests — preserve when refactoring AppLayout
- `resolveRequest()` is server-only; web passes overrides via API
- Do not regress `UNRESOLVED_VARIABLE` gating or `SecretField` in preview
- Ctrl/⌘+Enter must use **current** draft values (same pitfall 1.7/2.5 fixed for method/url — extend to headers/body)

### Previous story intelligence (1.7 — request line)

- Save button stub + Ctrl/⌘+S `preventDefault()` intentionally deferred to Epic 3
- Request line owns method dropdown colors via `getMethodColorClass`
- Prop chain: `AppLayout → WorkspaceShell → RequestLine` — extend via `RequestEditor`, do not bypass
- `WorkspaceShell` receives unused `collectionId`/`requestIndex` — use for draft identity if helpful
- Save currently always visible + hard-disabled — 3.1 switches to hide-when-clean

### Tab UI pattern (copy from ResponsePanel)

Prefer **`ResponsePanel.tsx`** over `SidebarTabs.tsx` — ResponsePanel already wires full a11y:

- Container: `role="tablist"`, `border-b border-border`
- Active tab: `border-b-2 border-primary text-foreground`
- Inactive: `text-foreground-muted`
- Tab: `role="tab"`, `aria-selected`, `id`, `aria-controls`, `tabIndex={active ? 0 : -1}`
- Panel: `role="tabpanel"`, `aria-labelledby`, `hidden` when inactive

Headers count badge: append ` ({draft.headers.length})` to tab label or small muted suffix — match UX-DR11 intent.

### Testing standards

- **Unit:** `requestDraft.test.ts` — URL↔params (absolute / relative / `{{host}}`), validation matrix (case-insensitive Content-Type), equality
- **Hook:** `useRequestDraft.test.tsx` — reset on selection, dirty toggling, add/clear body
- **Components:** each panel + `RequestSubTabs` tab switch retains edited value; Body Add body / Remove body
- **RequestLine:** Save hidden when clean; visible+enabled when dirty+valid; focus rings when visible
- **Integration:** `App.test.tsx` — edit header → mock execute receives override; clear body → `"body":null` in fetch body; Ctrl+Enter includes headers
- **Server:** `preview.test.ts` / `execute.test.ts` — override headers/body; `body: null` clears stored body
- **Regression:** all Story 2.5 tests pass unchanged except where props extended
- **Gate:** `pnpm turbo build test typecheck`

### Latest technical information

- **React 19 + TanStack Query v5** — draft is local React state, not Query cache
- **Vitest 3 + RTL** — follow `RequestLine.test.tsx` / `App.test.tsx` fetch mock router pattern
- **No new npm deps** — Params via first-`?` split + `URLSearchParams`; optional `URL` only when safe
- **Fastify 5 + TypeBox** — `Type.Union([RequestBodyDto, Type.Null()])` (or equivalent) for clearable body; run `shared-types` tests after schema change

### Project context reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.1, FR11, UX-DR10/11]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/prd.md` — §4.6 visual editor]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-3, AD-4, AD-8, AD-18, AD-22]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — editor sync model §4.3]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — request workspace IA, draft dirty]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/DESIGN.md` — request line + sub-tab specs]
- [Source: `_bmad-output/implementation-artifacts/1-7-http-proxy-execution-and-response-panel.md` — deferred Epic 3 scope]
- [Source: `_bmad-output/implementation-artifacts/2-5-send-time-variable-resolution-and-pre-send-preview.md` — preview/execute override pattern]
- [Source: `packages/web/src/components/AppLayout.tsx`, `RequestLine.tsx`, `ResponsePanel.tsx`]
- [Source: `packages/shared-types/src/index.ts`, `packages/server/src/proxy/execute-request.ts`]

## Dev Agent Record

### Agent Model Used

Cursor Composer

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-17: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-17: Story context validated — draft model, header/body API overrides for preview/execute, Raw tab deferred to 3.2, Save stub until 3.3, validation matrix, tab UI patterns from ResponsePanel
- 2026-07-17: Hardened override/`null` body clear, Params algorithm for template URLs, Add body UX, case-insensitive Content-Type, Ctrl+Enter full-draft continuity, Save hide-when-clean test notes
