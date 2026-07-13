---
baseline_commit: f5e87e1c1b434bc84ca9272c4bb78ffaa62328f7
---

# Story 1.1: Scaffold Monorepo and Development Toolchain

Status: done

## Definition of Done

Verify all of the following before marking done:

- [x] `pnpm install` succeeds on Node 24.x
- [x] `pnpm turbo build` produces `dist/` in all buildable packages
- [x] `pnpm turbo test` passes all package smoke tests
- [x] `pnpm turbo typecheck` passes with zero errors
- [x] `pnpm turbo dev` → Vite on :5173, Fastify on :3000
- [x] Browser at `http://localhost:5173` fetches `/api/health` and displays typed response

## Story

As a **developer building Reqor**,
I want a pnpm + Turborepo monorepo with all five packages wired together,
so that the team has a consistent build substrate for CLI, server, web, parser, and shared types.

## Acceptance Criteria

1. **Given** a fresh clone of the reqor repository  
   **When** I run `pnpm install` with Node 24.x  
   **Then** all packages resolve: `packages/cli`, `packages/server`, `packages/web`, `packages/http-parser`, `packages/shared-types`

2. **And** dependency edges follow AD-2: `cli → server`; `server → http-parser, shared-types`; `web → shared-types`; `http-parser` has no server/web deps

3. **And** `pnpm turbo build`, `pnpm turbo test`, and `pnpm turbo typecheck` execute across the workspace without errors

4. **And** `pnpm turbo dev` starts Vite (:5173) proxying API to Fastify (:3000)

5. **And** root `package.json` pins `engines.node` to `>=24 <25` and `"license": "MIT"`

6. **And** shared dependency versions use pnpm `catalog:` protocol (TypeScript, Vitest, Fastify, React, and other cross-package deps)

## Tasks / Subtasks

- [x] Task 1: Initialize monorepo root (AC: #1, #5, #6) — AD-1, AD-15
  - [x] 1.1 Run `pnpm dlx create-turbo@latest` (or equivalent) at repo root, then **delete default `apps/` scaffold** — layout must be `packages/`-only per Structural Seed
  - [x] 1.2 Create `pnpm-workspace.yaml` with `packages/*` and a `catalog:` block (see example below). In pnpm 11, non-auth pnpm settings belong here — not `.npmrc`
  - [x] 1.3 Root `package.json`: `private: true`, `"license": "MIT"`, `packageManager: "pnpm@11.0.0"` (or latest 11.x), `engines.node: ">=24 <25"`, scripts `build`, `test`, `dev`, `typecheck` delegating to `turbo`
  - [x] 1.4 Add root `tsconfig.json` (or `tsconfig.base.json`) with `strict: true`, `moduleResolution: "bundler"`, `module: "ESNext"`, `target: "ES2022"`. Each package `tsconfig.json` extends this base
  - [x] 1.5 Add root `turbo.json` with tasks: `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**"]`), `test` (`dependsOn: ["^build"]`), `dev` (`cache: false`, `persistent: true`), `typecheck` (`dependsOn: ["^build"]`, `outputs: []`)
  - [x] 1.6 **Extend** root `.gitignore` — current file has only BMAD entries and is **missing** `node_modules/`, `dist/`, `.turbo/`. Add those plus `.reqor/` without removing existing BMAD paths
  - [x] 1.7 Add `.nvmrc` or `.node-version` with `24` for contributor consistency

- [x] Task 2: Scaffold `@reqor/shared-types` (AC: #1, #2, #6) — AD-10
  - [x] 2.1 Create `packages/shared-types/package.json`: `name: "@reqor/shared-types"`, `"type": "module"`, `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`
  - [x] 2.2 TypeScript config extending root base; `src/index.ts` exports:
    - `HealthResponse` TypeBox schema + inferred `Static<typeof HealthResponse>` type
    - `ApiErrorEnvelope` schema: `{ error: { code: string, message: string, details?: unknown } }` — establishes API contract pattern for all endpoints
  - [x] 2.3 Dependencies via `catalog:`: `typebox`, `typescript` (dev). Use `@sinclair/typebox` or `typebox` per catalog pin — match Fastify type-provider docs
  - [x] 2.4 Vitest smoke test asserting `HealthResponse` and `ApiErrorEnvelope` exports resolve
  - [x] 2.5 `build` emits `dist/` via `tsc` (preferred for types package)

- [x] Task 3: Scaffold `@reqor/http-parser` (AC: #1, #2) — AD-2, AD-3
  - [x] 3.1 Create package: `"type": "module"`, `"exports"` map, **zero** runtime dependency on `server` or `web`
  - [x] 3.2 `src/index.ts` exports stub:
    ```ts
    export interface ParsedRequest { method: string; url: string }
    export interface Diagnostic { file?: string; line: number; message: string }
    export interface ParseResult { requests: ParsedRequest[]; diagnostics: Diagnostic[] }
    export function parseHttpFile(content: string): ParseResult
    ```
    Real parser logic comes in Story 1.2
  - [x] 3.3 Vitest smoke test: stub returns `{ requests: [], diagnostics: [] }` for empty input
  - [x] 3.4 `build` emits `dist/` via `tsc`

- [x] Task 4: Scaffold `@reqor/server` (AC: #1, #2, #3, #4) — AD-9, AD-10, NFR12
  - [x] 4.1 Dependencies via `workspace:` + `catalog:`: `@reqor/http-parser`, `@reqor/shared-types`, `fastify`, `@fastify/type-provider-typebox`, `typebox`; dev: `tsx`, `vitest`, `typescript`
  - [x] 4.2 Fastify 5 app with TypeBox type provider:
    ```ts
    import Fastify from 'fastify'
    import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
    import { HealthResponse } from '@reqor/shared-types'

    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>()
    app.get('/api/health', {
      schema: { response: { 200: HealthResponse } }
    }, async () => ({ status: 'ok', version: '0.0.0' }))
    ```
  - [x] 4.3 Listen on `host: '127.0.0.1'`, `port: 3000` — never `0.0.0.0` (NFR12)
  - [x] 4.4 `dev` script: `tsx watch src/index.ts`; `build` outputs `dist/`
  - [x] 4.5 Vitest integration test using `fastify.inject()`: `GET /api/health` returns 200 with typed body

- [x] Task 5: Scaffold `@reqor/web` (AC: #1, #2, #3, #4) — AD-10
  - [x] 5.1 Vite 6 + React 19 + TypeScript; dependencies via `catalog:`: `react`, `react-dom`, `@tanstack/react-query`, `@reqor/shared-types` (workspace). Dev: `vitest`, `@testing-library/react`, `@vitejs/plugin-react`, `vite`
  - [x] 5.2 `"type": "module"` + `"exports"` map; install TanStack Query now (AD-10) — wrap `App` in `QueryClientProvider` even if health fetch uses plain `fetch` for this story
  - [x] 5.3 `vite.config.ts`: proxy `/api` → `http://127.0.0.1:3000`; `dev` on port 5173
  - [x] 5.4 Minimal `App.tsx` renders "Reqor" and fetches `/api/health` to prove proxy + typed contract
  - [x] 5.5 Vitest + React Testing Library smoke test for App mount
  - [x] 5.6 `build` outputs `dist/`

- [x] Task 6: Scaffold `@reqor/cli` (AC: #1, #2, #3) — AD-14
  - [x] 6.1 Package: `"type": "module"`, `bin: { "reqor": "./dist/index.js" }`, dependency on `@reqor/server` via `workspace:`
  - [x] 6.2 Entry `src/index.ts` compiled to `dist/index.js` with `#!/usr/bin/env node` shebang prepended at build time
  - [x] 6.3 Stub `serve` command prints "CLI scaffold ready — server start implemented in Story 1.4" and exits 0
  - [x] 6.4 Vitest smoke test for CLI module export
  - [x] 6.5 Do **not** implement full `reqor serve` yet (Story 1.4) — only prove package wiring

- [x] Task 7: Wire Turborepo dev pipeline (AC: #3, #4)
  - [x] 7.1 Per-package `dev` scripts: `@reqor/server` → `tsx watch src/index.ts`; `@reqor/web` → `vite`
  - [x] 7.2 Root `package.json` dev script: `turbo run dev --filter=@reqor/server --filter=@reqor/web`
  - [x] 7.3 `turbo.json` `dev` task: `"cache": false`, `"persistent": true` (no `dependsOn` — run concurrently)
  - [x] 7.4 Verify manually: `pnpm turbo dev` → Vite :5173, Fastify :3000, browser `/api/health` succeeds
  - [x] 7.5 `pnpm turbo build` produces `dist/` in all buildable packages
  - [x] 7.6 `pnpm turbo test` and `pnpm turbo typecheck` pass

- [x] Task 8: CI and documentation (AC: #3, #5)
  - [x] 8.1 Root README: prerequisites (Node 24, pnpm 11), repo structure (`packages/*`), install, build, test, typecheck, dev commands
  - [x] 8.2 Add `.github/workflows/ci.yml`: Node 24 matrix, `pnpm install`, `pnpm turbo build`, `pnpm turbo test`, `pnpm turbo typecheck`

## Dev Notes

### Epic Context

Epic 1 delivers UJ-1: developer runs `reqor serve`, browses `.http` collections, sends a request, sees response. Story 1.1 is the **greenfield foundation** — no user-visible feature yet. Stories 1.2–1.7 build parser, API, CLI, and UI on this substrate.

**This story creates NEW files only.** The repo currently has planning artifacts (`_bmad-output/`) and BMAD config — no `packages/` directory exists.

### Architecture Compliance (MUST follow)

| AD | Requirement for 1.1 |
|----|---------------------|
| AD-1 | pnpm 11.x workspaces + Turborepo 2.x; packages at `packages/{cli,server,web,http-parser,shared-types}` |
| AD-2 | Dependency edges: `cli→server`, `server→http-parser+shared-types`, `web→shared-types`; parser isolated |
| AD-9 | Single Fastify 5.x runtime (health endpoint only in this story) |
| AD-10 | TypeBox schemas in `shared-types`; server uses `@fastify/type-provider-typebox`; web installs TanStack Query |
| AD-15 | `engines.node: ">=24 <25"` in root package.json |

### Stack Versions (pin via pnpm `catalog:`)

| Package | Version | Used in |
|---------|---------|---------|
| Node.js | 24.x | all |
| pnpm | 11.x | workspace |
| Turborepo | 2.x | root |
| TypeScript | 5.9.x | all packages |
| Fastify | 5.x | server |
| @fastify/type-provider-typebox | 5.x | server |
| TypeBox | 0.34.x | shared-types, server |
| React / react-dom | 19.x | web |
| @tanstack/react-query | 5.x | web |
| Vite / @vitejs/plugin-react | 6.x | web |
| Vitest | 3.x | all packages |
| @testing-library/react | 16.x | web |
| tsx | 4.x | server dev |

### Example `pnpm-workspace.yaml` catalog

```yaml
packages:
  - 'packages/*'

catalog:
  typescript: ~5.9.0
  vitest: ^3.0.0
  '@types/node': ^24.0.0
  tsx: ^4.0.0
  fastify: ^5.0.0
  '@fastify/type-provider-typebox': ^5.0.0
  typebox: ^0.34.0
  react: ^19.0.0
  react-dom: ^19.0.0
  '@tanstack/react-query': ^5.0.0
  vite: ^6.0.0
  '@vitejs/plugin-react': ^4.0.0
  '@testing-library/react': ^16.0.0
```

Package `package.json` deps reference catalog: `"typescript": "catalog:"`, `"fastify": "catalog:"`, etc.

### Target Project Structure

```text
reqor/
  packages/
    cli/              # @reqor/cli — bin stub with shebang
    server/           # @reqor/server — Fastify + TypeBox health endpoint
    web/              # @reqor/web — Vite+React stub + TanStack Query provider
    http-parser/      # @reqor/http-parser — parse stub (ParseResult types)
    shared-types/     # @reqor/shared-types — HealthResponse + ApiErrorEnvelope
  tsconfig.json       # base config extended by all packages
  pnpm-workspace.yaml # packages + catalog
  turbo.json
  package.json        # MIT license, engines, turbo scripts
  .nvmrc
  .github/workflows/ci.yml
```

### Scaffolding Approach

Solution design recommends: `pnpm dlx create-turbo@latest` then reshape to packages-only layout. **Drop the default `apps/` directory** — Reqor uses `packages/` exclusively.

- Internal deps: `"@reqor/server": "workspace:*"` — never file paths or npm versions
- All packages: `"type": "module"` with explicit `"exports"` maps
- pnpm 11: workspace settings in `pnpm-workspace.yaml`, not `package.json#pnpm` or `.npmrc` (auth/registry only)

### Dev vs Prod Modes (establish now)

| Mode | Command | Behavior |
|------|---------|----------|
| Dev | `pnpm turbo dev` | Vite :5173 with `/api` proxy → Fastify :3000 |
| Prod-like | `reqor serve` (Story 1.4) | Single process serves API + static dist |

Story 1.1 only needs dev mode. Do not implement `@fastify/static` or CLI server start yet.

### Testing Standards

- **Framework:** Vitest 3.x in every package
- **Story 1.1 scope:** Smoke tests only — build graph, exports, health endpoint via `fastify.inject()`
- **No parser fixtures yet** — Story 1.2 adds the 50-file corpus
- **CI gate:** `pnpm turbo build && pnpm turbo test && pnpm turbo typecheck`

### Anti-Patterns (do NOT do)

- Do not use `npm` or `yarn` — pnpm only
- Do not violate AD-2 dependency edges (`web→server`, `http-parser→server`, etc.)
- Do not implement parser logic, collection scan, proxy, or full CLI serve — later stories
- Do not add Redux, Next.js, Express, or alternate HTTP frameworks
- Do not create `apps/` directory or commit `node_modules/` / `dist/`
- Do not bind Fastify to `0.0.0.0` — `127.0.0.1` only
- Do not put pnpm workspace config in `.npmrc` — use `pnpm-workspace.yaml` (pnpm 11)

### Project Structure Notes

- Aligns with ARCHITECTURE-SPINE Structural Seed exactly
- `.reqor/` gitignore entry prepares for Story 1.4 CLI first-run behavior
- Current `.gitignore` is BMAD-only — must add standard Node/build entries (Task 1.6)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-10, AD-15, Structural-Seed, Stack]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md#9-Build-and-CI, #13-What-comes-next]
- [Source: _bmad-output/specs/spec-reqor/SPEC.md#Constraints — Monorepo + strict dependency direction]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-07-08.md#Starter-template-check]
- [Source: pnpm.io/catalogs — `catalog:` protocol]
- [Source: fastify.dev Type Providers — `@fastify/type-provider-typebox`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Split `@reqor/server` into `app.ts` (buildApp export) + `index.ts` (dev entry) so `tsx watch` starts Fastify reliably
- Added `allowBuilds.esbuild: true` in `pnpm-workspace.yaml` for pnpm 11 build-script approval

### Completion Notes List

- Scaffolded pnpm 11 + Turborepo 2 monorepo with five packages under `packages/` (manual equivalent to create-turbo)
- All acceptance criteria satisfied: catalog deps, AD-2 edges, build/test/typecheck/dev pipeline
- `pnpm install`, `pnpm turbo build`, `pnpm turbo test`, `pnpm turbo typecheck` all pass on Node 24.16.0
- Dev verified: Fastify on 127.0.0.1:3000, Vite on :5173 proxying `/api/health` → `{"status":"ok","version":"0.0.0"}`
- Smoke tests: 6 total across all packages (shared-types 2, http-parser 1, server 1, web 1, cli 1)

### File List

- package.json
- pnpm-workspace.yaml
- pnpm-lock.yaml
- tsconfig.json
- turbo.json
- .nvmrc
- .gitignore
- README.md
- .github/workflows/ci.yml
- packages/shared-types/package.json
- packages/shared-types/tsconfig.json
- packages/shared-types/vitest.config.ts
- packages/shared-types/src/index.ts
- packages/shared-types/src/index.test.ts
- packages/http-parser/package.json
- packages/http-parser/tsconfig.json
- packages/http-parser/vitest.config.ts
- packages/http-parser/src/index.ts
- packages/http-parser/src/index.test.ts
- packages/server/package.json
- packages/server/tsconfig.json
- packages/server/vitest.config.ts
- packages/server/src/app.ts
- packages/server/src/index.ts
- packages/server/src/index.test.ts
- packages/web/package.json
- packages/web/tsconfig.json
- packages/web/tsconfig.node.json
- packages/web/vite.config.ts
- packages/web/vitest.config.ts
- packages/web/index.html
- packages/web/src/vite-env.d.ts
- packages/web/src/main.tsx
- packages/web/src/App.tsx
- packages/web/src/App.test.tsx
- packages/cli/package.json
- packages/cli/tsconfig.json
- packages/cli/vitest.config.ts
- packages/cli/scripts/add-shebang.mjs
- packages/cli/src/index.ts
- packages/cli/src/index.test.ts

## Change Log

- 2026-07-09: Story context created by bmad-create-story workflow
- 2026-07-10: Story context refined — TypeScript base, pnpm catalog protocol, TypeBox/Fastify pattern, error envelope, turbo dev wiring, CI workflow
- 2026-07-10: Story 1.1 implemented — monorepo scaffold, five packages, CI workflow, all smoke tests passing
