---
baseline_commit: 8323c30
---

# Story 1.5: App Shell and Design System Tokens

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

Verify all of the following before marking done:

- [x] `pnpm --filter @reqor/web build` succeeds with Tailwind v4 + design tokens
- [x] Built CSS lands in `packages/web/dist/assets/` and is copied into `packages/cli/web-dist/` via `copy-web-dist.mjs` (Story 1.4 packaging)
- [x] `pnpm --filter @reqor/web test` and `pnpm turbo typecheck` pass (no regressions from Stories 1.1–1.4)
- [x] `pnpm turbo build test typecheck` pass workspace-wide
- [x] Opening `http://localhost:3000` (via `reqor serve` or `pnpm turbo dev` + built preview) shows Swagger-inspired app shell within 2s on localhost (NFR1)
- [x] Header is 48px `#1B1B1B` with "Reqor" left-aligned only — no menu, search, env selector, sign-in, or notifications
- [x] Three-pane layout at 1280px min: 280px sidebar + main workspace with resizable request/response split (default 50/50)
- [x] Flat elevation only — 1px borders, no box shadows
- [x] Cold load: 4–6 sidebar skeleton rows while `GET /api/collections` pending; workspace shows "Select a request" placeholder
- [x] After collections load, skeleton clears; sidebar shows empty shell (no collection tree yet — Story 1.6)
- [x] No collection tree, search, refresh, request line, Send/Save, proxy, or environment selector (Stories 1.6–1.7, Epic 2)
- [x] UX-DR25 absences held: no create-new `.http` UI, drag-and-drop reorder, right-click context menus, or history infinite scroll

## Story

As a **developer using Reqor in the browser**,
I want a Swagger-inspired app shell with consistent design tokens,
So that the UI feels like a professional developer tool with minimal chrome.

## Acceptance Criteria

1. **Given** I open `http://localhost:3000`  
   **When** the app loads  
   **Then** initial render completes within 2 seconds on localhost (NFR1)

2. **And** UX-DR1: Swagger palette, typography (body 14px, label 12px semibold uppercase + 0.02em tracking, mono 13px, app-title 16px), spacing (header 48px, sidebar 280px, panel-gap 0, inset 12px, inset-sm 8px), rounded corners (sm 2px, md 4px, lg 6px) implemented as CSS/Tailwind variables per **every** `DESIGN.md` frontmatter token

3. **And** UX-DR2: 48px dark header (`#1B1B1B`) shows "Reqor" left-aligned only — no menu, search, sign-in, notifications, or environment selector (env selector deferred to Story 2.2)

4. **And** UX-DR3: fixed three-pane layout at 1280px minimum — 280px sidebar, main workspace with request/response vertical split

5. **And** UX-DR4: resizable split with drag handle defaulting to 50/50

6. **And** UX-DR23: flat elevation — borders only, no shadows; modal overlay pattern defined as a `:root` CSS variable (for later stories)

7. **And** UX-DR25 absences enforced: no global search, bottom status bar, RHS rail, notifications, account flows, dark mode, create-new `.http` UI, drag-and-drop reorder, right-click context menus, or history infinite scroll

8. **And** UX-DR16: cold load shows 4–6 skeleton rows in sidebar and "Select a request" placeholder until `GET /api/collections` returns

## Tasks / Subtasks

- [x] Task 1: Add Tailwind CSS v4 + design token foundation (AC: #2, #6, #7) — UX-DR1, UX-DR23
  - [x] 1.1 Add to pnpm `catalog:` with pinned ranges: `tailwindcss: ^4.0.0`, `@tailwindcss/vite: ^4.0.0`, `react-resizable-panels: ^4.0.0`
  - [x] 1.2 Install deps in `@reqor/web`: runtime `react-resizable-panels` (catalog); dev `tailwindcss`, `@tailwindcss/vite` (catalog)
  - [x] 1.3 Create `packages/web/src/styles/index.css` with `@import "tailwindcss"` and `@theme { ... }` mapping **every** DESIGN.md frontmatter color, typography, spacing, and rounded token (see token table below — no omissions)
  - [x] 1.4 Map tokens to Tailwind v4 `@theme` using `--color-*`, `--font-*`, `--spacing-*`, `--radius-*` (e.g. `--color-header-background: #1B1B1B`, `--spacing-header-height: 48px`, `--spacing-sidebar-width: 280px`)
  - [x] 1.5 Add `@layer components` typography roles matching DESIGN.md exactly:
    - `.text-body` — 14px / 400 / line-height 1.5 / system sans stack
    - `.text-label` — 12px / 600 / uppercase / letter-spacing 0.02em / line-height 1.4
    - `.text-mono` — 13px / 400 / mono stack / line-height 1.5
    - `.text-app-title` — 16px / 600 / line-height 1.2 / system sans stack
  - [x] 1.6 Define overlay on `:root` (not `@theme` — must not generate `bg-overlay` utilities): `--color-overlay: rgba(0, 0, 0, 0.4)`. No shadow utilities anywhere in MVP shell
  - [x] 1.7 Update `vite.config.ts`: add `@tailwindcss/vite` **alongside** `@vitejs/plugin-react` (order: react first, then tailwind)
  - [x] 1.8 Update `vitest.config.ts`: add `@tailwindcss/vite` the same way so CSS imports resolve under Vitest/jsdom
  - [x] 1.9 Import `./styles/index.css` from `main.tsx`
  - [x] 1.10 Set `index.html` `<body>` classes to `min-h-screen overflow-hidden` (`lang="en"` already present — do not change)

- [x] Task 2: Build app shell layout components (AC: #3, #4, #5, #7) — UX-DR2, UX-DR3, UX-DR4, UX-DR25
  - [x] 2.1 Create `packages/web/src/components/AppShell.tsx` — root flex column `h-screen overflow-hidden`
  - [x] 2.2 Create `packages/web/src/components/AppHeader.tsx` — fixed 48px bar, `bg-header-background text-header-foreground`, "Reqor" with `text-app-title` left-aligned; expose accessible name (e.g. `role="banner"` + text, or `h1`); **no right-side controls**
  - [x] 2.3 Create `packages/web/src/components/AppLayout.tsx` — horizontal flex: sidebar (280px fixed) + main (flex-1 min-w-0)
  - [x] 2.4 Create `packages/web/src/components/SidebarShell.tsx` — bordered right edge, `bg-surface`, full height; hosts skeleton or future tab content (Story 1.6). For 1.5: skeleton rows OR empty muted area after load — **no Collections|History tabs yet**. Mark sidebar with an accessible region (e.g. `role="complementary"` or `aria-label="Sidebar"`)
  - [x] 2.5 Create `packages/web/src/components/WorkspaceShell.tsx` — vertical `Group` from `react-resizable-panels` v4:
    - Top panel: Request workspace placeholder ("Select a request")
    - Bottom panel: Response workspace placeholder (empty/muted)
    - `Separator` between panels — 1px border, no shadow; default 50/50
  - [x] 2.6 Enforce `min-w-[1280px]` on shell root OR `min-width: 1280px` on outer container per UX-DR3
  - [x] 2.7 Replace health-check demo UI in `App.tsx` with `<AppShell />` composition

- [x] Task 3: Cold-load skeleton + collections fetch (AC: #8) — UX-DR16, AD-10
  - [x] 3.1 Create `packages/web/src/hooks/useCollections.ts` — TanStack Query `useQuery` for `GET /api/collections`, typed with `CollectionsListResponseType` from `@reqor/shared-types` (already exported — do not duplicate or change shared-types)
  - [x] 3.2 Create `packages/web/src/components/SidebarSkeleton.tsx` — 4–6 animated/muted skeleton rows using `surface-muted` + `rounded-sm`; no third-party skeleton lib
  - [x] 3.3 Create `packages/web/src/components/RequestPlaceholder.tsx` — centered `foreground-muted` text: "Select a request"
  - [x] 3.4 Wire loading state: `isPending` → sidebar skeleton + request placeholder; `isSuccess` → clear skeleton, keep request placeholder (tree UI is Story 1.6)
  - [x] 3.5 On fetch error: show muted inline error in sidebar ("Could not load collections") — do not crash shell; health endpoint failure is separate concern
  - [x] 3.6 Remove direct `fetch('/api/health')` from App — health check no longer user-visible (server still serves endpoint)

- [x] Task 4: Test suite (AC: all)
  - [x] 4.1 Update `App.test.tsx` — render AppShell; assert "Reqor" via accessible query (prefer `getByRole('banner')` / heading — not the old health-demo `h1`-only assumption), "Select a request" placeholder, sidebar region present
  - [x] 4.2 `SidebarSkeleton.test.tsx` — renders 4–6 skeleton elements
  - [x] 4.3 `useCollections.test.ts` or integration test with `vi.stubGlobal('fetch', ...)` / mock — loading → success transitions skeleton away
  - [x] 4.4 Optional: test resizable panels render both request/response regions (smoke only — no drag simulation required)
  - [x] 4.5 Manual smoke: `pnpm turbo dev` → shell at :5173; `pnpm turbo build && node packages/cli/dist/index.js serve .` → shell at :3000 with CSS loaded (no unstyled header)

- [x] Task 5: Workspace verification (AC: all)
  - [x] 5.1 Run `pnpm turbo build test typecheck`
  - [x] 5.2 Confirm Story 1.4 static serve + API still works from same origin
  - [x] 5.3 Confirm `packages/cli/web-dist/assets/` contains the Tailwind-built CSS after build + copy-web-dist

## Dev Notes

### Epic Context

Epic 1 delivers UJ-1: developer runs `reqor serve`, browses `.http` collections, sends a request, sees response. Stories 1.1–1.4 built monorepo, parser, collection REST API, and prod-like CLI entrypoint. **Story 1.5 is the UI foundation** — Swagger-inspired shell, design tokens, and three-pane layout. Stories 1.6–1.7 populate sidebar navigation and proxy execution on this substrate.

**In scope:** UX-DR1, UX-DR2 (title only), UX-DR3, UX-DR4, UX-DR16, UX-DR23, UX-DR25; NFR1 initial load.

**Out of scope:** Environment selector (2.2), Collections|History tabs + tree (1.6), search/refresh (1.6), request line + Send/Save (1.7), response viewer (1.7), editor tabs (Epic 3), modals/popovers (Epic 5).

### Architecture Compliance (MUST follow)

| AD / NFR | Requirement for 1.5 |
|----------|---------------------|
| AD-2 | All UI work stays in `packages/web`; no server changes unless tests require fixture — web depends on `@reqor/shared-types` only |
| AD-6 | Fetch `/api/collections` via relative URL — works on :5173 (Vite proxy) and :3000 (static serve) |
| AD-10 | TanStack Query 5.x for server state; import DTO types from `@reqor/shared-types` — never duplicate API shapes |
| NFR1 | Shell paints within 2s — avoid heavy deps; lazy-load nothing critical for first paint |
| UX-DR1 | DESIGN.md frontmatter is authoritative for token values |
| UX-DR25 | Explicit absences — do not add features "for later" beyond placeholder regions |

### Design Token Mapping (DESIGN.md → Tailwind v4 @theme)

Implement tokens in `packages/web/src/styles/index.css`. **DESIGN.md wins over `stitch-reference.html`** on any conflict (reference uses wrong header color `#2e3132`, Google Fonts, and rejected MVP chrome).

**Colors — all required in `@theme`:**

| DESIGN.md token | @theme variable | Value |
|-----------------|-----------------|-------|
| `header-background` | `--color-header-background` | `#1B1B1B` |
| `header-foreground` | `--color-header-foreground` | `#FFFFFF` |
| `background` | `--color-background` | `#FFFFFF` |
| `surface` | `--color-surface` | `#FAFAFA` |
| `surface-muted` | `--color-surface-muted` | `#F0F0F0` |
| `foreground` | `--color-foreground` | `#3B4151` |
| `foreground-muted` | `--color-foreground-muted` | `#777777` |
| `border` | `--color-border` | `#D8DDE7` |
| `border-subtle` | `--color-border-subtle` | `#E8E8E8` |
| `primary` | `--color-primary` | `#4990E2` |
| `primary-foreground` | `--color-primary-foreground` | `#FFFFFF` |
| `method-get` | `--color-method-get` | `#61AFFE` |
| `method-post` | `--color-method-post` | `#49CC90` |
| `method-put` | `--color-method-put` | `#FCA130` |
| `method-patch` | `--color-method-patch` | `#50E3C2` |
| `method-delete` | `--color-method-delete` | `#F93E3E` |
| `method-head` | `--color-method-head` | `#9012FE` |
| `method-options` | `--color-method-options` | `#0D5AA7` |
| `success` | `--color-success` | `#49CC90` |
| `warning` | `--color-warning` | `#FCA130` |
| `error` | `--color-error` | `#F93E3E` |
| `secret-masked` | `--color-secret-masked` | `#C4C4C4` |

**Spacing / radius — all required in `@theme`:**

| DESIGN.md token | @theme variable | Value |
|-----------------|-----------------|-------|
| `header-height` | `--spacing-header-height` | `48px` |
| `sidebar-width` | `--spacing-sidebar-width` | `280px` |
| `panel-gap` | `--spacing-panel-gap` | `0px` |
| `inset` | `--spacing-inset` | `12px` |
| `inset-sm` | `--spacing-inset-sm` | `8px` |
| `rounded.sm` | `--radius-sm` | `2px` |
| `rounded.md` | `--radius-md` | `4px` |
| `rounded.lg` | `--radius-lg` | `6px` |

**Typography stacks (use in `.text-*` roles / `--font-*`):**

| Role | fontFamily | size | weight | lineHeight | other |
|------|------------|------|--------|------------|-------|
| body | `system-ui, -apple-system, Segoe UI, Roboto, sans-serif` | 14px | 400 | 1.5 | — |
| label | same system stack | 12px | 600 | 1.4 | `uppercase`; `letter-spacing: 0.02em` |
| mono | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | 13px | 400 | 1.5 | — |
| app-title | system stack | 16px | 600 | 1.2 | — |

**Overlay (`:root` only, not `@theme`):** `--color-overlay: rgba(0, 0, 0, 0.4)`

**`components:` block in DESIGN.md** — compositional references only; do not invent extra CSS variables for every component key in 1.5. Colors/spacing/typography/radius above are mandatory.

**Typography rule:** System fonts only — **no Google Fonts, no Material Icons**.

### Layout Structure

```text
AppShell (h-screen flex flex-col min-w-[1280px])
├── AppHeader (h-[48px] shrink-0, role=banner)
└── AppLayout (flex flex-1 min-h-0)
    ├── SidebarShell (w-[280px] shrink-0 border-r)
    │   └── SidebarSkeleton | empty shell
    └── WorkspaceShell (flex-1 min-w-0)
        └── Group (orientation=vertical)   # react-resizable-panels v4
            ├── RequestPanel → RequestPlaceholder
            ├── Separator (1px border)
            └── ResponsePanel → empty muted placeholder
```

Pane gaps: **0** (`panel-gap`) — separation via 1px `border-border` only (UX-DR3, UX-DR23).

### Current Code State (UPDATE, not NEW)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/web/src/App.tsx` | Health-check demo with h1 + fetch | Composes AppShell; removes visible health UI |
| `packages/web/src/main.tsx` | QueryClientProvider only | Import global CSS |
| `packages/web/vite.config.ts` | React plugin + API proxy | Add `@tailwindcss/vite` plugin |
| `packages/web/vitest.config.ts` | React plugin only | Add `@tailwindcss/vite` plugin |
| `packages/web/package.json` | React, TanStack Query, Vite | Add Tailwind + react-resizable-panels |
| `packages/web/index.html` | `lang="en"` already set; bare body | Body: `min-h-screen overflow-hidden` |
| `packages/web/src/App.test.tsx` | Asserts "Reqor" heading (health demo) | Asserts shell structure + accessible header/sidebar |
| `pnpm-workspace.yaml` | No Tailwind / panels in catalog | Add catalog pins from Task 1.1 |

**Folders that do not exist yet:** `packages/web/src/components/`, `hooks/`, `styles/` — all NEW.

**Do NOT modify:** `packages/server/*`, `packages/cli/*` (except verifying `web-dist` output after build), collection scan logic, parser, shared-types schemas.

### Resizable Split Implementation

Use **`react-resizable-panels` v4** (`^4.0.0` in catalog). v4 renamed APIs — do **not** use v3 names (`PanelGroup`, `PanelResizeHandle`, `direction`):

```tsx
import { Group, Panel, Separator } from 'react-resizable-panels'

<Group orientation="vertical" className="flex-1">
  <Panel defaultSize={50} minSize={20}>
    <RequestPlaceholder />
  </Panel>
  <Separator className="h-px bg-border" />
  <Panel defaultSize={50} minSize={20}>
    <div className="h-full bg-surface" /> {/* empty response shell */}
  </Panel>
</Group>
```

**Anti-pattern:** Do not use CSS `resize` on divs. Do not install v3 APIs against a v4 package (or vice versa).

### Collections Fetch (Cold Load Only)

Story 1.5 uses collections API **only** to drive loading → loaded transition (UX-DR16). Do not render collection tree, file nodes, or request badges — Story 1.6 owns UX-DR5–DR8.

```tsx
// useCollections.ts pattern
import { useQuery } from '@tanstack/react-query'
import type { CollectionsListResponseType } from '@reqor/shared-types'

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async (): Promise<CollectionsListResponseType> => {
      const res = await fetch('/api/collections')
      if (!res.ok) throw new Error('Failed to load collections')
      return res.json()
    },
  })
}
```

After success, sidebar can show empty `bg-surface` — data is prefetched for 1.6 but not displayed yet.

### Header Scope Clarification (UX-DR2 vs Epic AC)

Epic 1.5 AC says header shows **"Reqor" left-aligned only**. Full UX-DR2 includes environment selector on the right — that ships in **Story 2.2** when `GET /api/environments` exists. Do not add a disabled/stub env dropdown in 1.5.

### Testing Standards

- **Framework:** Vitest 3.x + React Testing Library (existing)
- **CSS in tests:** `vitest.config.ts` must include `@tailwindcss/vite` so `main.tsx` CSS import does not break the suite
- **Fetch mocking:** `vi.stubGlobal('fetch', ...)` or mock `useCollections` — avoid live server in unit tests
- **Header assertion:** Prefer banner/heading accessible queries; do not assume the old health-demo `<h1>` remains
- **No E2E required** for 1.5 — manual smoke sufficient (dev :5173 **and** prod-like :3000 via CLI)
- **CI:** `pnpm turbo test` must include updated App tests

### Anti-Patterns (do NOT do)

- Do not copy colors/fonts from `stitch-reference.html` — use DESIGN.md (`#1B1B1B` header, not `#2e3132`)
- Do not add Google Fonts or icon font libraries
- Do not implement Collections|History tabs, search, refresh, or tree (Story 1.6)
- Do not add request line, Send, Save, method badges in workspace (Story 1.7)
- Do not add `box-shadow` utilities anywhere in shell
- Do not put overlay on `@theme` (use `:root` only)
- Do not add dark mode toggle (UX-DR25)
- Do not add global top search, bottom status bar, or RHS utility rail
- Do not add create-new `.http` UI, drag-and-drop reorder, right-click context menus, or history infinite scroll (UX-DR25)
- Do not parse `.http` files in browser (AD-3)
- Do not change server routes or static serve behavior from Story 1.4
- Do not break `pnpm turbo dev` Vite proxy workflow
- Do not omit DESIGN.md frontmatter colors/spacing (including unused method/semantic colors and `panel-gap` / `inset-sm`)

### Project Structure Notes

```text
packages/web/
  src/
    components/
      AppShell.tsx              # NEW
      AppHeader.tsx             # NEW
      AppLayout.tsx             # NEW
      SidebarShell.tsx          # NEW
      SidebarSkeleton.tsx       # NEW
      WorkspaceShell.tsx        # NEW
      RequestPlaceholder.tsx    # NEW
    hooks/
      useCollections.ts         # NEW
    styles/
      index.css                 # NEW — @theme tokens + :root overlay
    App.tsx                     # UPDATE — shell composition
    App.test.tsx                # UPDATE
    main.tsx                    # UPDATE — import CSS
  vite.config.ts                # UPDATE — tailwind plugin
  vitest.config.ts              # UPDATE — tailwind plugin
  package.json                  # UPDATE — deps
  index.html                    # UPDATE — body classes only
pnpm-workspace.yaml             # UPDATE — catalog entries
```

### Previous Story Intelligence (1.4)

- Static SPA served from `:3000` via `@fastify/static` + SPA fallback — shell must work in prod-like mode, not only Vite dev
- Dev matrix: Vite `:5173` proxies `/api` → `:3000`; prod-like: same-origin static + API on `:3000`
- TanStack Query already wired in `main.tsx` — reuse QueryClientProvider
- Vite proxy `/api` → `:3000` unchanged — collections fetch uses relative `/api/collections`
- `App.tsx` currently fetches `/api/health` — remove user-visible health demo; shell replaces it (1.4 DoD smoke text no longer applies)
- CLI `copy-web-dist.mjs` copies `packages/web/dist` → `packages/cli/web-dist/` — Tailwind CSS must appear in built assets or prod serve regresses to unstyled HTML
- Turbo outputs `web-dist/**` — verify after `pnpm turbo build`
- Review pattern: colocated tests, ESM `.js` imports in TS sources, pure components testable in isolation

### Previous Story Intelligence (1.3)

- `GET /api/collections` returns `{ collections: CollectionSummaryDto[] }` — use for loading state
- `CollectionsListResponseType` already exported from `@reqor/shared-types` — import only
- Collection id is repo-relative POSIX path — not needed for display in 1.5
- Parse errors per file do not block list — 1.6 handles error badges
- `ApiErrorEnvelopeType` exists if richer error parsing is desired; muted string is enough for 1.5

### Git Intelligence

Recent commits:

- `8323c30` — Story 1.4: CLI serve, static Web UI, `.reqor/` bootstrap, web-dist packaging
- `00706df` — Windows shutdown, repository resolution, local env
- `075f152` — Collection REST API

Patterns: incremental story delivery in `packages/web`, minimal cross-package changes, Vitest colocated tests, catalog-pinned deps.

### Latest Technical Information

- **Tailwind CSS v4** — `tailwindcss` + `@tailwindcss/vite` at `^4.0.0`; no `tailwind.config.js` or PostCSS. Tokens live in CSS `@theme { }` at top level. Use `:root` for variables that must not generate utilities (overlay). Peer supports Vite 6.x. `@reqor/web` is `"type": "module"`.
- **@tailwindcss/vite** — add to both `vite.config.ts` and `vitest.config.ts`; CSS entry uses `@import "tailwindcss"`.
- **react-resizable-panels v4** — catalog `^4.0.0`. API: `Group` + `orientation`, `Panel`, `Separator` (not v3 `PanelGroup` / `PanelResizeHandle` / `direction`). Supports React 19.
- **React 19 + Vite 6** — SPA only; no SSR concerns.

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.5, UX-DR1–DR4, DR16, DR23, DR25]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/DESIGN.md` — full frontmatter tokens + layout]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — cold load state pattern]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-2, AD-10, web package role]
- [Source: `_bmad-output/implementation-artifacts/1-4-cli-start-and-web-ui-static-serve.md` — static serve + web-dist packaging]
- [Source: `packages/web/src/App.tsx` — current health-check placeholder]
- [Source: `packages/web/vitest.config.ts` — needs Tailwind plugin parity with Vite]
- [Source: `packages/shared-types/src/index.ts` — `CollectionsListResponseType`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- jsdom lacks `ResizeObserver`; added `packages/web/src/test-setup.ts` stub so `react-resizable-panels` Group mounts under Vitest
- `useCollections` hook tests needed `.tsx` extension for JSX in QueryClientProvider wrapper

### Completion Notes List

- Tailwind v4 + `@tailwindcss/vite` wired in Vite and Vitest; all DESIGN.md color/spacing/radius tokens in `@theme`; overlay on `:root` only
- App shell: 48px header ("Reqor" only), 280px sidebar, vertical 50/50 resizable request/response split (`Group`/`Panel`/`Separator`), `min-w-[1280px]`, flat borders only
- Cold load via `useCollections` → 5 skeleton rows while pending; empty sidebar on success; muted error on failure; "Select a request" placeholder always in request pane
- Removed health-check demo from `App.tsx`
- Tests: App shell a11y, SidebarSkeleton count, SidebarShell load/error transitions, useCollections hook, WorkspaceShell regions
- `pnpm turbo build test typecheck` passed; Tailwind CSS present in `packages/cli/web-dist/assets/`

### File List

- pnpm-workspace.yaml
- pnpm-lock.yaml
- packages/web/package.json
- packages/web/index.html
- packages/web/vite.config.ts
- packages/web/vitest.config.ts
- packages/web/src/main.tsx
- packages/web/src/App.tsx
- packages/web/src/App.test.tsx
- packages/web/src/styles/index.css
- packages/web/src/test-setup.ts
- packages/web/src/hooks/useCollections.ts
- packages/web/src/hooks/useCollections.test.tsx
- packages/web/src/components/AppShell.tsx
- packages/web/src/components/AppHeader.tsx
- packages/web/src/components/AppLayout.tsx
- packages/web/src/components/SidebarShell.tsx
- packages/web/src/components/SidebarShell.test.tsx
- packages/web/src/components/SidebarSkeleton.tsx
- packages/web/src/components/SidebarSkeleton.test.tsx
- packages/web/src/components/WorkspaceShell.tsx
- packages/web/src/components/WorkspaceShell.test.tsx
- packages/web/src/components/RequestPlaceholder.tsx
- _bmad-output/implementation-artifacts/1-5-app-shell-and-design-system-tokens.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-15: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-15: Validation pass — v4 panels API, full DESIGN.md tokens, Vitest/Tailwind parity, web-dist smoke, UX-DR25 completeness
- 2026-07-15: Implemented Story 1.5 — Tailwind v4 design tokens, Swagger-inspired app shell, cold-load skeleton, tests; status → review
