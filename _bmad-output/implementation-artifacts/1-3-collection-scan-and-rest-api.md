---
baseline_commit: b07993d
---

# Story 1.3: Collection Scan and REST API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

Verify all of the following before marking done:

- [x] `pnpm --filter @reqor/shared-types build` emits Collection/Request TypeBox schemas and DTO types
- [x] `pnpm --filter @reqor/server test` passes collection scan + REST API integration tests (including parse-error isolation and gitignore exclusion)
- [x] `pnpm turbo build test typecheck` pass workspace-wide (no regressions from Stories 1.1–1.2)
- [x] `GET /api/collections`, `GET /api/collections/:id`, and `POST /api/collections/refresh` return TypeBox-validated responses
- [x] Collection `id` values use repo-relative POSIX paths (e.g. `http/users.http`, not Windows backslashes)
- [x] Request DTOs include `requestIndex` (0-based) and stable `fingerprint` per AD-21
- [x] Parse error in one `.http` file does not prevent other collections from loading (NFR8)
- [x] Error responses use `{ error: { code, message, details? } }` envelope (AD-10)
- [x] No web or CLI feature work beyond passing `repositoryRoot` into `buildApp` for dev/tests (Stories 1.4–1.6)

## Story

As a **developer running Reqor against my repository**,
I want the Local Server to discover and expose all `.http` files as collections via REST API,
so that the Web UI can list my request files without reading disk directly.

## Acceptance Criteria

1. **Given** a Repository Root containing `.http` files in subdirectories  
   **When** the Local Server starts or receives `POST /api/collections/refresh`  
   **Then** it recursively scans for `*.http` files excluding `node_modules`, `.git`, and paths in `.gitignore`

2. **And** `GET /api/collections` returns each file as a Collection with repo-relative path as `id` and parse status

3. **And** `GET /api/collections/:id` returns collection detail with Request DTOs including `requestIndex` and `fingerprint` (AD-21)

4. **And** parse errors on one file do not block other collections from loading (NFR8)

5. **And** refresh completes within 3 seconds for up to 100 `.http` files (NFR3) — verify with integration test or timed benchmark on typical dev hardware

6. **And** server maps parser AST to API DTOs via explicit `toDto()` mapper in `@reqor/server`; DTO schemas live in `@reqor/shared-types` (AD-22)

7. **And** error responses use `{ error: { code, message, details? } }` envelope

## Tasks / Subtasks

- [x] Task 1: Define Collection/Request API DTOs in shared-types (AC: #2, #3, #6, #7) — AD-10, AD-21, AD-22
  - [x] 1.1 Expand `packages/shared-types/src/index.ts` with TypeBox schemas + `Static<>` types:
    - `ParseStatus` — `'ok' | 'error'` (error when `PARSE_ERROR` diagnostics exist or file unreadable; `UNSUPPORTED_CONSTRUCT` alone does not force error if requests extracted)
    - `DiagnosticDto` — `{ line: number, message: string, code?: string }`
    - `RequestBodyDto` — `{ kind: 'raw' | 'json' | 'form', content: string }`
    - `RequestHeaderDto` — `{ name: string, value: string }`
    - `RequestDto` — `{ requestIndex: number, fingerprint: string, method: string, url: string, httpVersion?: string, headers: RequestHeaderDto[], body?: RequestBodyDto }`
    - `CollectionSummaryDto` — `{ id: string, parseStatus: ParseStatus, requestCount: number, diagnostics: DiagnosticDto[] }`
    - `CollectionDetailDto` — `{ id: string, content: string, parseStatus: ParseStatus, requests: RequestDto[], diagnostics: DiagnosticDto[] }`
    - `CollectionsListResponse` — `{ collections: CollectionSummaryDto[] }`
    - `CollectionsRefreshResponse` — same shape as list (return refreshed snapshot)
  - [x] 1.2 Re-export `ApiErrorEnvelope` (already exists) — use for 404/500 responses
  - [x] 1.3 Add Vitest smoke tests asserting schemas compile and sample values validate

- [x] Task 2: Implement repository scanner (AC: #1, #4, #5) — FR-3, AD-11
  - [x] 2.1 Create `packages/server/src/scan.ts`:
    - `scanHttpFiles(repositoryRoot: string): Promise<string[]>` — returns repo-relative POSIX paths ending in `.http`
    - Use `fast-glob` with `cwd: repositoryRoot`, pattern `**/*.http`, `absolute: false`, `onlyFiles: true`
    - Always ignore: `node_modules/**`, `.git/**`, `.reqor/**`
    - Load root `.gitignore` when present via `ignore` package; apply to discovered paths (also ignore nested `.gitignore` if straightforward — at minimum honor repo-root `.gitignore`)
    - Normalize all returned ids to POSIX separators (`path.posix.join` on relative segments)
  - [x] 2.2 Add `fast-glob` and `ignore` to pnpm `catalog:` and `@reqor/server` dependencies
  - [x] 2.3 Unit-test scanner in isolation with temp dirs: included nested files, excluded `node_modules`, excluded `.git`, honored `.gitignore` entry

- [x] Task 3: Implement AST → DTO mapper (AC: #3, #6) — AD-21, AD-22
  - [x] 3.1 Create `packages/server/src/to-dto.ts`:
    - `computeFingerprint(method: string, urlTemplate: string): string` — `crypto.createHash('sha256').update(\`${method}:${urlTemplate}\`).digest('hex')`
    - `toRequestDto(parsed: ParsedRequest, requestIndex: number): RequestDto`
    - `toCollectionDetail(id: string, content: string, parseResult: ParseResult): CollectionDetailDto`
    - `toCollectionSummary(detail: CollectionDetailDto): CollectionSummaryDto`
    - Map parser `Diagnostic` → `DiagnosticDto` (strip `file` — redundant with collection id)
    - Derive `parseStatus`: `'error'` if any diagnostic has `code === 'PARSE_ERROR'` (use parser `DIAG_PARSE_ERROR` constant); else `'ok'`
  - [x] 3.2 Import parser types from `@reqor/http-parser` only inside server — never re-export AST to shared-types or web
  - [x] 3.3 Unit-test fingerprint stability: same method+url → same hash; index changes do not affect fingerprint

- [x] Task 4: In-memory collection store + load pipeline (AC: #1, #4) — NFR8
  - [x] 4.1 Create `packages/server/src/collection-store.ts`:
    - Holds `Map<string, CollectionDetailDto>` keyed by collection id
    - `loadAll(repositoryRoot: string): Promise<CollectionSummaryDto[]>` — scan → read each file → `parseHttpFile(content, { file: id })` → `toCollectionDetail`
    - Per-file try/catch: read/parse failure on one file produces collection entry with `parseStatus: 'error'`, diagnostic message, empty `requests` — **does not throw** or abort other files
    - `get(id: string): CollectionDetailDto | undefined`
    - `list(): CollectionSummaryDto[]`
  - [x] 4.2 Store full file `content` in detail DTO (needed by Story 3.2 raw editor and Story 3.3 save baseline)

- [x] Task 5: Wire REST routes (AC: #2, #3, #7) — AD-10, solution-design §5
  - [x] 5.1 Create `packages/server/src/routes/collections.ts` registering:
    - `GET /api/collections` → `200 CollectionsListResponse`
    - `GET /api/collections/:id` → `200 CollectionDetailDto` or `404` `{ error: { code: 'NOT_FOUND', message, details: { id } } }`
    - `POST /api/collections/refresh` → reload store from disk, return `200 CollectionsRefreshResponse`
  - [x] 5.2 Use Fastify TypeBox provider with schemas from `@reqor/shared-types` on all routes
  - [x] 5.3 URL-decode `:id` param (ids contain `/` — e.g. `http/users.http`). Prefer wildcard route `/api/collections/*` or Fastify param decoding that preserves slashes; document chosen approach in code comment
  - [x] 5.4 Register routes from `buildApp` after store initialization

- [x] Task 6: Extend `buildApp` with repository root + startup scan (AC: #1) — AD-9
  - [x] 6.1 Update `packages/server/src/app.ts`:
    ```ts
    export interface BuildAppOptions {
      repositoryRoot: string
      scanOnStart?: boolean // default true
    }
    export function buildApp(options: BuildAppOptions)
    ```
  - [x] 6.2 On build: create `CollectionStore`, run `loadAll` when `scanOnStart !== false`, attach store to Fastify instance via `app.decorate('collectionStore', store)` or closure passed to route plugin
  - [x] 6.3 Keep existing `GET /api/health` unchanged
  - [x] 6.4 Update `packages/server/src/index.ts` dev entry: `buildApp({ repositoryRoot: process.cwd() })`
  - [x] 6.5 Update `@reqor/server` export types if `BuildAppOptions` is public

- [x] Task 7: Integration test suite (AC: #1–#7) — FR-3, FR-5 via API
  - [x] 7.1 Create `packages/server/src/collections.test.ts` using `fastify.inject()` and temp repo fixture dirs:
    - Happy path: two `.http` files → list returns 2 collections with correct ids and request counts
    - Detail: `GET /api/collections/:id` returns requests with sequential `requestIndex` and fingerprints
    - Parse isolation: one valid + one malformed file → valid file loads requests; malformed has `parseStatus: 'error'` with line diagnostic; list still returns both
    - Refresh: add file on disk → `POST /api/collections/refresh` → new collection appears
    - Not found: unknown id → 404 with error envelope
    - Ignore rules: file under `node_modules/` and gitignored path not scanned
  - [x] 7.2 Optional NFR3 benchmark test (mark `test.skip` if flaky in CI): 100 small `.http` files refresh < 3000ms locally
  - [x] 7.3 Keep `index.test.ts` health test passing — update `buildApp()` calls to pass `{ repositoryRoot: tempDir }`

- [x] Task 8: Workspace verification (AC: all)
  - [x] 8.1 Run `pnpm turbo build test typecheck`
  - [x] 8.2 Confirm `@reqor/web` and `@reqor/cli` unchanged except if type errors from `buildApp` signature ripple to CLI import (update CLI stub import only if needed — do not implement `reqor serve`)

### Review Findings

- [x] [Review][Patch] [High] Prevent scanner symlinks from escaping the repository root [packages/server/src/scan.ts:28]
- [x] [Review][Patch] [Medium] Publish refresh snapshots atomically and serialize overlapping refreshes [packages/server/src/collection-store.ts:15]
- [x] [Review][Patch] [Medium] Remove the second decoding pass for Fastify wildcard collection IDs [packages/server/src/routes/collections.ts:45]
- [x] [Review][Patch] [Medium] Propagate `.gitignore` read failures other than `ENOENT` [packages/server/src/scan.ts:15]
- [x] [Review][Patch] [Medium] Include `.http` files inside non-excluded dot-directories [packages/server/src/scan.ts:28]
- [x] [Review][Patch] [Medium] Return the required API error envelope when refresh fails [packages/server/src/routes/collections.ts:63]
- [x] [Review][Patch] [Medium] Repair and execute the 100-file NFR3 benchmark against the populated repository [packages/server/src/collections.test.ts:204]
- [x] [Review][Patch] [Low] Constrain DTO indexes, counts, line numbers, and SHA-256 fingerprints in TypeBox schemas [packages/shared-types/src/index.ts:27]
- [x] [Review][Patch] [Low] Use locale-independent collection ID ordering [packages/server/src/collection-store.ts:41]

## Dev Notes

### Epic Context

Epic 1 delivers UJ-1: developer runs `reqor serve`, browses `.http` collections, sends a request, sees response. Stories 1.1–1.2 established monorepo scaffold and production-grade JetBrains parser (50/50 fixture pass). **Story 1.3 is the first server feature story** — wires parser output to REST API so Stories 1.5–1.6 (web UI) can consume collections without disk access.

**In scope:** FR-3 (discover `.http` files), FR-5 (parse via API exposure), partial FR-4 (refresh endpoint — UI trigger is Story 1.6).

**Out of scope:** CLI `reqor serve` packaging (1.4), static web serve (1.4), web sidebar (1.6), HTTP proxy `POST /api/execute` (1.7), env APIs (Epic 2), `PUT /api/collections/:id` save (3.3), variable resolution (Epic 2).

### Architecture Compliance (MUST follow)

| AD | Requirement for 1.3 |
|----|---------------------|
| AD-2 | `server → http-parser, shared-types` only; no web imports in server |
| AD-3 | Server calls `parseHttpFile`; web never parses `.http` |
| AD-9 | Fastify 5.x single process; extend existing `buildApp` |
| AD-10 | TypeBox schemas in `shared-types`; Fastify validates responses |
| AD-11 | Recursive `*.http` scan; honor `.gitignore`; exclude `node_modules`, `.git` |
| AD-21 | `requestIndex` 0-based; `fingerprint = sha256(method + urlTemplate)` |
| AD-22 | DTOs in `shared-types`; `toDto()` mapper in `packages/server/src/to-dto.ts` |
| NFR8 | Per-file parse failure isolation — never fail entire scan |
| NFR12 | Keep `127.0.0.1` bind in dev entry (unchanged) |

### API Contract Summary

| Method | Path | Response | Notes |
|--------|------|----------|-------|
| GET | `/api/collections` | `{ collections: CollectionSummaryDto[] }` | Sorted by `id` ascending for stable UI |
| GET | `/api/collections/:id` | `CollectionDetailDto` | `:id` is URL-encoded repo-relative path |
| POST | `/api/collections/refresh` | `{ collections: CollectionSummaryDto[] }` | Re-scan + re-parse all files |

**404 envelope example:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Collection not found",
    "details": { "id": "missing.http" }
  }
}
```

[Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` §5]

### RequestDto Field Mapping (Parser AST → API)

| Parser (`ParsedRequest`) | API (`RequestDto`) |
|--------------------------|-------------------|
| (array index) | `requestIndex` |
| `method` | `method` (uppercase) |
| `url` | `url` (template preserved, including `{{var}}`) |
| `httpVersion` | `httpVersion` |
| `headers[]` | `headers[]` (name + value only; drop `line`) |
| `body` | `body` (kind + content) |
| — | `fingerprint` = `sha256(\`${method}:${url}\`)` |

Do **not** expose `SourceSpan` in API DTOs — internal to parser/minimal-diff (Story 3.3).

### Current Code State (UPDATE, not NEW)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/shared-types/src/index.ts` | `HealthResponse`, `ApiErrorEnvelope` only | Add Collection/Request DTO schemas |
| `packages/server/src/app.ts` | `buildApp()` with `/api/health` only | Accept `BuildAppOptions`, init store, register collection routes |
| `packages/server/src/index.ts` | `buildApp()` no args | Pass `{ repositoryRoot: process.cwd() }` |
| `packages/server/src/index.test.ts` | Health inject test | Update `buildApp({ repositoryRoot: tmpDir })` |
| `packages/http-parser/**` | Full parser (Story 1.2) | **Do not modify** unless blocking bug found |

**Do NOT modify:** `packages/web` (except if `buildApp` type export forces compile fix), `packages/cli` serve logic, parser fixtures.

### Collection ID Rules

- **Format:** repo-relative path from Repository Root, POSIX `/` separators, e.g. `http/api/users.http`
- **Never:** absolute filesystem paths or Windows `\` in API responses
- **Implementation:** `path.relative(repositoryRoot, absolutePath)` then `.split(path.sep).join('/')`

[Source: `_bmad-output/specs/spec-reqor/glossary.md` — Collection, Repository Root]

### Scanner Implementation Guidance

**Recommended stack:** `fast-glob` + `ignore` (same semantics as gitignore; lightweight, well-maintained).

```ts
// Pseudocode — adapt to project ESM + .js extensions
import fg from 'fast-glob'
import ignore from 'ignore'
import fs from 'node:fs/promises'
import path from 'node:path'

const HARD_IGNORE = ['**/node_modules/**', '**/.git/**', '**/.reqor/**']

async function buildIgnoreFilter(root: string) {
  const ig = ignore().add(HARD_IGNORE)
  try {
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8')
    ig.add(gitignore)
  } catch { /* no .gitignore — hard ignores only */ }
  return (relativePath: string) => !ig.ignores(relativePath)
}
```

**Anti-pattern:** Do not use bare `fs.readdir` recursion without ignore filtering — will scan `node_modules` and tank NFR3.

### Route `:id` with Slashes

Collection ids contain `/`. Options (pick one, test thoroughly):

1. **Wildcard route:** `GET /api/collections/*` — strip prefix to get id
2. **Encoded param:** `:id` with client sending `encodeURIComponent('http/foo.http')` — server `decodeURIComponent`

Prefer wildcard or Fastify `{ id: '*' }` style if available in Fastify 5 — document in route file.

### Testing Standards

- **Framework:** Vitest 3.x + `fastify.inject()` (no live port binding required)
- **Fixtures:** Create temp dirs per test via `fs.mkdtempSync` + `fs.writeFileSync`; clean up in `afterEach`
- **Sample `.http` content:** reuse minimal snippets from `packages/http-parser/src/parse.test.ts`
- **CI:** existing `pnpm turbo test` must include new server tests

### Anti-Patterns (do NOT do)

- Do not expose `@reqor/http-parser` AST types from `shared-types` or API responses
- Do not implement `POST /api/execute`, env resolver, or history — later stories
- Do not implement `PUT /api/collections/:id` or disk writes — Story 3.3
- Do not add TanStack Query or web collection UI — Stories 1.5–1.6
- Do not implement full `reqor serve` CLI — Story 1.4 (only pass `repositoryRoot` through `buildApp`)
- Do not resolve `{{variables}}` in DTOs — return url templates verbatim (Epic 2)
- Do not fail entire scan when one file has `PARSE_ERROR`
- Do not return absolute paths as collection ids
- Do not add `@reqor/http-parser` dependency to `shared-types`

### Project Structure Notes

```text
packages/shared-types/src/
  index.ts                    # UPDATE — Collection/Request schemas

packages/server/src/
  app.ts                      # UPDATE — BuildAppOptions, store init, route registration
  index.ts                    # UPDATE — pass repositoryRoot
  scan.ts                     # NEW — gitignore-aware file discovery
  scan.test.ts                # NEW — scanner unit tests
  to-dto.ts                   # NEW — AST → DTO mapper + fingerprint
  to-dto.test.ts              # NEW — mapper unit tests
  collection-store.ts         # NEW — in-memory store + load pipeline
  routes/
    collections.ts            # NEW — REST handlers
  collections.test.ts         # NEW — integration tests
  index.test.ts               # UPDATE — buildApp options
```

Aligns with ARCHITECTURE-SPINE Structural Seed: `server/` owns scan, API, parser consumption.

### Previous Story Intelligence (1.2)

- Parser API: `parseHttpFile(content, { file?: string })` → `{ requests, diagnostics }`
- Diagnostic codes: `PARSE_ERROR`, `UNSUPPORTED_CONSTRUCT` — use constants from `@reqor/http-parser`
- `UNSUPPORTED_CONSTRUCT` on a file with valid requests → still return requests; `parseStatus` remains `'ok'` unless `PARSE_ERROR` present
- Parser accepts schemeless URLs (recent fix `b07993d`) — DTOs pass url through unchanged
- 50/50 fixture pass — rely on parser; server tests use small inline fixtures, not full corpus
- Zero runtime deps on http-parser — do not add deps there
- ESM pattern: `.js` extensions in relative imports, `"type": "module"`

### Previous Story Intelligence (1.1)

- Fastify TypeBox provider pattern established in `app.ts`
- `buildApp` exported from `@reqor/server` for CLI reuse in Story 1.4
- Server listens `127.0.0.1:3000` in dev entry only — tests use inject
- `ApiErrorEnvelope` already defined — reuse for 404/500

### Git Intelligence

Recent commits:

- `b07993d` — schemeless URL fix + OUT construct body exclusion in parser
- `37a3c88` — Story 1.2 parser implementation
- `bd9aab7` — header continuation whitespace fix
- `903c0ae` — CI/pnpm version fix

Patterns: colocated tests, ESM + tsc build, workspace `catalog:` deps, story-driven incremental delivery.

### Latest Technical Information

- **Fastify 5 route params:** Use wildcard/splat for path segments containing `/`; verify against Fastify 5 docs if `*` param syntax differs from v4
- **fast-glob v3:** `{ cwd, onlyFiles, absolute: false }` — add ignore option or post-filter with `ignore` package
- **Node 24 `crypto.createHash('sha256')`:** stable choice for fingerprint — no external hash library needed
- **NFR3:** 100 files × (read + parse) should complete <3s on dev laptop — avoid re-parsing unchanged files in this story (optimization deferred); sequential parse is acceptable for MVP

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.3, Epic 1]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-11, AD-21, AD-22]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — §4.1 Cold start, §5 API surface, §7 Request identity]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/prd.md` — FR-3, §4.2]
- [Source: `_bmad-output/specs/spec-reqor/SPEC.md` — CAP-3, CAP-5]
- [Source: `_bmad-output/specs/spec-reqor/glossary.md` — Collection, Request, fingerprint]
- [Source: `_bmad-output/implementation-artifacts/1-2-jetbrains-request-parser-with-fixture-test-suite.md`]
- [Source: `_bmad-output/implementation-artifacts/1-1-scaffold-monorepo-and-development-toolchain.md`]
- [Source: `packages/http-parser/src/index.ts` — parser public API]
- [Source: `packages/server/src/app.ts` — current Fastify app]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added Collection/Request TypeBox DTO schemas to `@reqor/shared-types` with Vitest validation smoke tests
- Implemented gitignore-aware `.http` file scanner using `fast-glob` + `ignore` with POSIX path normalization
- Implemented AST→DTO mapper with SHA-256 fingerprints and per-file parse error isolation in `CollectionStore`
- Wired REST routes: `GET /api/collections`, `GET /api/collections/*` (wildcard for slash-containing ids), `POST /api/collections/refresh`
- Extended `buildApp({ repositoryRoot, scanOnStart? })` to scan on startup; dev entry passes `process.cwd()`
- 19 server tests pass, including the NFR3 benchmark; full workspace `pnpm turbo build test typecheck` green

### File List

- pnpm-workspace.yaml
- packages/shared-types/src/index.ts
- packages/shared-types/src/index.test.ts
- packages/server/package.json
- packages/server/src/app.ts
- packages/server/src/index.ts
- packages/server/src/scan.ts
- packages/server/src/scan.test.ts
- packages/server/src/to-dto.ts
- packages/server/src/to-dto.test.ts
- packages/server/src/collection-store.ts
- packages/server/src/routes/collections.ts
- packages/server/src/collections.test.ts
- packages/server/src/index.test.ts

## Change Log

- 2026-07-14: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-15: Implemented collection scan, in-memory store, AST→DTO mapping, and REST API endpoints with full test coverage
