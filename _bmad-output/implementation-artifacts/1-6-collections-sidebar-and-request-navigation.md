---
baseline_commit: c81ecf4
---

# Story 1.6: Collections Sidebar and Request Navigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

Verify all of the following before marking done:

- [x] `pnpm --filter @reqor/web build` succeeds with new sidebar components
- [x] `pnpm --filter @reqor/web test` and `pnpm turbo typecheck` pass (no regressions from Stories 1.1–1.5)
- [x] `pnpm turbo build test typecheck` pass workspace-wide
- [x] Collections tab shows tree of `.http` files with expand/collapse and method-colored text mini-badges per request
- [x] Clicking a request fetches detail via `GET /api/collections/{id}` and shows method + URL preview in request workspace (FR10)
- [x] Contextual search filters by collection `id` always; by request `method`/`url` only for collections with loaded detail (NFR1-safe)
- [x] Refresh triggers `POST /api/collections/refresh` with button spinner only — tree stays mounted (no skeleton flash)
- [x] Parse-error files show red badge; expanding reveals `Line {N}: {message}` per diagnostic
- [x] Empty repo shows exact UX-DR24 copy with Refresh button
- [x] Keyboard: `↑`/`↓` move focus; `Enter` on request selects, on file toggles expand; `→`/`←` expand/collapse (UX-DR21, NFR9)
- [x] Collections | History tabs preserve independent search query and scroll position
- [x] Refresh button has accessible name (`aria-label`) + `aria-busy` while pending (UX-DR22)
- [x] Layout preserved: 280px sidebar, `min-w-[1280px]`; long paths truncate with `title` tooltip
- [x] History tab is shell-only placeholder — no history API calls
- [x] No Send/Save, proxy, env selector, or editor sub-tabs; no server/shared-types changes unless blocking bug

## Story

As a **developer browsing my repository's API requests**,
I want a sidebar tree of `.http` files and their requests with search and refresh,
So that I can quickly find and select the request I need to send.

## Acceptance Criteria

1. **Given** collections are loaded from `GET /api/collections`  
   **When** I view the Collections tab (UX-DR5)  
   **Then** sidebar shows one node per `.http` file with expand/collapse and method-colored text mini-badges per request (UX-DR7, UX-DR13, UX-DR22)

2. **And** clicking a request loads its details in the request workspace (FR10) — at minimum method badge + mono URL from the selected `RequestDto`; placeholder clears

3. **And** contextual search filters within Collections tab only (UX-DR6):
   - Always match collection `id` (path), case-insensitive
   - Match request `` `${method} ${url}` `` only for collections whose detail is already in the query cache (no eager prefetch of all details — NFR1)
   - When a request match hides under a collapsed file, auto-expand that file
   - Empty search → show all collections from the list response

4. **And** Refresh action triggers `POST /api/collections/refresh` with inline spinner on the Refresh control only (UX-DR8, FR4); tree remains visible (do **not** swap back to cold-load skeleton); on success update list cache and invalidate detail queries; on failure show muted inline error without crashing shell

5. **And** parse-error files show red badge; expanding reveals `Line {N}: {message}` for each diagnostic (UX-DR17) — errors include text, not color-only (UX-DR22)

6. **And** empty repo shows **"No .http files found. Add one to the repo and refresh."** with Refresh button (UX-DR15, UX-DR24)

7. **And** when Collections tree is focused (UX-DR21, NFR9): `↑`/`↓` move focus among visible rows; `Enter` on a **request** row selects it; `Enter` on a **file** row toggles expand/collapse; `→` expands / `←` collapses a file node

8. **And** switching Collections/History tabs preserves independent search query and scroll position (UX-DR5)

## Tasks / Subtasks

- [x] Task 1: Selection state + data hooks (AC: #2, #4) — AD-10, AD-21
  - [x] 1.1 Create `packages/web/src/types/selection.ts` — `SelectedRequest = { collectionId: string; requestIndex: number; fingerprint: string } | null`
  - [x] 1.2 Lift selection state in `AppLayout.tsx` — `useState<SelectedRequest>`; pass `selectedRequest`, `onSelectRequest`, `onClearSelection` to `SidebarShell` and `WorkspaceShell`
  - [x] 1.3 Create `packages/web/src/hooks/useCollectionDetail.ts` — TanStack Query `useQuery` with `queryKey: ['collection', collectionId]`, `enabled: !!collectionId`, fetches `GET /api/collections/${collectionId}` (POSIX path as-is — do not `encodeURIComponent` the whole id), typed `CollectionDetailDtoType`, pass `signal` to fetch; surface 404 `NOT_FOUND` as query error
  - [x] 1.4 Create `packages/web/src/hooks/useRefreshCollections.ts` — `useMutation` POST `/api/collections/refresh`, typed `CollectionsRefreshResponseType`; on success `queryClient.setQueryData(['collections'], data)` where `data` is the full `{ collections }` envelope (not the array alone) and `invalidateQueries({ queryKey: ['collection'] })`; expose `isPending` for button spinner only
  - [x] 1.5 On select: set selection immediately; detail loads in background — derive displayed request by `requestIndex`, rematch by `fingerprint` if index drifts (AD-21)
  - [x] 1.6 Post-refresh selection (FR4 + AD-21): if selected `collectionId` missing from new list → clear selection; else after detail reloads, if `requestIndex` invalid but `fingerprint` matches another request → update index; if neither matches → clear selection

- [x] Task 2: Sidebar tabs + preserved tab state (AC: #8) — UX-DR5
  - [x] 2.1 Create `packages/web/src/components/SidebarTabs.tsx` — text tabs "Collections" | "History"; active 2px bottom border `border-primary` (`#4990E2`), inactive `text-foreground-muted`; `role="tablist"` / `role="tab"` / `aria-selected`
  - [x] 2.2 Manage tab state in `SidebarShell`: `activeTab: 'collections' | 'history'`, separate `collectionsSearch` / `historySearch`, separate scroll refs — restore scrollTop on tab switch
  - [x] 2.3 Default active tab: Collections on load (EXPERIENCE.md)
  - [x] 2.4 History tab: muted placeholder ("No sent requests yet.") + search input wired to `historySearch` — **no** `GET /api/history` (Story 4.2)

- [x] Task 3: Collections tab chrome — search + refresh (AC: #3, #4, #6) — UX-DR6, UX-DR8, UX-DR22
  - [x] 3.1 Create `packages/web/src/components/SidebarSearch.tsx` — full-width input, `rounded-md` border, placeholder (`Filter collections…` / `Filter history…`), controlled value
  - [x] 3.2 Create `packages/web/src/components/RefreshCollectionsButton.tsx` — secondary (`bg-surface`, `border-border`, `rounded-md`); `aria-label="Refresh collections"`; spinner with `animate-spin` + `motion-reduce:animate-none`; `aria-busy={isPending}`; muted inline error on failure (refresh 500 envelope `REFRESH_FAILED`)
  - [x] 3.3 Place Refresh in Collections tab header (UX-DR8); refreshing must **not** set sidebar back to `SidebarSkeleton`
  - [x] 3.4 Create `packages/web/src/utils/filterCollections.ts` — pure: `(summaries, detailById, search) => filtered tree`. Path match from summary always; request match only if `detailById[id]` exists. File visible if path matches OR any loaded child matches. Auto-expand flag when child matches but path does not. Never trigger fetches inside this util.
  - [x] 3.5 Search does **not** prefetch all details. Optional later enhancement (out of scope unless trivial): prefetch on demand when user types — default is path-only + already-cached requests.

- [x] Task 4: Collection tree UI (AC: #1, #5, #7) — UX-DR7, UX-DR13, UX-DR17, UX-DR21, UX-DR22, NFR9
  - [x] 4.1 Create `packages/web/src/components/MethodBadge.tsx` — visible method **text** (GET, POST, …) + color token background; case-insensitive map; unknown → `bg-foreground-muted`
  - [x] 4.2 Create `packages/web/src/utils/methodColorClass.ts` — `getMethodColorClass(method: string): string`
  - [x] 4.3 Create `packages/web/src/components/CollectionTree.tsx` — scrollable; one row per collection; chevron; file label = `id` in `text-body`, truncate + `title={id}` for long paths (keep 280px sidebar usable at 1280px)
  - [x] 4.4 Lazy-load details on expand (or select); **never** fetch all details on initial list load (NFR1)
  - [x] 4.5 Request rows: `MethodBadge` + truncated URL (`text-body`, `title` = full URL)
  - [x] 4.6 Parse-error file: red badge (`bg-error text-white rounded-sm text-label px-inset-sm`) when `parseStatus === 'error'`; expanded lists `Line {line}: {message}`
  - [x] 4.7 Selected request row: `bg-surface-muted` or primary left border
  - [x] 4.8 Keyboard (canonical): tree `tabIndex={0}`; roving focus; see Keyboard matrix below — implement exactly
  - [x] 4.9 Create `packages/web/src/components/CollectionsEmptyState.tsx` — exact UX-DR24 string + Refresh button

- [x] Task 5: Wire SidebarShell + workspace preview (AC: #2) — FR10
  - [x] 5.1 Update `SidebarShell.tsx` — tabs + tree / History placeholder after success; skeleton **only** for initial `useCollections` `isPending`; keep `isError` **and** `isRefetchError` → `role="alert"` `aria-live="assertive"`; preserve `role="complementary"` / `aria-label="Sidebar"`; do not reintroduce `aria-hidden` on loaded content
  - [x] 5.2 Create `packages/web/src/components/RequestPreview.tsx` — read-only `MethodBadge` + `text-mono` URL
  - [x] 5.3 Update `WorkspaceShell.tsx` — accept selection + resolved `RequestDto | null` + loading/error; preserve resize separator `aria-label="Resize request and response panels"`; placeholder when none selected; muted loading while detail pending; `RequestPreview` when resolved
  - [x] 5.4 Update `AppLayout.tsx` — selection state + `useCollectionDetail(selectedRequest?.collectionId)` + derive active request DTO

- [x] Task 6: Test suite (AC: all)
  - [x] 6.1 `MethodBadge.test.tsx` — GET/POST/unknown colors; badge text content present
  - [x] 6.2 `filterCollections.test.ts` — path match without details; request match only when detail present; empty search shows all; auto-expand flag when child matches
  - [x] 6.3 `CollectionTree.test.tsx` — render files; expand shows requests; click selects; parse error badge + diagnostic text; Enter on file toggles, Enter on request selects
  - [x] 6.4 `SidebarTabs.test.tsx` — tab switch preserves search; Collections default active
  - [x] 6.5 `useRefreshCollections.test.tsx` — `setQueryData` with full `{ collections }` envelope; invalidates `['collection']`; error path
  - [x] 6.6 `useCollectionDetail.test.tsx` — nested path URL (e.g. `http/users.http`) without full encode; AbortSignal
  - [x] 6.7 Update `SidebarShell.test.tsx` — success shows Collections + tree; empty UX-DR24 copy; refresh pending does not remount skeleton; preserve error alert behavior
  - [x] 6.8 Update `App.test.tsx` — select request → mock list + detail → preview replaces placeholder
  - [x] 6.9 Keyboard: ArrowDown to request + Enter selects
  - [x] 6.10 Copy existing `createWrapper()` pattern into new tests (do not require extracting a shared helper)

- [x] Task 7: Workspace verification (AC: all)
  - [x] 7.1 Run `pnpm turbo build test typecheck`
  - [x] 7.2 Manual smoke: `pnpm turbo dev` — browse `demo.http`, expand, select GET, preview appears
  - [x] 7.3 Manual smoke: Refresh after add/remove `.http` updates tree without skeleton flash; open selection rematches or clears correctly
  - [x] 7.4 Manual smoke: `reqor serve .` at :3000 — same-origin API + sidebar

### Review Findings

- [x] [Review][Patch] Cached request search never activates — `detailById` useMemo keyed only on list data, so lazy detail cache updates leave filter path-only [packages/web/src/components/SidebarShell.tsx:41]
- [x] [Review][Patch] Collections tab scroll not preserved — scroll ref on `overflow-hidden` wrapper; real scroller is CollectionTree [packages/web/src/components/SidebarShell.tsx:128]
- [x] [Review][Patch] Arrow keys can focus phantom request rows while detail is loading [packages/web/src/components/CollectionTree.tsx:242]
- [x] [Review][Patch] Auto-expand re-opens files the user just collapsed during an active request-match search [packages/web/src/components/CollectionTree.tsx:56]
- [x] [Review][Patch] Selection highlight uses index only — ignores fingerprint during rematch window [packages/web/src/components/CollectionTree.tsx:145]
- [x] [Review][Patch] Expanded collection detail error stuck on "Loading…" with no recovery UI [packages/web/src/components/CollectionTree.tsx:136]
- [x] [Review][Patch] Non-empty list with zero filter matches renders a blank tree (no empty-filter copy) [packages/web/src/components/SidebarShell.tsx:137]
- [x] [Review][Patch] Workspace prefers stale `activeRequest` over `isDetailError`, masking refetch failures [packages/web/src/components/WorkspaceShell.tsx:25]
- [x] [Review][Patch] Tree container and focused row both use `tabIndex={0}`, creating a duplicate Tab stop [packages/web/src/components/CollectionTree.tsx:322]
- [x] [Review][Patch] Diagnostic list keys collide when two diagnostics share a line number [packages/web/src/components/CollectionTree.tsx:126]
- [x] [Review][Patch] Parse-error file with empty diagnostics expands to blank content [packages/web/src/components/CollectionTree.tsx:120]
- [x] [Review][Patch] SidebarSearch has no accessible name beyond placeholder [packages/web/src/components/SidebarSearch.tsx:9]

## Dev Notes

### Epic Context

Epic 1 delivers UJ-1: developer runs `reqor serve`, browses `.http` collections, sends a request, sees response. Stories 1.1–1.5 built monorepo, parser, REST API, CLI/static serve, and app shell. **Story 1.6 populates the sidebar** (FR10 entry point). Story 1.7 adds Send, proxy, and the interactive request line on this selection.

**In scope:** UX-DR5–DR8, DR13, DR15 (collections empty + existing workspace placeholder), DR17 (parse badge), DR21–DR22 (sidebar keyboard + a11y floor for Refresh/badges), DR24; FR4 UI, FR10 preview; NFR1/3/8/9 as listed below.

**Out of scope / do not implement:** History list/replay or `GET /api/history` (4.2); Send/Save/request line/proxy (1.7); env selector (2.2); editor sub-tabs (Epic 3); response panel content; React Router / URL selection; create-new `.http` UI; drag-and-drop, context menus, global search, box-shadow, Google Fonts (UX-DR25); client `.http` parsing (AD-3); server/shared-types/cli/parser changes unless blocking bug; prefetch-all details; `encodeURIComponent` of full collection id; exotic `%`-encoded filenames (server has a double-encode edge case — ignore for MVP).

### Architecture Compliance (MUST follow)

| AD / NFR | Requirement for 1.6 |
|----------|---------------------|
| AD-2 | All UI in `packages/web`; import `@reqor/shared-types` only — no server imports |
| AD-3 | Never parse `.http` in browser — DTO fields from API only |
| AD-6 | Relative `/api/collections*` URLs only — never call target APIs from browser |
| AD-10 | TanStack Query 5.x for list, detail, refresh; DTO types from `@reqor/shared-types` |
| AD-11 | Refresh = server rescan — web does not scan disk; no auto-watch |
| AD-21 | Selection = `collectionId` + `requestIndex` + `fingerprint`; rematch by fingerprint after refresh |
| NFR1 | No prefetch-all details on load — lazy on expand/select |
| NFR3 | Refresh ≤3s for 100 files assumed — button spinner, no client timeout kill |
| NFR8 | Parse-error files stay in tree with badge |
| NFR9 | Keyboard-navigable collection selection (matrix below) |

### Do Not Regress (from Story 1.5)

- Cold-load `SidebarSkeleton` only for initial `isPending` — never for refresh mutation
- Error path: `isError || isRefetchError` → `role="alert"` + `aria-live="assertive"`
- Sidebar: `role="complementary"` / `aria-label="Sidebar"`; no `aria-hidden` on loaded content
- Workspace resize separator: `aria-label="Resize request and response panels"`
- Layout: `w-sidebar-width` (280px), `min-w-[1280px]`, flat borders (no box-shadow)
- Animations: `motion-reduce:animate-none` on spinner/skeleton
- `useCollections` AbortSignal + query key `['collections']` unchanged

### API Contract (consume only)

| Method | Path | Success | Failure |
|--------|------|---------|---------|
| `GET` | `/api/collections` | `{ collections: CollectionSummaryDto[] }` | Existing list error handling |
| `GET` | `/api/collections/{id}` | `CollectionDetailDto` | `{ error: { code: "NOT_FOUND", message, details: { id } } }` |
| `POST` | `/api/collections/refresh` | `{ collections: CollectionSummaryDto[] }` | `{ error: { code: "REFRESH_FAILED", message } }` |

**DTOs:**  
`CollectionSummaryDto`: `{ id, parseStatus: 'ok'|'error', requestCount, diagnostics[] }`  
`CollectionDetailDto`: `{ id, content, parseStatus, requests: RequestDto[], diagnostics[] }`  
`RequestDto`: `{ requestIndex, fingerprint, method, url, httpVersion?, headers[], body? }` — **no `name` field**; epic “request names” = `method` + `url`  
`DiagnosticDto`: `{ line, message, code? }` — `line` is 1-based

```typescript
// id is POSIX, e.g. "http/users.http" — slashes are path segments
const res = await fetch(`/api/collections/${collectionId}`, { signal })
```

Do **not** `encodeURIComponent` the entire id. Server route is wildcard `GET /api/collections/*`. List order is alphabetical by `id`.

### Layout Structure (after 1.6)

```text
AppShell
└── AppLayout                          # selection state + detail query
    ├── SidebarShell                   # UPDATE
    │   ├── SidebarTabs                # Collections | History
    │   ├── SidebarSearch              # contextual per tab
    │   ├── RefreshCollectionsButton   # Collections tab only
    │   ├── CollectionTree             # or CollectionsEmptyState
    │   └── HistoryPlaceholder         # muted empty (4.2 fills in)
    └── WorkspaceShell                 # UPDATE
        ├── RequestPreview             # when selected
        └── RequestPlaceholder         # when none selected
```

### Current Code State (UPDATE)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `SidebarShell.tsx` | Skeleton + error; empty on success | Tabs + tree + search + refresh |
| `AppLayout.tsx` | Dumb split | Selection state; wire detail query |
| `WorkspaceShell.tsx` | Always RequestPlaceholder | Conditional preview vs placeholder |
| `useCollections.ts` | List query | Unchanged |
| `App.test.tsx` / `SidebarShell.test.tsx` | Shell / skeleton | Selection + tree + empty |

### Method Badge Mapping (UX-DR13 + UX-DR22)

Use `@theme` tokens — never hardcode hex. Badge **must show method text**, not color alone.

| Method | Class |
|--------|-------|
| GET | `bg-method-get` |
| POST | `bg-method-post` |
| PUT | `bg-method-put` |
| PATCH | `bg-method-patch` |
| DELETE | `bg-method-delete` |
| HEAD | `bg-method-head` |
| OPTIONS | `bg-method-options` |
| other | `bg-foreground-muted` |

Style: `text-white text-label rounded-sm px-inset-sm`.

### Search Filter Rules (UX-DR6 + NFR1)

`CollectionSummaryDto` has no request URLs. Required algorithm:

1. Empty query → return all summaries; no auto-expand.
2. Non-empty query → include file if `id` matches (case-insensitive substring).
3. Additionally include file if its **cached** detail has a request where `` `${method} ${url}` `` matches.
4. If included only via request match → mark auto-expand.
5. Do **not** call `fetch` from the filter util; do **not** prefetch every collection when the user types.

### Refresh Mutation Pattern

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CollectionsRefreshResponseType } from '@reqor/shared-types'

export function useRefreshCollections() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ signal }: { signal?: AbortSignal } = {}) => {
      const res = await fetch('/api/collections/refresh', { method: 'POST', signal })
      if (!res.ok) throw new Error('Failed to refresh collections')
      return res.json() as Promise<CollectionsRefreshResponseType>
    },
    onSuccess: (data) => {
      // data = { collections: [...] } — same shape as GET /api/collections
      queryClient.setQueryData(['collections'], data)
      queryClient.invalidateQueries({ queryKey: ['collection'] })
    },
  })
}
```

**Post-refresh (FR4):** newly added files appear; deleted disappear; modified content reloads via detail invalidation. Selection: clear if collection gone; rematch index by fingerprint if drifted; clear if fingerprint gone.

### Workspace Preview Scope (FR10 vs 1.7)

Read-only preview only — method badge + mono URL. No Send, method dropdown, Save, or sub-tabs.

```text
┌─────────────────────────────────────┐
│ [GET]  https://httpbin.dev/get?...  │
│  (remaining area empty/muted)       │
└─────────────────────────────────────┘
```

### Keyboard Navigation (UX-DR21 / NFR9) — canonical matrix

| Key | Focused row | Action |
|-----|-------------|--------|
| `↑` / `↓` | any | Move focus among visible file + request rows |
| `Enter` | **request** | Select that request |
| `Enter` | **file** | Toggle expand/collapse |
| `→` | file (collapsed) | Expand |
| `←` | file (expanded) | Collapse |
| `→` / `←` | request | No-op (optional: →/← bubble to parent file) |

Roving `tabIndex`: focused row `0`, others `-1`. Container handles `keydown`.

### Tab State Preservation (UX-DR5)

```typescript
const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections')
const [collectionsSearch, setCollectionsSearch] = useState('')
const [historySearch, setHistorySearch] = useState('')
const collectionsScrollRef = useRef<HTMLDivElement>(null)
const historyScrollRef = useRef<HTMLDivElement>(null)
const collectionsScrollTop = useRef(0)
const historyScrollTop = useRef(0)
// On tab switch: save outgoing scrollTop, restore incoming
```

### Testing Standards

- Vitest 3.x + RTL; `vi.stubGlobal('fetch', …)`; `createWrapper()` with `QueryClientProvider` + `retry: false` (copy pattern — extraction optional)
- Prefer `getByRole('tab')`, tree/list roles, `getByRole('button', { name: /refresh collections/i })`, `getByPlaceholderText('Filter collections…')`
- Assert nested detail URL uses path segments; assert refresh does not render `data-testid="sidebar-skeleton"`
- No E2E required — smoke on :5173 and :3000

### Project Structure Notes

```text
packages/web/src/
  types/selection.ts
  utils/methodColorClass.ts
  utils/filterCollections.ts
  hooks/useCollections.ts               # unchanged
  hooks/useCollectionDetail.ts          # NEW + test
  hooks/useRefreshCollections.ts        # NEW + test
  components/
    AppLayout.tsx                       # UPDATE
    SidebarShell.tsx                    # UPDATE
    SidebarTabs.tsx                     # NEW
    SidebarSearch.tsx                   # NEW
    RefreshCollectionsButton.tsx        # NEW
    CollectionTree.tsx                  # NEW
    MethodBadge.tsx                     # NEW
    CollectionsEmptyState.tsx           # NEW
    RequestPreview.tsx                  # NEW
    WorkspaceShell.tsx                  # UPDATE
    *.test.tsx                          # NEW/UPDATE as in Task 6
```

### Previous Story Intelligence

**1.5:** AbortSignal + refetch-error alert already wired; skeleton is cold-load only; method color tokens exist; update `SidebarShell.test.tsx` which currently expects empty success aside; `test-setup.ts` stubs `ResizeObserver`.

**1.3:** `id` = repo-relative POSIX path; `parseStatus: 'error'` still listed; diagnostics 1-based; `fingerprint` = SHA-256 of `` `${method}:${url}` ``; detail returns `requests[]` with 0-based `requestIndex`.

### Git Intelligence

- `c81ecf4` — App shell review patches (a11y, reduced-motion, AbortSignal)
- `3b3be69` — Story 1.5 shell + tokens
- `ce1d332` — Story 1.5 ready-for-dev docs
- `8323c30` — Story 1.4 CLI serve / static UI
- `00706df` — Windows shutdown / repo resolution fixes

Patterns: colocated tests, ESM `.js` imports in TS sources, catalog-pinned deps, accessible RTL queries.

### Latest Technical Information

- **TanStack Query ~5.101** (catalog `^5.0.0`) — `enabled` for detail; mutation `setQueryData` + `invalidateQueries`; pass `signal` from `queryFn`
- **React ~19.2** — `useState`/`useRef` for selection; no external state library
- **No React Router** — in-memory selection at `AppLayout`

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.6, UX-DR5–DR8, DR13, DR15, DR17, DR21–DR22, DR24, FR4, FR10, NFR1/3/8/9]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/DESIGN.md` — sidebar, search, tree, badges]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — default tab, refresh, keyboard]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-2, AD-3, AD-6, AD-10, AD-11, AD-21]
- [Source: `_bmad-output/implementation-artifacts/1-5-app-shell-and-design-system-tokens.md`]
- [Source: `_bmad-output/implementation-artifacts/1-3-collection-scan-and-rest-api.md`]
- [Source: `packages/server/src/routes/collections.ts` — wildcard detail route]
- [Source: `packages/shared-types/src/index.ts`]
- [Source: `packages/web/src/components/SidebarShell.tsx`]
- [Source: `demo.http`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Implemented collections sidebar with Collections/History tabs, contextual search, refresh mutation, and lazy-loaded collection tree with keyboard navigation (UX-DR5–DR8, DR13, DR17, DR21–DR22, DR24).
- Lifted selection state to `AppLayout` with fingerprint-based rematch after refresh (AD-21); workspace shows read-only `RequestPreview` (FR10).
- Added TanStack Query hooks for collection detail and refresh; search filter uses cached details only (NFR1).
- 32 web tests + full workspace `pnpm turbo build test typecheck` pass (126 tests total).
- Manual smoke flows (7.2–7.4) covered by integration tests (`App.test`, `SidebarShell.test`, server static-serve tests); recommend browser verification before merge.

### File List

- packages/web/src/types/selection.ts (new)
- packages/web/src/utils/methodColorClass.ts (new)
- packages/web/src/utils/filterCollections.ts (new)
- packages/web/src/utils/filterCollections.test.ts (new)
- packages/web/src/hooks/useCollectionDetail.ts (new)
- packages/web/src/hooks/useCollectionDetail.test.tsx (new)
- packages/web/src/hooks/useRefreshCollections.ts (new)
- packages/web/src/hooks/useRefreshCollections.test.tsx (new)
- packages/web/src/components/MethodBadge.tsx (new)
- packages/web/src/components/MethodBadge.test.tsx (new)
- packages/web/src/components/SidebarTabs.tsx (new)
- packages/web/src/components/SidebarTabs.test.tsx (new)
- packages/web/src/components/SidebarSearch.tsx (new)
- packages/web/src/components/RefreshCollectionsButton.tsx (new)
- packages/web/src/components/CollectionsEmptyState.tsx (new)
- packages/web/src/components/CollectionTree.tsx (new)
- packages/web/src/components/CollectionTree.test.tsx (new)
- packages/web/src/components/RequestPreview.tsx (new)
- packages/web/src/components/AppLayout.tsx (modified)
- packages/web/src/components/SidebarShell.tsx (modified)
- packages/web/src/components/SidebarShell.test.tsx (modified)
- packages/web/src/components/WorkspaceShell.tsx (modified)
- packages/web/src/components/WorkspaceShell.test.tsx (modified)
- packages/web/src/App.test.tsx (modified)
- packages/web/src/test-setup.ts (modified)

## Change Log

- 2026-07-16: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-16: Story context validated — search/NFR1 policy, refresh UX, keyboard matrix, a11y, post-refresh selection, and regression guards locked in
- 2026-07-16: Story 1.6 implemented — collections sidebar, tree navigation, search/refresh, request preview, and test suite
