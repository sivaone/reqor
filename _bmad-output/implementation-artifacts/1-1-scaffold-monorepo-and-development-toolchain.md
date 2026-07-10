# Story 1.1: Scaffold Monorepo and Development Toolchain

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer building Reqor**,
I want a pnpm + Turborepo monorepo with all five packages wired together,
so that the team has a consistent build substrate for CLI, server, web, parser, and shared types.

## Acceptance Criteria

1. **Given** a fresh clone of the reqor repository  
   **When** I run `pnpm install` with Node 24.x  
   **Then** all packages resolve: `packages/cli`, `packages/server`, `packages/web`, `packages/http-parser`, `packages/shared-types`

2. **And** dependency edges follow AD-2: `cli → server`; `server → http-parser, shared-types`; `web → shared-types`; `http-parser` has no server/web deps

3. **And** `pnpm turbo build` and `pnpm turbo test` execute across the workspace without errors

4. **And** `pnpm turbo dev` starts Vite (:5173) proxying API to Fastify (:3000)

5. **And** root `package.json` pins `engines.node` to `>=24 <25`

6. **And** shared dependency versions use pnpm catalogs (TypeScript, Vitest, and other cross-package deps)

## Tasks / Subtasks

- [ ] Task 1: Initialize monorepo root (AC: #1, #5, #6)
  - [ ] 1.1 Run `pnpm dlx create-turbo@latest` (or equivalent) at repo root, then **delete default `apps/` scaffold** — layout must be `packages/`-only per Structural Seed
  - [ ] 1.2 Create `pnpm-workspace.yaml` with `packages/*`
  - [ ] 1.3 Root `package.json`: `private: true`, `packageManager: "pnpm@11.x"`, `engines.node: ">=24 <25"`, scripts `build`, `test`, `dev`, `typecheck` delegating to `turbo`
  - [ ] 1.4 Add `pnpm-workspace.yaml` `catalog:` block for shared versions (TypeScript 5.9.x, Vitest 3.x, `@types/node`, etc.)
  - [ ] 1.5 Add root `turbo.json` with tasks: `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**"]`), `test` (`dependsOn: ["^build"]`), `dev` (`cache: false`, `persistent: true`), `typecheck`
  - [ ] 1.6 Add root `.gitignore` entries for `node_modules`, `dist`, `.turbo`, `.reqor` (do not remove existing BMAD entries)
  - [ ] 1.7 Add `.nvmrc` or `.node-version` with `24` for contributor consistency

- [ ] Task 2: Scaffold `@reqor/shared-types` (AC: #1, #2)
  - [ ] 2.1 Create `packages/shared-types/package.json` (`name: "@reqor/shared-types"`, `type: "module"`)
  - [ ] 2.2 TypeScript config extending root; `src/index.ts` exporting a placeholder DTO type (e.g. `HealthResponse`)
  - [ ] 2.3 Add TypeBox 0.34.x as dependency; export at least one schema stub for future API contract
  - [ ] 2.4 Vitest smoke test asserting package exports resolve
  - [ ] 2.5 `build` emits `dist/` via `tsc` or `tsup`

- [ ] Task 3: Scaffold `@reqor/http-parser` (AC: #1, #2)
  - [ ] 3.1 Create package with **zero** runtime dependency on `server` or `web`
  - [ ] 3.2 `src/index.ts` exports stub `parseHttpFile(content: string): { requests: [] }` (real parser comes in Story 1.2)
  - [ ] 3.3 Vitest smoke test for stub export
  - [ ] 3.4 Verify `package.json` has no `@reqor/server` or `@reqor/web` in dependencies

- [ ] Task 4: Scaffold `@reqor/server` (AC: #1, #2, #3, #4)
  - [ ] 4.1 Dependencies: `@reqor/http-parser`, `@reqor/shared-types` via `workspace:` protocol; Fastify 5.x
  - [ ] 4.2 Minimal Fastify app on port 3000 with `GET /api/health` returning typed response from shared-types
  - [ ] 4.3 `dev` script uses `tsx watch` or `node --watch` on entry; `build` outputs `dist/`
  - [ ] 4.4 Vitest integration test: start app (or use `fastify.inject`) and assert health endpoint returns 200
  - [ ] 4.5 Bind `localhost` only (NFR12 precursor)

- [ ] Task 5: Scaffold `@reqor/web` (AC: #1, #2, #3, #4)
  - [ ] 5.1 Vite 6.x + React 19.x + TypeScript; dependency on `@reqor/shared-types` only (not server)
  - [ ] 5.2 `vite.config.ts` proxy `/api` → `http://localhost:3000`
  - [ ] 5.3 Minimal `App.tsx` renders "Reqor" and fetches `/api/health` via fetch to prove proxy works
  - [ ] 5.4 `dev` on port 5173; `build` outputs `dist/`
  - [ ] 5.5 Vitest + React Testing Library smoke test for App mount

- [ ] Task 6: Scaffold `@reqor/cli` (AC: #1, #2, #3)
  - [ ] 6.1 Package with `bin: { "reqor": "./dist/index.js" }`; dependency on `@reqor/server` via `workspace:`
  - [ ] 6.2 Stub `serve` command that prints "CLI scaffold ready — server start implemented in Story 1.4" and exits 0
  - [ ] 6.3 `build` bundles or compiles entry; Vitest smoke test for CLI module export
  - [ ] 6.4 Do **not** implement full `reqor serve` yet (Story 1.4) — only prove package wiring

- [ ] Task 7: Wire Turborepo dev pipeline (AC: #3, #4)
  - [ ] 7.1 Configure `turbo dev` to run `server` and `web` packages concurrently
  - [ ] 7.2 Verify manually: `pnpm turbo dev` → Vite on :5173, Fastify on :3000, browser fetch to `/api/health` succeeds
  - [ ] 7.3 `pnpm turbo build` produces `dist/` in all buildable packages
  - [ ] 7.4 `pnpm turbo test` passes all package smoke tests

- [ ] Task 8: CI-ready scripts and documentation (AC: #3, #5)
  - [ ] 8.1 Root README section: prerequisites (Node 24, pnpm 11), install, build, test, dev commands
  - [ ] 8.2 Optional: `.github/workflows/ci.yml` running `pnpm install`, `pnpm turbo build`, `pnpm turbo test` on Node 24 (recommended per readiness report minor concern #3)

## Dev Notes

### Epic Context

Epic 1 delivers UJ-1: developer runs `reqor serve`, browses `.http` collections, sends a request, sees response. Story 1.1 is the **greenfield foundation** — no user-visible feature yet. Stories 1.2–1.7 build parser, API, CLI, and UI on this substrate.

**This story creates NEW files only.** The repo currently has planning artifacts (`_bmad-output/`) and BMAD config — no `packages/` directory exists.

### Architecture Compliance (MUST follow)

| AD | Requirement for 1.1 |
|----|---------------------|
| AD-1 | pnpm 11.x workspaces + Turborepo 2.x; packages at `packages/{cli,server,web,http-parser,shared-types}` |
| AD-2 | Dependency edges: `cli→server`, `server→http-parser+shared-types`, `web→shared-types`; parser isolated |
| AD-15 | `engines.node: ">=24 <25"` in root package.json |
| AD-10 | TypeBox in shared-types from day one (schemas stubbed, used by server health endpoint) |

### Stack Versions (pin via pnpm catalog)

| Package | Version |
|---------|---------|
| Node.js | 24.x |
| pnpm | 11.x |
| Turborepo | 2.x |
| TypeScript | 5.9.x |
| Fastify | 5.x |
| TypeBox | 0.34.x |
| React | 19.x |
| Vite | 6.x |
| Vitest | 3.x |

### Target Project Structure

```text
reqor/
  packages/
    cli/              # @reqor/cli — bin stub
    server/           # @reqor/server — Fastify health endpoint
    web/              # @reqor/web — Vite+React stub
    http-parser/      # @reqor/http-parser — parse stub
    shared-types/     # @reqor/shared-types — DTO + TypeBox stub
  pnpm-workspace.yaml
  turbo.json
  package.json
  .nvmrc
```

### Scaffolding Approach

Solution design recommends: `pnpm dlx create-turbo@latest` then reshape to packages-only layout. **Drop the default `apps/` directory** — Reqor uses `packages/` exclusively.

Internal package references must use `"@reqor/server": "workspace:*"` (or equivalent workspace protocol), never file paths or npm versions.

### Dev vs Prod Modes (establish now)

| Mode | Command | Behavior |
|------|---------|----------|
| Dev | `pnpm turbo dev` | Vite :5173 with `/api` proxy → Fastify :3000 |
| Prod-like | `reqor serve` (Story 1.4) | Single process serves API + static dist |

Story 1.1 only needs dev mode working. Do not implement `@fastify/static` or CLI server start yet.

### Testing Standards

- **Framework:** Vitest 3.x in every package
- **Story 1.1 scope:** Smoke tests only — prove build graph, exports, and health endpoint
- **No parser fixtures yet** — Story 1.2 adds the 50-file corpus
- **CI gate:** `pnpm turbo build && pnpm turbo test` must pass before marking done

### Anti-Patterns (do NOT do)

- Do not use `npm` or `yarn` — pnpm only
- Do not add `web → server` or `http-parser → server` dependencies
- Do not implement parser logic, collection scan, or proxy — later stories
- Do not add Redux, Next.js, Express, or alternate HTTP frameworks — Fastify 5.x only
- Do not create `apps/` directory — packages-only monorepo
- Do not commit `node_modules/` or `dist/` (gitignored)

### Project Structure Notes

- Aligns with ARCHITECTURE-SPINE Structural Seed exactly
- License: MIT (per epics Additional Requirements) — add to root `package.json`
- `.reqor/` gitignore entry prepares for Story 1.4 CLI first-run behavior
- Existing `.gitignore` has BMAD paths — extend, do not replace

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-15, Structural-Seed, Stack]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md#9-Build-and-CI, #13-What-comes-next]
- [Source: _bmad-output/specs/spec-reqor/SPEC.md#Constraints — Monorepo + strict dependency direction]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-07-08.md#Starter-template-check]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-09: Story context created by bmad-create-story workflow
