---
baseline_commit: 0a4654e
---

# Story 2.3: Environment Selection with Persistence

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [x] `GET /api/config` returns persisted `activeEnvironment` (nullable) from `.reqor/config.json`
- [x] `PUT /api/config` validates environment name against loaded `EnvironmentStore`, writes atomically to disk, and returns updated config
- [x] Header environment dropdown reads/writes via config API (not local-only React state); includes blank “Select environment…” that clears to `null`
- [x] Request toolbar shows active environment name when one is persisted **and** still present in the environment list
- [x] Server restart restores previously selected environment in dropdown and toolbar when that name still exists; if the persisted name is missing from the list, show sentinel “Environment unavailable” option, no toolbar label, and do not auto-PUT (blank option still clears to `null`)
- [x] No default-to-first-environment behavior (Story 2.2 local default removed — config/`null` is source of truth)
- [x] `pnpm turbo build test typecheck` passes workspace-wide
- [x] SM-2 fixture gate still ≥45/50 (http-parser untouched / non-regressing)

### Anti-patterns (do not ship)

- Do not resolve `{{host}}`, `{{$dotenv}}`, or other variables at list, preview, or send time (Stories 2.4–2.5)
- Do not load repo `.env` / `.env.local` / `.env.staging` (Story 2.4)
- Do not change `POST /api/execute` behavior or add `environment` to execute request yet (Story 2.5)
- Do not create `.reqor/secrets.env` vault or store secrets in `config.json`
- Do not import `@reqor/http-parser` from `@reqor/web`
- Do not write config from the browser directly — server-only disk mutations (AD-12)
- Do not conflate `.reqor/local.env` (`load-local-env.ts`) with JetBrains env files
- Do not add port/UI prefs beyond `activeEnvironment` unless typed for forward compatibility
- Do not default the header select to the first environment when config is `null`

## Story

As a **developer switching between dev and staging**,
I want my active environment selection to persist across server restarts,
So that I don't re-select staging every time I open Reqor.

## Acceptance Criteria

1. **Given** multiple environments are available  
   **When** I select an environment from the header dropdown (FR14)  
   **Then** the active environment name displays in the request toolbar  
   **And** selection persists to `.reqor/config.json` via server API (AD-23)  
   **And** on server restart the previously selected environment is restored automatically when it still exists in the environment list  
   **And** I can clear the selection via a blank “Select environment…” option that persists `activeEnvironment: null`  
   **And** the header no longer auto-selects the first environment when none is persisted

## Tasks / Subtasks

- [x] Task 1: Shared-types config DTOs (AC: #1) — AD-10, AD-23
  - [x] 1.1 Add to `packages/shared-types/src/index.ts`
  - [x] 1.2 Export Static types: `ConfigDtoType`, `ConfigUpdateRequestType`
  - [x] 1.3 Update `packages/shared-types/src/index.test.ts` export/schema smoke for Config DTOs

- [x] Task 2: Server — config store + routes (AC: #1) — AD-12, AD-23
  - [x] 2.1 Add `packages/server/src/config-store.ts`
  - [x] 2.2 Add `packages/server/src/routes/config.ts`
  - [x] 2.3 Wire in `app.ts`
  - [x] 2.4 Server tests in `packages/server/src/config.test.ts`

- [x] Task 3: Web — config hooks + header persistence (AC: #1) — UX-DR2, AD-23
  - [x] 3.1 Add `packages/web/src/hooks/useConfig.ts`
  - [x] 3.2 Add `useUpdateConfig` in same file
  - [x] 3.3 Refactor `AppHeader.tsx`
  - [x] 3.4 Request toolbar indicator in `RequestLine.tsx` via `AppLayout` → `WorkspaceShell`

- [x] Task 4: Tests & hygiene (AC: all)
  - [x] 4.1 Extend `App.test.tsx` fetch mock router
  - [x] 4.2 Add `RequestLine.test.tsx` case for environment label visibility
  - [x] 4.3 Run `pnpm turbo build test typecheck`

### Review Findings

- [x] [Review][Patch] Require atomic config write (temp in `.reqor/` then rename); remove “prefer simple write” guidance — decided: atomic required
- [x] [Review][Patch] Controlled select for unavailable persisted env: `value=""` + disabled “Environment unavailable”; no toolbar label; no auto-PUT — decided: empty value
- [x] [Review][Patch] Always include blank “Select environment…” option that PUTs `null` — decided: explicit clear
- [x] [Review][Patch] `save()` rewrites known shape only `{ activeEnvironment }`; do not preserve unknown disk keys — decided: rewrite known shape only
- [x] [Review][Patch] Align DoD restart-restore wording with stale-env exception
- [x] [Review][Patch] Fix Project Context citation CAP-8 → CAP-7
- [x] [Review][Patch] Remove non-preferred unavailable-env UI branch; keep only empty select + “Environment unavailable”
- [x] [Review][Patch] Document intentional removal of 2.2 default-to-first-env behavior in AC/DoD / Dev Notes
- [x] [Review][Patch] Specify ConfigStore in-memory default `{ activeEnvironment: null }` before/without load
- [x] [Review][Patch] Specify load coerces wrong types, missing key, and empty string → null
- [x] [Review][Patch] Remove dead `""` → null handler rule (TypeBox String|Null rejects `""`; UI sends null via `value || null`)
- [x] [Review][Patch] Clarify dual `useConfig` ownership: AppHeader for select, AppLayout for toolbar prop (shared query cache)
- [x] [Review][Patch] Specify config/env query error and PUT mutation failure UX
- [x] [Review][Patch] Make Task 4.1 fixture names coherent (one scenario for PUT + toolbar asserts)
- [x] [Review][Defer] Concurrent PUTs / multi-process stale in-memory config — deferred, pre-existing — local single-writer MVP assumed
- [x] [Review][Defer] Whitespace-only and case-insensitive env name matching — deferred, pre-existing — exact name match only for MVP
- [x] [Review][Defer] UTF-8 BOM handling on config.json load — deferred, pre-existing — optional hardening beyond invalid-JSON → null
- [x] [Review][Defer] Disk write failure codes (EACCES/ENOSPC) → typed API error — deferred, pre-existing — follow existing server error patterns when needed
- [x] [Review][Patch] Unavailable env clear: use distinct sentinel option value (not `""`) so “Select environment…” can PUT `null` [packages/web/src/components/AppHeader.tsx:68]
- [x] [Review][Patch] Always load config even when `scanOnStart: false` [packages/server/src/app.ts:31]
- [x] [Review][Patch] Add App test for stale/unavailable env UI (empty select, unavailable option, no toolbar label, no auto-PUT) [packages/web/src/App.test.tsx]
- [x] [Review][Patch] Add App tests for config GET failure and PUT failure alert UX [packages/web/src/App.test.tsx]
- [x] [Review][Patch] Prevent PUT error alert from overflowing fixed `h-header-height` header [packages/web/src/components/AppHeader.tsx:41]
- [x] [Review][Defer] Empty env list leaves orphaned persisted name uncleared (select disabled) [packages/web/src/components/AppHeader.tsx:13] — deferred, pre-existing

## Dev Notes

### Implementation decisions (authoritative)

| Decision | Rule |
|----------|------|
| Config file path | `<repositoryRoot>/.reqor/config.json` — only `activeEnvironment` key in MVP |
| Config JSON shape | `{ "activeEnvironment": "development" }` or `{ "activeEnvironment": null }` |
| Save rewrite | Always rewrite known shape only; unknown disk keys are dropped |
| Atomic write | Temp file in `.reqor/` then `rename` over `config.json` |
| Source of truth | Server `ConfigStore` + TanStack Query `['config']` on web — not header-local `useState` |
| Default selection | No auto-select first env; `null` means none selected until user chooses |
| Clear selection | Blank “Select environment…” option PUTs `null` |
| Validation | PUT rejects unknown environment names with `400 INVALID_ENVIRONMENT` |
| Invalid persisted name | Disabled “Environment unavailable” option with sentinel value; blank “Select environment…” can still PUT `null`; no toolbar label; no silent auto-write |
| Disk writes | Server-only; web never touches `.reqor/` directly |
| Startup order | `environmentStore.loadAll` then `configStore.load` — validation on PUT uses loaded environments |
| Hook ownership | `AppHeader` owns select mutations; `AppLayout` reads config for toolbar prop (shared cache) |
| Toolbar placement | `RequestLine` top row — "Environment: {name}" muted label (UX: active name in request toolbar when set) |
| Execute path | Unchanged — still literal templates until Story 2.5 |

### Epic Context

Epic 2 (UJ-3): developer selects environment, resolves variables/secrets, previews, sends. **Story 2.2** delivered env file parsing, `GET /api/environments`, and header dropdown population (local selection only, defaulted to first). **Story 2.3** adds **persistence, explicit null/clear, and toolbar visibility**, and removes the default-to-first behavior. Stories 2.4–2.5 add `.env` secret resolution and send-time merge/preview.

### Architecture Compliance (MUST follow)

| AD / FR / UX | Requirement for 2.3 |
|--------------|---------------------|
| AD-12 | `.reqor/config.json` is allowed runtime-local artifact; create dir on first write |
| AD-23 | Active environment name persists in config; server loads on start; web reads/writes via API |
| AD-10 | TypeBox DTOs in `@reqor/shared-types`; Fastify validates request/response |
| AD-22 | Web imports DTOs only; no parser types |
| FR14 | Select active environment; persists across restarts; name visible in request toolbar |
| UX-DR2 | Header retains environment selector; toolbar shows active name when set (EXPERIENCE.md) |
| NFR6 | Config contains environment **names** only — never secret values |

### Scope Boundaries

**In scope:** config store; `GET/PUT /api/config`; header dropdown wired to API; blank clear option; request toolbar environment label; restart restore (with stale-name exception); validation against known environment names; atomic config write.

**Out of scope / do not implement:**
- Resolve variables or secrets → **Stories 2.4–2.5**
- Pass `activeEnvironment` to `POST /api/execute` → **Story 2.5**
- Pre-send preview, Send disabled on unresolved vars → **Story 2.5**
- Port preference or other UI prefs in config → future (MVP writes known shape only; new keys require a later story)
- Re-scan env files on config change
- History recording environment name → **Epic 4**
- CLI changes to create `config.json` on bootstrap — server creates on first PUT (bootstrap still only creates `.reqor/` dir per Story 1.4)
- Preserving unknown keys already present in `config.json`

### Current Code State (UPDATE)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/web/src/components/AppHeader.tsx` | Local `useState` for selected env; defaults to first env | **UPDATE** — use config API as source of truth; remove default-to-first; blank clear option |
| `packages/web/src/hooks/useEnvironments.ts` | `GET /api/environments` query | **UNCHANGED** (still lists options) |
| `packages/web/src/components/RequestLine.tsx` | Method, URL, Send, Save, follow redirects | **UPDATE** — optional environment label row |
| `packages/web/src/components/WorkspaceShell.tsx` | Passes props to RequestLine | **UPDATE** — pass `activeEnvironment` prop |
| `packages/web/src/components/AppLayout.tsx` | Workspace orchestration | **UPDATE** — read config, pass active name down |
| `packages/server/src/environment-store.ts` | Parsed env AST + redacted list | **READ ONLY** — validate names on PUT |
| `packages/server/src/app.ts` | Registers env + collection routes | **UPDATE** — config store load + routes |
| `packages/server/src/routes/environments.ts` | `GET /api/environments` | **UNCHANGED** |
| `packages/server/src/routes/execute.ts` | Literal proxy | **Do not modify** |
| `packages/shared-types/src/index.ts` | Environment DTOs from 2.2 | **UPDATE** — Config DTOs |
| `packages/cli/src/bootstrap-reqor-dir.ts` | Creates `.reqor/` dir only | **UNCHANGED** |

### Suggested API Shapes

**GET /api/config** (200):

```json
{ "activeEnvironment": "development" }
```

**GET /api/config** when never set (200):

```json
{ "activeEnvironment": null }
```

**PUT /api/config**:

```json
{ "activeEnvironment": "staging" }
```

**PUT /api/config** (400):

```json
{
  "error": {
    "code": "INVALID_ENVIRONMENT",
    "message": "Environment not found",
    "details": { "name": "unknown" }
  }
}
```

**`.reqor/config.json` on disk:**

```json
{
  "activeEnvironment": "staging"
}
```

### File Structure Requirements

```text
packages/shared-types/src/
  index.ts               # UPDATE — ConfigDto, ConfigUpdateRequest
  index.test.ts          # UPDATE — smoke

packages/server/src/
  config-store.ts        # NEW
  config.test.ts         # NEW
  routes/config.ts       # NEW
  app.ts                 # UPDATE — load + register

packages/web/src/
  hooks/useConfig.ts           # NEW
  hooks/useUpdateConfig.ts     # NEW (or combined with useConfig)
  components/AppHeader.tsx     # UPDATE — API-backed selection
  components/AppLayout.tsx     # UPDATE — pass activeEnvironment
  components/WorkspaceShell.tsx # UPDATE — prop threading
  components/RequestLine.tsx   # UPDATE — toolbar label
  components/RequestLine.test.tsx # UPDATE
  App.test.tsx                 # UPDATE — config mock + assertions
```

### Previous Story Intelligence (2.2)

- `EnvironmentStore.list()` returns redacted DTOs; `get(name)` returns internal AST — use **name existence** via `get(name)` or list names for validation
- Header select already handles loading/error/empty; extend fetch mock pattern in tests — **one** `vi.fn().mockImplementation((url) => …)` router
- Do not return plaintext secrets from any API — config stores **names only**
- Env load is server-start only; config load should also be server-start + PUT updates
- Review patches from 2.2: resilient file reads, BOM handling, controlled select value during load — apply same care to config-backed select (avoid empty controlled value flicker while config pending)
- `SECRET_MASK` / redaction unchanged — not used in this story
- Story 2.2 defaulted select to first env — **remove** that behavior in 2.3

### Git Intelligence

- `0a4654e` — Story 2.2: env parsing, `GET /api/environments`, header dropdown (local state)
- `1c30d68` — Story 2.1: variable scanner (execute still literal)
- Patterns to copy: Fastify plugin-options routes; TypeBox from shared-types; TanStack Query + mutation with cache update (`useQueryClient`); `app.inject` temp-dir tests; ESM `.js` imports; colocated Vitest

### Latest Technical Information

- TanStack Query 5: use `useQueryClient()` + `queryClient.setQueryData` on mutation success for instant UI sync
- Fastify 5 + TypeBox: PUT body validation via schema `body: ConfigUpdateRequest`
- Node `fs.promises` **atomic write required**: write temp file in the same `.reqor/` directory, then `fs.rename` over `config.json`
- Stack locked: TypeScript 5.9, Fastify 5, React 19, TanStack Query 5, Vitest 3, Node `>=24 <25`

### Testing Standards

- Vitest 3.x colocated tests; ESM `.js` suffix imports
- Server: `app.inject` + temp repository roots; verify disk file contents after PUT (known shape only)
- Restart test pattern: build app → PUT config → create **new** app instance with same root → GET config matches
- Web: extend existing fetch URL router in `App.test.tsx`; do not add second global fetch stub
- Full gate: `pnpm turbo build test typecheck`

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.3, FR14]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/prd.md` — FR-14]
- [Source: `_bmad-output/specs/spec-reqor/SPEC.md` — CAP-7 active environment persistence]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-12, AD-23]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — §7 `.reqor/config.json`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — Environment selector + request toolbar]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/DESIGN.md` — UX-DR2 header layout]
- [Source: `_bmad-output/implementation-artifacts/2-2-environment-file-parsing-and-listing.md`]
- [Source: `packages/server/src/environment-store.ts`, `routes/environments.ts`, `app.ts`]
- [Source: `packages/web/src/components/AppHeader.tsx`, `hooks/useEnvironments.ts`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added `ConfigDto` / `ConfigUpdateRequest` TypeBox schemas with `minLength: 1` on string branch so empty names are rejected at validation.
- Implemented `ConfigStore` with resilient load coercion, atomic temp-file write, and known-shape-only disk rewrite.
- Wired `GET/PUT /api/config` with `INVALID_ENVIRONMENT` validation against `EnvironmentStore`.
- Refactored header dropdown to TanStack Query config hooks; removed Story 2.2 default-to-first-env behavior; added clear and unavailable states.
- Added request toolbar environment label via `AppLayout` → `WorkspaceShell` → `RequestLine`.
- All workspace tests pass (`pnpm turbo build test typecheck`); http-parser fixture gate unchanged (75 tests).

### File List

- packages/shared-types/src/index.ts
- packages/shared-types/src/index.test.ts
- packages/server/src/config-store.ts
- packages/server/src/config.test.ts
- packages/server/src/routes/config.ts
- packages/server/src/app.ts
- packages/web/src/hooks/useConfig.ts
- packages/web/src/components/AppHeader.tsx
- packages/web/src/components/AppLayout.tsx
- packages/web/src/components/WorkspaceShell.tsx
- packages/web/src/components/WorkspaceShell.test.tsx
- packages/web/src/components/RequestLine.tsx
- packages/web/src/components/RequestLine.test.tsx
- packages/web/src/App.test.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-17: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-17: Code review patches applied — atomic write, select/clear UX, load coercion, ownership, CAP-7 citation, coherent tests
- 2026-07-17: Story 2.3 implemented — config API persistence, header dropdown wired to server, toolbar environment label
