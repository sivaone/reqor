---
baseline_commit: 1c30d68
---

# Story 2.2: Environment File Parsing and Listing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [x] `@reqor/http-parser` parses JetBrains `http-client.env.json` (+ private companion) into named Environment definitions
- [x] `GET /api/environments` returns environment names, variable keys, `isSecret` flags, and redacted secret values
- [x] Header environment selector dropdown (UX-DR2) is populated from that API via TanStack Query
- [x] `pnpm turbo build test typecheck` passes workspace-wide
- [x] SM-2 fixture gate still ≥45/50 (http-parser `.http` corpus untouched / non-regressing)
- [x] No send-time resolution, no `.env` variant loading, no `.reqor/config.json` persistence (those are 2.3–2.5)

### Anti-patterns (do not ship)

- Do not resolve `{{host}}` / dynamics / `{{$dotenv}}` at list or send time
- Do not load repo `.env` / `.env.local` / `.env.staging` (Story 2.4)
- Do not persist active environment to `.reqor/config.json` (Story 2.3)
- Do not create `.reqor/secrets.env` vault
- Do not return plaintext secret values in API responses or logs
- Do not import `@reqor/http-parser` from `@reqor/web`
- Do not add runtime dependencies to `@reqor/http-parser`
- Do not conflate `.reqor/local.env` (`load-local-env.ts`) with JetBrains env files
- Do not change `POST /api/execute` behavior (still literal templates until 2.5)

## Story

As a **developer with JetBrains environment definitions**,
I want Reqor to load my environment files and list available environments,
So that I can target dev, staging, or production configurations.

## Acceptance Criteria

1. **Given** a repository containing `http-client.env.json` (or equivalent JetBrains env file)  
   **When** the Local Server starts  
   **Then** `@reqor/http-parser` extracts named Environment definitions (FR7)

2. **And** `GET /api/environments` returns environment names and variable keys (secrets flagged, values redacted)

3. **And** environment list populates the header environment selector dropdown (UX-DR2)

## Tasks / Subtasks

- [x] Task 1: Parser — JetBrains env file AST + parse API (AC: #1) — AD-3, AD-20, FR7
  - [x] 1.1 Add `packages/http-parser/src/environments.ts` with pure parse (no filesystem, no deps):
    ```typescript
    export interface EnvVariable {
      key: string
      /** Canonical string form for later resolution; numbers/bools stringified at parse */
      value: string
      /** true when value originates from http-client.private.env.json (JetBrains private file) */
      isSecret: boolean
    }

    export interface ParsedEnvironment {
      name: string
      /** Repo-relative POSIX path of the public file when present, else private file */
      sourceFile: string
      variables: EnvVariable[]
    }

    export interface ParseEnvironmentsResult {
      environments: ParsedEnvironment[]
      diagnostics: Diagnostic[] // reuse existing Diagnostic type from ast/diagnostics
    }

    /**
     * Parse JetBrains public + optional private env JSON text.
     * Merge rule (JetBrains): private overrides public for same env name + key.
     * Keys present in (or overridden by) private file → isSecret: true.
     */
    export function parseHttpClientEnvironments(input: {
      publicContent?: string
      privateContent?: string
      publicSourceFile?: string  // repo-relative POSIX, e.g. "api/http-client.env.json"
      privateSourceFile?: string // repo-relative POSIX, e.g. "api/http-client.private.env.json"
    }): ParseEnvironmentsResult
    ```
  - [x] 1.2 JSON shape (authoritative JetBrains format):
    ```json
    {
      "development": { "host": "localhost", "id-value": 12345 },
      "production": { "host": "example.com" }
    }
    ```
    - Top-level keys = environment names
    - Nested object = variable map (`key` → scalar value)
    - Skip non-object top-level values; emit diagnostic, continue
    - Invalid JSON → use `parseError(1, message, { file: publicSourceFile ?? privateSourceFile })` from `diagnostics.ts` (`DIAG_PARSE_ERROR` / code `PARSE_ERROR`); empty `environments`. JSON has no line granularity — always use line `1`.
  - [x] 1.3 Value coercion: `string` as-is (including **empty string** `""` — valid, keep key); `number` / `boolean` → `String(value)`; `null` / arrays / objects → skip key with diagnostic (prefer skip + diagnostic, do not stringify)
  - [x] 1.4 Merge public + private by environment name:
    - Union of env names from both files
    - For each key: private wins over public (JetBrains override)
    - `isSecret = true` iff the winning value came from the private file
    - Public-only keys → `isSecret: false`
  - [x] 1.5 Sort environments by `name` ascending; variables by `key` ascending (stable API)
  - [x] 1.6 Export types + `parseHttpClientEnvironments` from `packages/http-parser/src/index.ts`
  - [x] 1.7 Unit tests in `environments.test.ts` (see Task 5)

- [x] Task 2: Shared-types DTOs (AC: #2) — AD-10, AD-22
  - [x] 2.1 Add to `packages/shared-types/src/index.ts`:
    ```typescript
    export const EnvironmentVariableDto = Type.Object({
      key: Type.String(),
      /** Plaintext for non-secrets; redacted mask for secrets (never plaintext secrets) */
      value: Type.String(),
      isSecret: Type.Boolean(),
    })

    export const EnvironmentDto = Type.Object({
      name: Type.String(),
      sourceFile: Type.String(),
      variables: Type.Array(EnvironmentVariableDto),
    })

    export const EnvironmentsListResponse = Type.Object({
      environments: Type.Array(EnvironmentDto),
    })
    ```
  - [x] 2.2 Export Static types: `EnvironmentVariableDtoType`, `EnvironmentDtoType`, `EnvironmentsListResponseType`
  - [x] 2.3 Export shared redaction constant (used by server mapper and later stories):
    ```typescript
    /** Six bullet characters — matches UX-DR14 / web --color-secret-masked */
    export const SECRET_MASK = '••••••'
    ```
  - [x] 2.4 Update `packages/shared-types/src/index.test.ts` export/schema smoke for Environment* DTOs and `SECRET_MASK`

- [x] Task 3: Server — scan, store, route, redact (AC: #1–#2) — AD-7, AD-20, AD-22
  - [x] 3.1 Discover env files (mirror `scan.ts` ignore rules: hard-ignore `node_modules`, `.git`, `.reqor`; honor root `.gitignore`):
    - Prefer `scanEnvFiles(repositoryRoot)` returning pairs grouped by directory:
      - `http-client.env.json`
      - `http-client.private.env.json`
    - Glob: `**/http-client.env.json` and `**/http-client.private.env.json`
    - Pair by parent directory (repo-relative POSIX paths)
    - If only private exists for a dir, still parse (publicContent omitted)
    - Pass **full repo-relative paths** into `parseHttpClientEnvironments` as `publicSourceFile` / `privateSourceFile` (e.g. `services/api/http-client.env.json`, not basename alone)
    - **Multi-pair aggregation (authoritative):** sort pairs by directory path ascending; parse each; flatten environments into store keyed by **`name` only** — on name collision across pairs, **later pair wins** (overwrites earlier). Dropdown shows unique names; winning entry's `sourceFile` is preserved for 2.3+ resolution.
  - [x] 3.2 `EnvironmentStore` (mirror `CollectionStore` patterns):
    - `loadAll(repositoryRoot)` on server start (same `scanOnStart` gate as collections)
    - Read file contents → `parseHttpClientEnvironments` → keep **internal** AST (with real values) in memory
    - `list(): EnvironmentDtoType[]` — redacted DTO array (mirror `CollectionStore.list()` returning summaries, not the response wrapper)
  - [x] 3.3 `toEnvironmentsDto` / redaction (server-only mapper — AD-22):
    ```typescript
    import { SECRET_MASK } from '@reqor/shared-types'
    // for each variable: isSecret ? { ...v, value: SECRET_MASK } : { ...v }
    ```
    - Never log variable values
  - [x] 3.4 Route plugin `packages/server/src/routes/environments.ts`:
    ```typescript
    app.get('/api/environments', {
      schema: { response: { 200: EnvironmentsListResponse } },
    }, async () => ({ environments: environmentStore.list() }))
    ```
  - [x] 3.5 Register in `app.ts`: create store, `loadAll` when `scanOnStart !== false`, `app.register(environmentsRoutes, { environmentStore })` — mirror `collectionsRoutes` plugin-options pattern (`decorate` optional, same as collections)
  - [x] 3.6 Empty repo / missing env files → `{ environments: [] }` (200), not 404
  - [x] 3.7 Server tests: temp dir with public (+ private) fixtures; assert names/keys/`isSecret`/redacted values; assert plaintext secret never appears in JSON response

- [x] Task 4: Web — header environment selector (AC: #3) — UX-DR2
  - [x] 4.1 `packages/web/src/hooks/useEnvironments.ts` — TanStack Query:
    ```typescript
    useQuery({
      queryKey: ['environments'],
      queryFn: async ({ signal }) => {
        const res = await fetch('/api/environments', { signal })
        if (!res.ok) throw new Error('Failed to load environments')
        return res.json() as Promise<EnvironmentsListResponseType>
      },
    })
    ```
  - [x] 4.2 Update `AppHeader.tsx` (UX-DR2, UX-DR22):
    - Keep "Reqor" left (`h1.text-app-title`)
    - Right: native `<select>` with `aria-label="Environment"` (or visible `<label htmlFor=…>`) of environment **names**
    - Layout: `justify-between` / `ml-auto` so selector sits on the right
    - 48px header already via `h-header-height`; colors via existing tokens (`bg-header-background`, `text-header-foreground`)
    - Empty list: disabled select + placeholder option `No environments` (do not invent fake envs)
    - Loading: placeholder option `Loading…` or disabled select — no layout jump
    - Focus ring: visible on keyboard focus (match existing interactive token patterns)
  - [x] 4.3 Selection behavior for **this story only**:
    - Local React state for currently selected name is OK
    - Default: first environment name when list loads (or empty)
    - **Do not** POST/PUT to config; **do not** write `.reqor/config.json` (Story 2.3)
    - **Do not** show active name in request toolbar yet (Story 2.3)
  - [x] 4.4 Wire `useEnvironments` from `AppHeader` (or pass environments from `AppShell` — prefer hook inside header to keep AppShell thin)
  - [x] 4.5 Update `App.test.tsx` / add `AppHeader.test.tsx`:
    - Extend the existing `fetch` mock's URL router (`vi.fn().mockImplementation((url) => …)`) — add `/api/environments` branch; do not add a second global stub
    - Assert select shows environment names from fixture; assert `aria-label="Environment"` (or equivalent label association)
    - Existing banner + "Reqor" heading tests must still pass

- [x] Task 5: Tests & hygiene (AC: all)
  - [x] 5.1 Parser tests (`environments.test.ts`):
    - Public-only: two envs, string + number values coerced
    - Empty string values preserved (`"username": ""`)
    - Public + private merge: private overrides; overridden keys `isSecret: true`; private empty string → `isSecret: true`
    - Private-only key → `isSecret: true`, value kept in AST
    - Invalid JSON → `DIAG_PARSE_ERROR` at line 1 + empty list
    - Non-object env entry skipped
    - Sort order stable
  - [x] 5.1b Server/store tests: two env pairs in different dirs with same env name → later pair wins; response has one `development` entry with winning `sourceFile`
  - [x] 5.2 Export smoke in `index.test.ts` for `parseHttpClientEnvironments`
  - [x] 5.3 Server inject tests for `/api/environments` redaction
  - [x] 5.4 Confirm `@reqor/http-parser` still has **zero** runtime `dependencies`
  - [x] 5.5 Run `pnpm turbo build test typecheck`

### Review Findings

- [x] [Review][Defer] Demo uses unresolved `{{host}}` while execute still sends literals — deferred: I changed it for future testing
- [x] [Review][Patch] Env file read failures abort server startup [packages/server/src/environment-store.ts:21]
- [x] [Review][Patch] Strip UTF-8 BOM before JSON.parse [packages/http-parser/src/environments.ts:35]
- [x] [Review][Patch] Distinguish API/query error from empty environments in header selector [packages/web/src/components/AppHeader.tsx:5]
- [x] [Review][Patch] Log or otherwise handle discarded parse diagnostics in EnvironmentStore [packages/server/src/environment-store.ts:31]
- [x] [Review][Patch] Add error-path coverage (unreadable files, invalid JSON on disk, selector loading/error states) [packages/server/src/environments.test.ts]
- [x] [Review][Patch] Stabilize AppHeader select value during load (avoid empty controlled value / unstable `?? []` effect dep) [packages/web/src/components/AppHeader.tsx:5]
- [x] [Review][Patch] Skip empty-string environment names with a diagnostic [packages/http-parser/src/environments.ts:98]
- [x] [Review][Patch] Add `DIAG_UNSUPPORTED_VALUE` constant instead of ad-hoc `'UNSUPPORTED_VALUE'` string [packages/http-parser/src/environments.ts:81]
- [x] [Review][Patch] Remove duplicate accessible name (`sr-only` label + `aria-label`) on environment select [packages/web/src/components/AppHeader.tsx:33]
- [x] [Review][Patch] Add scan-env ignore coverage (hard-ignore / root `.gitignore`) [packages/server/src/scan-env.ts]
- [x] [Review][Patch] Update story File List to include `demo.http` and `http-client.env.json` [_bmad-output/implementation-artifacts/2-2-environment-file-parsing-and-listing.md:421]
- [x] [Review][Defer] No `http-client.private.env.json` gitignore guidance or fixture guard — deferred, pre-existing

## Dev Notes

### Implementation decisions (authoritative)

| Decision | Rule |
|----------|------|
| `sourceFile` format | **Repo-relative POSIX path** to public file when present, else private (e.g. `services/api/http-client.env.json`) — never basename alone |
| Multiple env file pairs | Scan all `**/http-client.*.env.json` pairs; sort pairs by directory path ascending; **later pair wins** on environment **name** collision |
| Empty strings | Valid variable values; keep key with `value: ""`; private-file origin → `isSecret: true` |
| JSON parse errors | `parseError(1, …)` + `DIAG_PARSE_ERROR`; optional `file` from source path |
| Secret redaction | `SECRET_MASK` exported from `@reqor/shared-types`; server mapper applies at API boundary |
| Env reload | **Server start only** — do not hook `POST /api/collections/refresh` (future story if needed) |
| Fastify wiring | Pass `environmentStore` via plugin options like `collectionsRoutes` |

### Epic Context

Epic 2 (UJ-3): developer selects an environment, resolves variables/secrets, previews, sends. Story 2.1 delivered placeholder **recognition**. **Story 2.2 loads and lists** JetBrains environments so the header can show names. Stories 2.3–2.5 add persistence, `.env` secret resolution, and send-time merge/preview.

### Architecture Compliance (MUST follow)

| AD / FR / UX | Requirement for 2.2 |
|--------------|---------------------|
| AD-3 | Env JSON parse lives in `@reqor/http-parser`; zero runtime deps |
| AD-7 / NFR6 | API responses redact secret values; never plaintext in logs/UI |
| AD-10 | TypeBox DTOs in `@reqor/shared-types`; Fastify validates |
| AD-20 | Parser parses `http-client.env.json`; server owns merge/resolution later — **listing only** here |
| AD-22 | Parser AST internal; server `toDto()`; web imports DTOs only |
| FR7 | Load Environment definitions; Web UI lists by name |
| UX-DR2 | Header: Reqor left, environment selector right only |
| SPEC | No `.reqor/secrets.env` vault; secrets from private env file (list) + later `.env` variants (2.4) |

### JetBrains File Format (latest docs)

JetBrains HTTP Client uses two files (not an `isSecret` property in JSON):

| File | Purpose |
|------|---------|
| `http-client.env.json` | Public / shareable variables (host, ports, etc.) |
| `http-client.private.env.json` | Sensitive values; **overrides** public for same env+key |

Sample (from JetBrains docs):

```json
{
  "development": {
    "host": "localhost",
    "id-value": 12345,
    "username": "",
    "password": ""
  },
  "production": {
    "host": "example.com",
    "id-value": 6789
  }
}
```

**Reqor mapping for AC “secrets flagged”:** treat values whose winning source is the **private** file as `isSecret: true`. Redact those in `GET /api/environments`. Public-only values may return plaintext (they are meant to be committed).

Do **not** invent a custom `isSecret` field inside the JSON files.

### Scope Boundaries

**In scope:** parse public/private env JSON; scan+store on server start; `GET /api/environments` with redaction; header dropdown populated with names; local-only selection state.

**Out of scope / do not implement:**
- Persist selection → `.reqor/config.json` → **Story 2.3**
- Active name in request toolbar → **Story 2.3**
- Read/resolve repo `.env` variants / `{{$dotenv}}` values → **Story 2.4**
- Send-time variable merge / pre-send preview / block unresolved → **Story 2.5**
- Re-scan env files on `POST /api/collections/refresh` (env load is server-start only in 2.2)
- Change execute proxy path
- Modify `variables.ts` classification (already done in 2.1)
- Touch `load-local-env.ts` (process env for `REQOR_*` only)

**Note vs Story 2.1 Dev Notes:** 2.1 said “Environment selector UI → Story 2.3”. **Epic 2.2 AC wins:** dropdown must be **populated** now. Persistence/restore remains 2.3.

### Current Code State (UPDATE)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/http-parser/src/variables.ts` | Placeholder scanner (done 2.1) | **Do not change** |
| `packages/http-parser/src/environments.ts` | — | **NEW** parse API |
| `packages/http-parser/src/index.ts` | Exports parse + variables | Export env parse API |
| `packages/shared-types/src/index.ts` | Collections + execute DTOs | **UPDATE** Environment* DTOs |
| `packages/server/src/scan.ts` | `**/*.http` only | Add env scan helper (new file OK) |
| `packages/server/src/collection-store.ts` | Collection load pattern | **Do not break**; mirror for env store |
| `packages/server/src/app.ts` | Collections + execute | Register env store + routes |
| `packages/server/src/load-local-env.ts` | `.reqor/local.env` → process.env | **Do not modify** |
| `packages/server/src/routes/execute.ts` | Literal proxy | **Do not modify** |
| `packages/web/src/components/AppHeader.tsx` | Brand only (`Reqor`) | Add right-side env `<select>` |
| `packages/web/src/hooks/useCollections.ts` | Query pattern | Mirror as `useEnvironments` |
| `packages/web/src/App.test.tsx` | Mocks collections fetch | Also mock environments |

### Suggested API Response Shape

```json
{
  "environments": [
    {
      "name": "development",
      "sourceFile": "http-client.env.json",
      "variables": [
        { "key": "host", "value": "localhost", "isSecret": false },
        { "key": "username", "value": "", "isSecret": false },
        { "key": "password", "value": "••••••", "isSecret": true }
      ]
    }
  ]
}
```

(`sourceFile` is repo-relative POSIX — root-level files appear as `http-client.env.json`; nested as `services/api/http-client.env.json`.)

Internal store **keeps** real secret strings for Stories 2.3–2.5; only the HTTP response is redacted.

### File Structure Requirements

```text
packages/http-parser/src/
  environments.ts        # NEW
  environments.test.ts   # NEW
  index.ts               # UPDATE exports
  index.test.ts          # UPDATE smoke
  variables.ts           # UNCHANGED

packages/shared-types/src/
  index.ts               # UPDATE DTOs

packages/server/src/
  scan-env.ts            # NEW (or extend scan.ts carefully)
  environment-store.ts   # NEW
  to-env-dto.ts          # NEW (or section in to-dto.ts) — redaction lives here
  routes/environments.ts # NEW
  environments.test.ts   # NEW
  app.ts                 # UPDATE register + loadAll

packages/web/src/
  hooks/useEnvironments.ts           # NEW
  hooks/useEnvironments.test.tsx     # NEW (optional if covered in AppHeader test)
  components/AppHeader.tsx           # UPDATE
  components/AppHeader.test.tsx      # NEW or extend App.test.tsx
```

### Previous Story Intelligence (2.1)

- Side-channel APIs preferred over mutating existing parse pipelines — env parse is a **new** module, not bolted onto `parseHttpFile`
- Zero-dep http-parser is non-negotiable; hand-rolled `JSON.parse` + validation
- Clone/copy carefully when mapping objects; review found shared mutable `location` in 2.1
- Export smoke tests caught missing public API surface
- Do not expand shared-types until the wire shape is needed — **now it is needed**
- Execute still sends literal templates — leave alone
- Fixtures: no `http-client.env.json` in corpus today — add **inline test JSON** / temp dirs; do not force `.http` corpus changes

### Git Intelligence

- `1c30d68` — Story 2.1 variable scanner (baseline for this story)
- `61fa8eb` — Execute + shared-types Execute* + ResponsePanel patterns
- Patterns to copy: Fastify + TypeBox from shared-types; CollectionStore load queue + plugin-options routes; TanStack `useQuery` + `queryKey`; ESM `.js` imports; colocated Vitest; temp-dir server tests; `parseError` / `DIAG_PARSE_ERROR` from http-parser diagnostics

### Latest Technical Information

- JetBrains docs (2024–2026): public `http-client.env.json` + private `http-client.private.env.json`; private overrides public; no in-file `isSecret` flag
- Reqor SPEC/glossary: Environment sourced from `http-client.env.json`; EnvResolver merge with `.env` variants is **send-time** (2.5), not list-time
- Stack (locked): TypeScript 5.9, Fastify 5, React 19, TanStack Query 5, Vitest 3, Node `>=24 <25`
- No new npm packages required for JSON parse

### Testing Standards

- Vitest 3.x colocated tests; ESM imports with `.js` suffix
- Parser: pure unit tests with string fixtures (no server)
- Server: `app.inject` + temp repository roots (see `collections.test.ts` / `scan.test.ts`)
- Web: extend existing `fetch` mock URL router in `App.test.tsx` — add `/api/environments` branch alongside collections/execute
- Full gate: `pnpm turbo build test typecheck`

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2, FR7]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/prd.md` — FR-7]
- [Source: `_bmad-output/specs/spec-reqor/SPEC.md` — CAP-7, secrets constraint]
- [Source: `_bmad-output/specs/spec-reqor/glossary.md` — Environment, EnvResolver]
- [Source: `_bmad-output/specs/spec-reqor/dialect-matrix.md` — `http-client.env.json` IN]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-3, AD-7, AD-20, AD-22]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — `GET /environments`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/EXPERIENCE.md` — Environment selector]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/DESIGN.md` — UX-DR2 header]
- [Source: `_bmad-output/implementation-artifacts/2-1-variable-and-dynamic-placeholder-parsing.md`]
- [Source: `_bmad-output/implementation-artifacts/1-5-app-shell-and-design-system-tokens.md` — env dropdown deferred to 2.2]
- [Source: `packages/server/src/collection-store.ts`, `scan.ts`, `app.ts`, `routes/collections.ts`]
- [Source: `packages/web/src/hooks/useCollections.ts`, `components/AppHeader.tsx`]
- [Source: JetBrains HTTP Client variables docs — public/private env JSON merge]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Implemented red-green-refactor: parser unit tests first, then server/web integration
- Fixed App.test.tsx loading test to stub separate promises for collections and environments fetches

### Completion Notes List

- Added `parseHttpClientEnvironments` in `@reqor/http-parser` — pure JSON parse, public/private merge, JetBrains `isSecret` semantics (private origin), stable sort, diagnostics for invalid JSON and unsupported values
- Added Environment DTOs and `SECRET_MASK` (`••••••`) to `@reqor/shared-types`
- Added `scanEnvFiles`, `EnvironmentStore`, `to-env-dto` redaction mapper, and `GET /api/environments` route; wired in `app.ts` with parallel load on server start
- Added header environment `<select>` via `useEnvironments` hook — local selection state only (no persistence)
- All workspace tests pass; SM-2 fixture gate unchanged; http-parser has zero runtime dependencies

### File List

- packages/http-parser/src/environments.ts (new)
- packages/http-parser/src/environments.test.ts (new)
- packages/http-parser/src/diagnostics.ts (modified)
- packages/http-parser/src/index.ts (modified)
- packages/http-parser/src/index.test.ts (modified)
- packages/shared-types/src/index.ts (modified)
- packages/shared-types/src/index.test.ts (modified)
- packages/server/src/scan-env.ts (new)
- packages/server/src/scan-env.test.ts (new)
- packages/server/src/environment-store.ts (new)
- packages/server/src/to-env-dto.ts (new)
- packages/server/src/routes/environments.ts (new)
- packages/server/src/environments.test.ts (new)
- packages/server/src/app.ts (modified)
- packages/web/src/hooks/useEnvironments.ts (new)
- packages/web/src/components/AppHeader.tsx (modified)
- packages/web/src/App.test.tsx (modified)
- demo.http (modified)
- http-client.env.json (new)

## Change Log

- 2026-07-16: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-16: Validation pass — multi-pair merge rule, sourceFile path format, empty strings, SECRET_MASK export, diagnostics helpers, accessibility, list() return type, refresh scope
- 2026-07-16: Story 2.2 implemented — env file parsing, GET /api/environments with redaction, header environment selector
- 2026-07-17: Code review patches applied — resilient env load, BOM/empty-name guards, selector error UX, diagnostics logging, expanded tests
