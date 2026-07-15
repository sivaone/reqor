---
baseline_commit: 00706df
---

# Story 1.4: CLI Start and Web UI Static Serve

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

Verify all of the following before marking done:

- [x] `pnpm --filter @reqor/cli build` produces a runnable `reqor` bin with bundled `web-dist/` assets
- [x] `pnpm --filter @reqor/cli test` and `pnpm --filter @reqor/server test` pass (including new static-serve integration tests)
- [x] `pnpm turbo build test typecheck` pass workspace-wide (no regressions from Stories 1.1–1.3)
- [x] `reqor serve [path]` (or `node packages/cli/dist/index.js serve [path]`) starts within 5s, binds `127.0.0.1:3000` only, prints URL, opens browser
- [x] `http://localhost:3000` serves built React SPA; `/api/health` returns 200 from same origin (no CORS)
- [x] Invalid path → non-zero exit with readable error
- [x] Port 3000 in use → non-zero exit with readable error (no auto-increment)
- [x] First run creates `<repositoryRoot>/.reqor/` and ensures `.reqor/` entry in repository `.gitignore`
- [x] `pnpm turbo dev` unchanged — Vite :5173 + Fastify :3000 API-only (no static plugin in dev entry)
- [x] No app shell, sidebar, or proxy work (Stories 1.5–1.7)

## Story

As a **developer on a fresh laptop**,
I want to run one command that starts Reqor and opens my browser,
so that I can reach the Web UI in under 60 seconds without separate dev servers.

## Acceptance Criteria

1. **Given** I run `reqor serve [path]` or `npx @reqor/cli serve [path]` where `[path]` defaults to cwd  
   **When** the path exists and port 3000 is available  
   **Then** a single Fastify process starts within 5 seconds (NFR4) binding localhost only (NFR12)

2. **And** CLI prints the URL and opens the system default browser

3. **And** navigating to `http://localhost:3000` serves the built React SPA from the same origin (FR2)

4. **And** Web UI API calls succeed without CORS errors (AD-6)

5. **When** port 3000 is in use  
   **Then** the process exits non-zero with a readable error — no auto-increment (NFR13)

6. **When** the path does not exist  
   **Then** the process exits non-zero with a readable error

7. **And** on first run CLI creates `.reqor/` and adds it to `.gitignore` (AD-12)

8. **And** `@reqor/cli` bundles built server + web dist for `npx` distribution (AD-14)

## Tasks / Subtasks

- [x] Task 1: Add static serving to Fastify app (AC: #3, #4) — FR-2, AD-9, AD-6
  - [x] 1.1 Add `@fastify/static` to pnpm `catalog:` and `@reqor/server` dependencies
  - [x] 1.2 Extend `BuildAppOptions` in `packages/server/src/app.ts`:
  - [x] 1.3 When `staticRoot` is provided:
  - [x] 1.4 Export `DEFAULT_HOST = '127.0.0.1'` and `DEFAULT_PORT = 3000` from server (e.g. `constants.ts` or `app.ts`) for CLI reuse
  - [x] 1.5 Do **not** pass `staticRoot` from `packages/server/src/index.ts` dev entry — dev mode stays API-only on :3000

- [x] Task 2: Implement CLI `serve` command (AC: #1, #2, #5, #6) — FR-1, NFR4, NFR12, NFR13
  - [x] 2.1 Replace stub in `packages/cli/src/index.ts` with async `serve(pathArg?: string)`:
  - [x] 2.2 Catch `EADDRINUSE` on listen → readable stderr message naming port 3000 → exit 1 (NFR13)
  - [x] 2.3 Register graceful shutdown (SIGINT, SIGTERM, SIGBREAK on Windows) — mirror pattern from `packages/server/src/index.ts`
  - [x] 2.4 Parse argv: `reqor serve [path]`; unknown commands → usage + exit 1
  - [x] 2.5 **Critical:** CLI `serve [path]` uses the explicit path as Repository Root — do **not** call `resolveRepositoryRoot()` git-walk (that is dev-mode convenience only)

- [x] Task 3: First-run `.reqor/` bootstrap (AC: #7) — AD-12
  - [x] 3.1 Create `packages/cli/src/bootstrap-reqor-dir.ts`:
  - [x] 3.2 Call `ensureReqorBootstrap(repositoryRoot)` before `buildApp` in `serve()`
  - [x] 3.3 Unit-test bootstrap: creates dir, appends gitignore, idempotent second call

- [x] Task 4: Resolve static asset path + CLI packaging (AC: #8) — AD-14
  - [x] 4.1 Create `packages/cli/src/resolve-static-root.ts`:
  - [x] 4.2 Create `packages/cli/scripts/copy-web-dist.mjs` — copy `../web/dist` → `packages/cli/web-dist/`
  - [x] 4.3 Update `packages/cli/package.json`:
  - [x] 4.4 Verify `@reqor/server` remains runtime dependency (not bundled into single file — AD-14 means publishable package includes server dep + web assets)
  - [x] 4.5 Update root `turbo.json`: add `"web-dist/**"` to the `build` task's `outputs` array (currently `["dist/**"]` only). Without this, a Turbo cache hit on `cli`'s build restores `dist/` but **not** `web-dist/`, leaving `reqor serve` without static assets after a cached rebuild
  - [x] 4.6 Add `web-dist/` to `.gitignore` (either root `.gitignore` or a new `packages/cli/.gitignore`). Root `.gitignore` only ignores generic `dist/`, which does not match `web-dist/`; without this entry, every build leaves untracked generated files that `git add .` could accidentally commit

- [x] Task 5: Export server helpers for CLI (AC: #1, #2)
  - [x] 5.1 Update `packages/server/package.json` exports map to expose needed modules OR re-export from main entry:
  - [x] 5.2 Keep `@reqor/server` main export as `buildApp` — add subpath exports only if cleaner than barrel re-exports

- [x] Task 6: Test suite (AC: all)
  - [x] 6.1 `packages/server/src/static-serve.test.ts`:
  - [x] 6.2 `packages/cli/src/bootstrap-reqor-dir.test.ts` — bootstrap idempotency
  - [x] 6.3 `packages/cli/src/resolve-static-root.test.ts` — resolves web-dist path
  - [x] 6.4 Update `packages/cli/src/index.test.ts` — test arg parsing helpers (extract pure functions if needed for testability)
  - [x] 6.5 Manual smoke: `pnpm turbo build && node packages/cli/dist/index.js serve .` → browser shows health check from `:3000` (not :5173)

- [x] Task 7: Workspace verification (AC: all)
  - [x] 7.1 Run `pnpm turbo build test typecheck`
  - [x] 7.2 Confirm `pnpm turbo dev` still works (Vite proxy unchanged)

## Dev Notes

### Epic Context

Epic 1 delivers UJ-1: developer runs `reqor serve`, browses `.http` collections, sends a request, sees response. Stories 1.1–1.3 built monorepo scaffold, parser, and collection REST API. **Story 1.4 is the prod-like entrypoint** — single-process `reqor serve` serving API + static UI from `:3000`. Stories 1.5–1.7 build on this substrate (app shell, sidebar, proxy).

**In scope:** FR-1 (CLI start), FR-2 (static Web UI serve), AD-12 (`.reqor/` bootstrap), AD-14 (CLI packaging).

**Out of scope:** App shell / design tokens (1.5), collections sidebar (1.6), HTTP proxy (1.7), env APIs (Epic 2), history SQLite (Epic 4), README quickstart polish (Epic 5 / week 8).

### Architecture Compliance (MUST follow)

| AD | Requirement for 1.4 |
|----|---------------------|
| AD-2 | `cli → server` only; static plugin lives in server; CLI orchestrates argv, bootstrap, listen |
| AD-6 | Same-origin `:3000` for API + static — no CORS needed; browser never calls targets directly |
| AD-9 | Single Fastify 5.x process hosts REST API + static Web UI via plugins |
| AD-12 | Create `.reqor/` at Repository Root; ensure `.gitignore` entry on first run |
| AD-14 | `@reqor/cli` publishable with `reqor` bin, server dep, bundled `web-dist/` |
| NFR4 | Start ready within 5 seconds |
| NFR12 | Bind `127.0.0.1` only — never `0.0.0.0` |
| NFR13 | Fail fast on port conflict — no auto-increment |

### Dev vs Prod Modes (do not conflate)

| Mode | Command | Web | API | Repository Root |
|------|---------|-----|-----|-----------------|
| Dev | `pnpm turbo dev` | Vite :5173 (proxy `/api` → :3000) | Fastify :3000, **no static** | `resolveRepositoryRoot()` — git walk + `REQOR_REPOSITORY_ROOT` |
| Prod-like | `reqor serve [path]` | Fastify `@fastify/static` from `web-dist` | Same origin :3000 | Explicit `[path]` arg (default cwd) |

[Source: `solution-design.md` §Dev vs prod]

### Current Code State (UPDATE, not NEW)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/cli/src/index.ts` | Stub prints message, exits 0 | Full `serve` command with bootstrap, listen, browser open |
| `packages/cli/package.json` | Basic bin + server dep | Build copies web dist; `files` field; web devDep |
| `packages/server/src/app.ts` | API routes only | Optional `staticRoot` + `@fastify/static` + SPA fallback |
| `packages/server/src/index.ts` | Dev entry with git-root resolution, graceful shutdown | **Minimal change** — export shared constants; keep API-only (no static) |
| `packages/server/src/load-local-env.ts` | Loads `.reqor/local.env` from git root | Export for CLI; call before serve |
| `packages/server/src/resolve-repository-root.ts` | Git walk for dev | **Do not use in CLI serve** — dev-only |
| `packages/web/src/App.tsx` | Fetches `/api/health` | **No changes** — must work when served from :3000 |
| `packages/web/vite.config.ts` | Dev proxy to :3000 | **No changes** — prod build uses default `base: '/'` |

**Do NOT modify:** collection scan/API logic (1.3), parser, app shell UI (1.5).

### Static Serve Implementation Guidance

**Plugin order matters:** Register `/api/*` routes first, then `@fastify/static`, then SPA fallback in `setNotFoundHandler`.

```ts
// Pseudocode — adapt to project ESM + .js extensions
import fastifyStatic from '@fastify/static'

if (options.staticRoot) {
  await app.register(fastifyStatic, {
    root: options.staticRoot,
    prefix: '/',
  })

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      })
    }
    return reply.sendFile('index.html')
  })
}
```

**Anti-pattern:** Do not register static plugin in dev entry — breaks Vite HMR workflow and duplicates asset serving.

**Anti-pattern:** Do not bind `0.0.0.0` — violates NFR12.

### CLI Repository Root Semantics

- `reqor serve` → Repository Root = `process.cwd()` (absolute resolved)
- `reqor serve ./api-tests` → Repository Root = resolved relative path
- Path must exist and be a directory (file path → error)
- Collection scan (Story 1.3) uses this root — `.http` files discovered relative to it
- `.reqor/` created **at Repository Root**, not necessarily git root (user may serve a subdirectory)

### `.reqor/` Bootstrap Rules (AD-12)

- Create `<repositoryRoot>/.reqor/` directory only — do **not** create `history.db` or `config.json` yet (Stories 1.7+ / Epic 4)
- Append to `<repositoryRoot>/.gitignore`:
  ```
  .reqor/
  ```
- If `.gitignore` already has `.reqor/` (anywhere in file), leave unchanged
- If no write permission, fail with readable error

**Note:** Reqor monorepo root `.gitignore` already has `.reqor/` from Story 1.1 — bootstrap must still work for arbitrary target repos.

### Browser Launch

Use Node built-in `child_process.spawn` with `detached: true`, `stdio: 'ignore'`:

| Platform | Command |
|----------|---------|
| win32 | `cmd /c start "" "<url>"` |
| darwin | `open "<url>"` |
| linux | `xdg-open "<url>"` |

Browser open failure should **warn** but not fail serve (FR-1 says "optionally opens").

### Port Conflict Handling

```ts
try {
  await app.listen({ host: '127.0.0.1', port: 3000 })
} catch (err) {
  if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
    console.error('Port 3000 is already in use. Stop the other process or choose a different port.')
    process.exit(1)
  }
  throw err
}
```

No port auto-increment (NFR13). Configurable port is out of scope for 1.4.

### CLI Packaging Layout (AD-14)

After build:

```text
packages/cli/
  dist/index.js          # shebanged bin
  web-dist/              # copied from packages/web/dist
    index.html
    assets/
```

`resolveStaticRoot()` checks `web-dist/` adjacent to compiled CLI code first.

### Testing Standards

- **Framework:** Vitest 3.x; server static tests use `fastify.inject()` (no live port)
- **Fixtures:** Temp dirs for bootstrap tests; minimal `index.html` for static tests
- **CLI:** Prefer unit-testing extracted pure functions; avoid spawning full server in unit tests unless one integration smoke test. Extract browser-launch command construction into a pure function (e.g. `resolveBrowserOpenCommand(url, platform)`) returning the `spawn` args per platform, so win32/darwin/linux branches are unit-testable without actually spawning a browser during `pnpm test`/CI
- **CI:** `pnpm turbo test` must include new tests

### Anti-Patterns (do NOT do)

- Do not use `resolveRepositoryRoot()` in CLI `serve` — explicit path only
- Do not register `@fastify/static` in dev entry (`server/src/index.ts`)
- Do not add CORS plugin — same-origin makes it unnecessary (AD-6)
- Do not implement configurable port, `--no-open`, or `--port` flags unless needed for AC (defer)
- Do not build app shell, sidebar, TanStack Query collections fetch UI — Stories 1.5–1.6
- Do not create `history.db`, `config.json`, or SQLite — later stories
- Do not esbuild-bundle server into CLI single file — workspace/npm dep model is sufficient for AD-14 MVP
- Do not break `pnpm turbo dev` Vite proxy workflow
- Do not write secrets or create `.reqor/secrets.env` vault

### Project Structure Notes

```text
packages/cli/
  scripts/
    copy-web-dist.mjs         # NEW — build-time asset copy
  src/
    index.ts                  # UPDATE — full serve command
    bootstrap-reqor-dir.ts    # NEW — AD-12 first-run setup
    bootstrap-reqor-dir.test.ts
    resolve-static-root.ts    # NEW — locate web-dist
    resolve-static-root.test.ts
    index.test.ts             # UPDATE
  web-dist/                   # GENERATED at build (gitignored in cli? or committed only in publish)
  package.json                # UPDATE

packages/server/src/
  app.ts                      # UPDATE — optional staticRoot
  constants.ts                # NEW (optional) — DEFAULT_HOST/PORT
  static-serve.test.ts        # NEW
  index.ts                    # UPDATE — export constants; keep dev-only behavior
  package.json                # UPDATE — @fastify/static dep + exports

pnpm-workspace.yaml           # UPDATE — @fastify/static catalog entry
turbo.json                    # UPDATE — add "web-dist/**" to build.outputs
.gitignore                    # UPDATE (root, or new packages/cli/.gitignore) — ignore web-dist/
```

### Previous Story Intelligence (1.3)

- `buildApp({ repositoryRoot, scanOnStart? })` scans collections on startup — CLI must pass correct explicit root
- `loadReqorLocalEnv()` loads dev overrides from `<gitRoot>/.reqor/local.env` — call from CLI before listen
- Graceful shutdown pattern in `index.ts` handles SIGINT/SIGTERM/SIGBREAK (Windows) — replicate in CLI
- Collection REST API complete — static UI will eventually call `GET /api/collections` (Story 1.6); for 1.4 verify `/api/health` works from SPA at `:3000`
- Wildcard route `/api/collections/*` already handles slash-containing ids — static fallback must not intercept `/api/*`
- Review fixes applied: symlink escape prevention, atomic refresh, locale-independent ordering — do not regress

### Previous Story Intelligence (1.1)

- `buildApp` exported from `@reqor/server` specifically for CLI reuse in Story 1.4
- CLI bin uses shebang via `scripts/add-shebang.mjs`
- Dev mode: server `tsx watch src/index.ts`, web `vite`, root `turbo run dev --filter=...`
- `.reqor/` already in monorepo `.gitignore` — bootstrap targets user's served repo

### Git Intelligence

Recent commits:

- `00706df` — Windows graceful shutdown, `resolveRepositoryRoot`, `loadReqorLocalEnv`, demo.http
- `075f152` — Story 1.3 collection REST API
- `b07993d` — parser schemeless URL fix

Patterns: ESM + `.js` imports, colocated Vitest tests, story-driven incremental delivery, dev ergonomics fixes land in server entry (keep CLI serve separate).

### Latest Technical Information

- **@fastify/static** — pin catalog entry to the current major (`^10.0.0`; latest published is 10.1.0), not an older major. Fastify 5 compatibility requires `>=8.x`, but 8.x is multiple majors behind — use `root` + `prefix: '/'`; `reply.sendFile()` for SPA fallback
- **Fastify 5 listen** — `{ host: '127.0.0.1', port: 3000 }`; listen errors include `code: 'EADDRINUSE'`
- **Vite 6 build output** — default `dist/index.html` + `dist/assets/*`; no `base` change needed for same-origin serve
- **Node 24** — `import.meta.url` for ESM path resolution in CLI compiled output

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.4, Epic 1]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-9, AD-12, AD-14]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — §Dev vs prod, §Cold start sequence]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/prd.md` — FR-1, FR-2]
- [Source: `_bmad-output/specs/spec-reqor/glossary.md` — Repository Root, `.reqor/`]
- [Source: `_bmad-output/implementation-artifacts/1-3-collection-scan-and-rest-api.md`]
- [Source: `_bmad-output/implementation-artifacts/1-1-scaffold-monorepo-and-development-toolchain.md`]
- [Source: `packages/cli/src/index.ts` — current stub]
- [Source: `packages/server/src/app.ts` — current buildApp]
- [Source: `packages/server/src/index.ts` — dev entry + shutdown pattern]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Fixed CLI typecheck by using `Awaited<ReturnType<typeof buildApp>>` instead of importing `fastify` directly in CLI package.

### Completion Notes List

- Added optional `@fastify/static` serving to `buildApp` with SPA fallback and `/api/*` 404 envelope preservation.
- Implemented full `reqor serve [path]` CLI: path validation, `.reqor/` bootstrap, env load, listen on `127.0.0.1:3000`, browser open, graceful shutdown, and `EADDRINUSE` handling.
- Packaged web assets via `copy-web-dist.mjs` into `packages/cli/web-dist/` with Turbo cache output and `.gitignore` coverage.
- Re-exported `loadReqorLocalEnv`, `DEFAULT_HOST`, and `DEFAULT_PORT` from `@reqor/server` for CLI reuse.
- Added 16 new tests (server static-serve + CLI bootstrap/resolve/args/browser-open); all 91 workspace tests pass.
- Manual smoke verified: `node packages/cli/dist/index.js serve .` serves SPA and `/api/health` from same origin on port 3000.

### File List

- `.gitignore`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `turbo.json`
- `packages/server/package.json`
- `packages/server/src/app.ts`
- `packages/server/src/constants.ts`
- `packages/server/src/index.ts`
- `packages/server/src/static-serve.test.ts`
- `packages/cli/package.json`
- `packages/cli/scripts/copy-web-dist.mjs`
- `packages/cli/src/index.ts`
- `packages/cli/src/index.test.ts`
- `packages/cli/src/bootstrap-reqor-dir.ts`
- `packages/cli/src/bootstrap-reqor-dir.test.ts`
- `packages/cli/src/resolve-static-root.ts`
- `packages/cli/src/resolve-static-root.test.ts`
- `packages/cli/src/browser-open.ts`
- `packages/cli/src/cli-args.ts`

## Change Log

- 2026-07-15: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-15: Validation pass — added `turbo.json` output + `.gitignore` coverage for `web-dist/`, corrected `@fastify/static` version guidance, clarified AD-2 build-order-only devDependency, added browser-open testability guidance
- 2026-07-15: Story 1.4 implemented — CLI `serve` command, static Web UI serving, `.reqor/` bootstrap, packaging, and test suite
