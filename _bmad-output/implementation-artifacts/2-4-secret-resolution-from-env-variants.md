---
baseline_commit: 4f86586
---

# Story 2.4: Secret Resolution from `.env` Variants

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [x] Server loads repo `.env`, `.env.staging`, `.env.local` from Repository Root at startup (read-only; never writes)
- [x] Merge precedence: `.env` base → `.env.staging` overrides → `.env.local` wins (glossary EnvResolver order)
- [x] `EnvResolver.resolveDotenv(key)` returns plaintext value server-side; missing key returns `undefined`
- [x] `redactSecrets()` / `redactObject()` utilities exist and are unit-tested — scaffold for Story 2.5 logging/preview (not wired into production log paths yet)
- [x] `SecretField` web component always renders `SECRET_MASK` (`••••••`) in `text-secret-masked` (`#C4C4C4`) per UX-DR14 — never plaintext
- [x] Active environment variables strip shows JetBrains `isSecret` vars via `SecretField` (non-secret values plaintext)
- [x] No `.reqor/secrets.env` vault created; no writes to repo `.env` files
- [x] `POST /api/execute` unchanged — no send-time substitution yet (Story 2.5)
- [x] `pnpm turbo build test typecheck` passes workspace-wide
- [x] SM-2 fixture gate still ≥45/50 (http-parser untouched / non-regressing)

### Anti-patterns (do not ship)

- Do not resolve `{{host}}`, `{{$uuid}}`, or other env placeholders at send time (Story 2.5)
- Do not change `POST /api/execute` body schema or wire `activeEnvironment` to execute (Story 2.5)
- Do not add pre-send preview panel (Story 2.5)
- Do not return plaintext dotenv values in any HTTP API response
- Do not merge dotenv values into `GET /api/environments` or `to-env-dto.ts` — dotenv stays server-internal until Story 2.5
- Do not treat the environment variables strip as proof of dotenv resolution — strip shows JetBrains env-file vars only
- Do not log plaintext secret values at any level (NFR6) — wire `redactSecrets` into log/preview paths in Story 2.5
- Do not create `.reqor/secrets.env` or store secrets in `config.json`
- Do not conflate `.reqor/local.env` (`load-local-env.ts`) with repo `.env` variants
- Do not change `load-local-env.ts` apply semantics when extracting the shared parser — only set `process.env[key]` when currently `undefined`
- Do not add npm dependencies for dotenv parsing — reuse hand-rolled line parser
- Do not import `@reqor/http-parser` from `@reqor/web`
- Do not invent a second resolver class in Story 2.5 — extend this story’s `EnvResolver` to full glossary merge

## Story

As a **developer with secrets in gitignored `.env` files**,
I want Reqor to resolve secrets server-side without exposing them in the browser,
So that I can authenticate against staging APIs safely.

## Acceptance Criteria

> **Epic AC deferral (intentional):** Epics Story 2.4 wording says *“When the server resolves `{{$dotenv KEY}}` at send time.”* Send-time substitution, preview, and execute wiring belong to **Story 2.5**. This story delivers **startup load + `resolveDotenv` + redaction scaffold + UX-DR14 masking**. Judge this story against the criteria below, not against full send-time resolution.

1. **Given** repo contains `.env`, `.env.local`, or `.env.staging` with secret values  
   **When** the server loads at startup  
   **Then** values are read from existing `.env` variants — Reqor never writes to these files (FR15, SPEC)  
   **And** `EnvResolver.resolveDotenv(KEY)` returns the merged value server-side  
   **And** merge order is `.env.local` > `.env.staging` > `.env` (glossary EnvResolver intra-dotenv precedence)

2. **And** secret values display as `••••••` in secret-masked gray `#C4C4C4` in UI fields (UX-DR14)  
   **And** API responses redact secret values — never return plaintext to browser (AD-7; JetBrains `isSecret` already via `to-env-dto`; dotenv never exposed via API)  
   **And** secrets never appear in logs at any level (NFR6 — utility ready; live log wiring in Story 2.5)  
   **And** no `.reqor/secrets.env` vault is created (SPEC override)

## Tasks / Subtasks

- [x] Task 1: Shared env line parser (AC: #1)
  - [x] 1.1 Extract `parseEnvLine` from `load-local-env.ts` into `packages/server/src/parse-env-line.ts`
  - [x] 1.2 Update `load-local-env.ts` to import shared parser (behavior unchanged — still only set `process.env[key]` when `undefined`)
  - [x] 1.3 Add `parse-env-line.test.ts`

- [x] Task 2: Dotenv store + EnvResolver (AC: #1) — AD-7, AD-20
  - [x] 2.1 Add `packages/server/src/dotenv-store.ts` — load `.env`, `.env.staging`, `.env.local` from repo root; merge with precedence; read-only
  - [x] 2.2 Add `packages/server/src/env-resolver.ts` — `resolveDotenv(key)`, `getSecretValuesForRedaction()` (uses store `getAllValues()`)
  - [x] 2.3 Add `packages/server/src/redact-secrets.ts` — `redactSecrets(text, secrets[])`, `redactObject(obj, secrets[])` (scaffold; not wired into production logs yet)
  - [x] 2.4 Wire `dotenvStore.load(repositoryRoot)` in `app.ts` after environment store load — also when `scanOnStart: false`
  - [x] 2.5 Decorate app with `dotenvStore` and `envResolver`
  - [x] 2.6 Tests: `dotenv-store.test.ts`, `env-resolver.test.ts`, `redact-secrets.test.ts`, `dotenv-integration.test.ts`

- [x] Task 3: Web — SecretField + environment variables strip (AC: #2) — UX-DR14
  - [x] 3.1 Add `packages/web/src/components/SecretField.tsx` — always renders `SECRET_MASK`; ignores plaintext `value` prop
  - [x] 3.2 Add `packages/web/src/components/EnvironmentVariablesStrip.tsx` — lists active **JetBrains** env vars; `SecretField` for `isSecret`
  - [x] 3.3 Thread `environmentVariables` prop through `AppLayout` → `WorkspaceShell` → `RequestLine` (preserve 2.3 toolbar / config ownership)
  - [x] 3.4 Tests: `SecretField.test.tsx`, `EnvironmentVariablesStrip.test.tsx`, extend `RequestLine.test.tsx` / `WorkspaceShell.test.tsx`

- [x] Task 4: Tests & hygiene (AC: all)
  - [x] 4.1 Verify no plaintext secrets in `GET /api/environments` responses (existing `to-env-dto` tests still pass; dotenv never added to that API)
  - [x] 4.2 Run `pnpm turbo build test typecheck`

## Dev Notes

### Two secret systems (do not conflate)

| System | Source | Where plaintext lives | How UI sees it |
|--------|--------|----------------------|----------------|
| **JetBrains env-file vars** | `http-client.env.json` via `EnvironmentStore` | Server AST only | `GET /api/environments` already redacts `isSecret` via `to-env-dto` + `SECRET_MASK`; vars strip uses those DTOs |
| **Repo dotenv** | `.env` / `.env.staging` / `.env.local` via `DotenvStore` | Server Map only (`resolveDotenv`) | **Never** sent to browser in this story; strip does **not** list dotenv keys |

### Implementation decisions (authoritative)

| Decision | Rule |
|----------|------|
| Dotenv file location | Repository Root only: `.env`, `.env.staging`, `.env.local` |
| Merge precedence | Load `.env` first, overlay `.env.staging`, overlay `.env.local` (later wins) = glossary `.env.local` > `.env.staging` > `.env` |
| “Matching” variant | Interpret SPEC “matching `.env` variant” as **merge-all with precedence**, not env-name→filename selection |
| Missing files | Skip silently — not an error |
| Read-only | Never write, create, or modify repo `.env` files |
| `.reqor/local.env` | Unchanged — process env for `REQOR_*` dev overrides only; **different apply rule** than dotenv Map merge |
| Shared parser | `parseEnvLine` / `parseEnvContents` shared; `load-local-env` keeps `if (process.env[key] === undefined)` guard |
| `resolveDotenv` | Returns `string \| undefined`; undefined when key absent |
| `EnvResolver` scope | **Dotenv-only** in this story (`resolveDotenv` + redaction helpers). Glossary full merge (active env file → dotenv) is Story 2.5 — **extend this class**, do not replace |
| API exposure | No endpoint returns plaintext dotenv values; do not fold dotenv into environments DTO |
| Redaction utility | `redactSecrets` / `redactObject` unit-tested scaffold; wire into Pino/preview/execute in Story 2.5 |
| Secret UI mask | `SECRET_MASK` from `@reqor/shared-types`; `SecretField` always renders mask (never plaintext, even if `value` prop passed) |
| Execute path | Unchanged — literal templates including `{{$dotenv KEY}}` until Story 2.5 |
| Startup order | Load env store → dotenv store → config store; dotenv load runs even when `scanOnStart: false` (same pattern as config) |

### Epic Context

Epic 2 (UJ-3): developer selects environment, resolves variables/secrets, previews, sends. **Stories 2.1–2.3** delivered placeholder recognition, env file listing, and config persistence. **Story 2.4** adds repo `.env` variant loading and server-side dotenv resolution infrastructure plus UI secret masking for JetBrains secrets. **Story 2.5** wires full send-time merge (env file → dotenv), pre-send preview, and execute.

### Architecture Compliance (MUST follow)

| AD / FR / UX | Requirement for 2.4 |
|--------------|---------------------|
| AD-7 | Secrets server-side only from repo `.env` variants; API redacts; no vault |
| AD-12 | `.reqor/` holds `history.db` + `config.json` only — no secrets vault |
| AD-20 | Server `EnvResolver` owns dotenv merge now; full env-file→dotenv merge at send time in 2.5; parser only recognizes syntax |
| AD-10 | Reuse `SECRET_MASK` from shared-types; no new secret DTOs unless needed |
| AD-22 | Web imports DTOs only; no parser types |
| FR15 | Load secrets from local env files; masked in UI |
| UX-DR14 | Secret field shows `••••••` in `#C4C4C4`; never plaintext after resolution |
| NFR6 | Never log plaintext secrets — utility scaffold here; enforce on wire paths in 2.5 |

### Scope Boundaries

**In scope:** dotenv file loading; dotenv-only `EnvResolver.resolveDotenv`; redaction utility scaffold; SecretField; environment variables strip for active **JetBrains** env; server startup load; tests.

**Out of scope / do not implement:**
- Send-time substitution in execute → **Story 2.5** (epic “at send time” wording deferred here intentionally)
- Pre-send preview → **Story 2.5**
- Resolve `{{host}}` and other env vars → **Story 2.5**
- Full glossary EnvResolver merge (active env file → dotenv) → **Story 2.5**
- Pass `activeEnvironment` to execute → **Story 2.5**
- Wire `redactSecrets` into Pino / response logging → **Story 2.5**
- History secret redaction → **Epic 4**
- Snippet export redaction → **Epic 5**

### Current Code State (touch points)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/server/src/load-local-env.ts` | Hand-rolled line parse + apply-if-undefined | **UPDATE** — import shared parser; keep apply-if-undefined |
| `packages/server/src/app.ts` | Env + config load; decorate stores | **UPDATE** — dotenv load + decorate `dotenvStore` / `envResolver` (incl. `scanOnStart: false`) |
| `packages/server/src/to-env-dto.ts` | Redacts JetBrains `isSecret` with `SECRET_MASK` | **UNCHANGED** — do not merge dotenv here |
| `packages/server/src/environment-store.ts` | Parsed env AST + redacted list | **UNCHANGED** |
| `packages/server/src/routes/execute.ts` | Literal proxy | **Do not modify** |
| `packages/server/src/config-store.ts` / `routes/config.ts` | Active env persistence | **UNCHANGED** — do not regress `INVALID_ENVIRONMENT` / atomic write |
| `packages/web/src/components/AppHeader.tsx` | Config-backed env select | **UNCHANGED** — header owns mutations |
| `packages/web/src/components/AppLayout.tsx` | Reads config for toolbar | **UPDATE** — derive active env vars; pass strip props down |
| `packages/web/src/components/WorkspaceShell.tsx` / `RequestLine.tsx` | Toolbar env label | **UPDATE** — thread vars strip; preserve null/unavailable toolbar behavior |
| `packages/shared-types` | `SECRET_MASK = '••••••'` | **UNCHANGED** — reuse |

### Previous Story Intelligence (2.3)

- Always load config even when `scanOnStart: false` — apply the same rule to dotenv load
- Dual ownership: `AppHeader` mutates config; `AppLayout` reads for toolbar — do not break null / stale-env / “Environment unavailable” when adding the vars strip
- PUT rejects unknown names with `400 INVALID_ENVIRONMENT`; atomic config write; known-shape rewrite — do not touch while editing `app.ts`
- Execute unchanged until Story 2.5 — still true
- Do not conflate `.reqor/local.env` with JetBrains or repo dotenv
- JetBrains secrets already redacted at API via `to-env-dto` + `SECRET_MASK` — reuse; do not reinvent
- Testing: `app.inject` + temp repository roots; one fetch mock URL router on web; full gate `pnpm turbo build test typecheck`
- Review deferred from 2.3 (concurrent PUT, empty env list orphan) — awareness for 2.5, not in scope here

### Git Intelligence

- `4f86586` — Story 2.3: persist active environment across restarts
- `0a4654e` — Story 2.2: env parsing, `GET /api/environments`, header dropdown
- Patterns to copy: Fastify decorate + startup load; TypeBox DTOs; TanStack Query; `app.inject` temp-dir tests; ESM `.js` imports; colocated Vitest; shared `SECRET_MASK`

### Testing Standards

- Vitest 3.x colocated tests; ESM `.js` suffix imports
- Server: `app.inject` + temp repository roots; write fixture `.env*` files under temp root; assert `resolveDotenv` merge order; assert `/api/environments` never contains dotenv plaintext
- Integration: `dotenv-integration.test.ts` proves server-side resolve + no API leak (intentional extra beyond unit tasks)
- Web: `SecretField` always shows mask; strip renders `isSecret` via `SecretField` and plaintext for non-secrets; extend existing RequestLine / WorkspaceShell tests
- Do not add a second global fetch stub — keep single URL router pattern from 2.2/2.3
- Full gate: `pnpm turbo build test typecheck`
- http-parser fixture gate non-regressing (SM-2)

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.4, FR15]
- [Source: `_bmad-output/specs/spec-reqor/glossary.md` — Secret, EnvResolver merge order]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-7, AD-12, AD-20]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-reqor-2026-07-08/DESIGN.md` — UX-DR14]
- [Source: `_bmad-output/implementation-artifacts/2-3-environment-selection-with-persistence.md`]
- [Source: `packages/server/src/to-env-dto.ts`, `load-local-env.ts`, `routes/execute.ts`]
- [Source: `packages/shared-types` — `SECRET_MASK`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Extracted shared `parseEnvLine` / `parseEnvContents` from `load-local-env.ts` for reuse by dotenv store; preserved apply-if-undefined process-env semantics.
- Implemented `DotenvStore` loading `.env`, `.env.staging`, `.env.local` with merge precedence; read-only, resilient missing-file handling.
- Implemented dotenv-only `EnvResolver.resolveDotenv` and `getSecretValuesForRedaction` for server-internal use (Story 2.5 extends to full glossary merge).
- Added `redactSecrets` / `redactObject` utilities as NFR6 scaffold for Story 2.5 execute/preview/log paths (not wired into production logging yet).
- Wired dotenv load on every app startup (including `scanOnStart: false`); decorated `dotenvStore` and `envResolver` on Fastify app; integration test covers both scan modes.
- Added `SecretField` (always `SECRET_MASK`, UX-DR14) and `EnvironmentVariablesStrip` for active JetBrains env vars (`isSecret` masked).
- Execute path unchanged; integration test confirms dotenv resolves server-side but never leaks via `/api/environments`.
- Full gate passes: `pnpm turbo build test typecheck`; http-parser 75/75 fixture tests.

### File List

- packages/server/src/parse-env-line.ts
- packages/server/src/parse-env-line.test.ts
- packages/server/src/dotenv-store.ts
- packages/server/src/dotenv-store.test.ts
- packages/server/src/env-resolver.ts
- packages/server/src/env-resolver.test.ts
- packages/server/src/redact-secrets.ts
- packages/server/src/redact-secrets.test.ts
- packages/server/src/dotenv-integration.test.ts
- packages/server/src/load-local-env.ts
- packages/server/src/app.ts
- packages/web/src/components/SecretField.tsx
- packages/web/src/components/SecretField.test.tsx
- packages/web/src/components/EnvironmentVariablesStrip.tsx
- packages/web/src/components/EnvironmentVariablesStrip.test.tsx
- packages/web/src/components/RequestLine.tsx
- packages/web/src/components/RequestLine.test.tsx
- packages/web/src/components/WorkspaceShell.tsx
- packages/web/src/components/WorkspaceShell.test.tsx
- packages/web/src/components/AppLayout.tsx
- _bmad-output/implementation-artifacts/2-4-secret-resolution-from-env-variants.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Review Findings

Reviewed via Blind Hunter + Edge Case Hunter + Acceptance Auditor (parallel adversarial review) against this story's scoped ACs. Acceptance Auditor found **zero AC/anti-pattern violations** — merge precedence, read-only guarantee, `to-env-dto` isolation, `load-local-env.ts` apply semantics, UX-DR14 masking, `scanOnStart: false` load, and the full `pnpm turbo build test typecheck` gate all verified correct.

- [x] [Review][Patch] `EnvironmentVariablesStrip` used a truthy check (`variable.isSecret ?`) instead of fail-closed (`!== false`) for secret masking — defensive hardening applied even though the DTO schema (`Type.Boolean()`, required) already guarantees `isSecret` can't be `undefined` today [packages/web/src/components/EnvironmentVariablesStrip.tsx:33] — fixed.
- [x] [Review][Patch] React list key used raw `variable.key`, which would collide on duplicate/empty keys and cause incorrect reconciliation — switched to `` `${variable.key}-${index}` `` [packages/web/src/components/EnvironmentVariablesStrip.tsx:29] — fixed.
- [x] [Review][Defer] `parseEnvLine` has pre-existing gaps (unchanged logic moved from `load-local-env.ts`): no inline-comment stripping, unterminated-quote handling, multi-line quoted values, lone-CR line endings, or whitespace-in-key detection [packages/server/src/parse-env-line.ts] — deferred, pre-existing.
- [x] [Review][Defer] New `dotenvStore`/`envResolver` Fastify decorators have no `declare module 'fastify'` type augmentation, requiring `as unknown as` casts — matches the pre-existing pattern already used for `collectionStore`/`environmentStore`/`configStore` [packages/server/src/app.ts] — deferred, pre-existing pattern.
- [x] [Review][Defer] No file-size/line-count guard when reading repo `.env` variants at every startup (including `scanOnStart: false`) — matches the pre-existing unbounded-read pattern in `EnvironmentStore.readEnvFile` [packages/server/src/dotenv-store.ts] — deferred, pre-existing pattern.
- [x] [Review][Defer] `DotenvStore.load()`'s single-flight `loadQueue` concurrency behavior is untested — mirrors the same untested pattern in `EnvironmentStore.loadAll()` [packages/server/src/dotenv-store.ts] — deferred, pre-existing pattern.

**Dismissed as noise / by design / verified non-issue (11):** no live-reload mechanism for `.env` changes (static startup load is the intended design); read-only guarantee considered sufficiently verified (no `fs.write*` call exists anywhere in `dotenv-store.ts`/`env-resolver.ts`, plus behavioral test); `SecretField`'s unused `value` prop is intentional per UX-DR14 anti-pattern; `.reqor/local.env` (`process.env`) vs `DotenvStore` (`Map`) divergence is the documented two-systems-by-design boundary; `AppLayout`'s stale-environment fallback verified consistent (`activeEnvironment` already resolves to `null` before the vars memo runs, so no divergence exists); `DotenvStore.load()`'s merge loop cannot throw synchronously (`readDotenvFile` already catches all errors, including non-ENOENT, and never rethrows); duplicate environment names in the vars-strip lookup are unreachable (`EnvironmentStore` stores environments in a `Map` keyed by name); `readDotenvFile`'s silent swallow of non-ENOENT errors doesn't violate any stated AC (Acceptance Auditor: "does not violate NFR6 or the plaintext-logging anti-pattern... flagged only for completeness"); `redact-secrets.ts` scaffold gaps (substring-only matching, no array-of-object recursion, non-plain-object mishandling, no circular-ref guard) are explicitly Story 2.5's responsibility per this story's own scope boundaries ("wire `redactSecrets` into Pino/preview/execute in Story 2.5") and the utility is unwired/unused today; narrow integration-test route coverage (`GET /api/environments` only) is low-value since no other route references `dotenvStore`/`envResolver` (verified via codebase search); UI test fixtures using pre-masked data is consistent with `to-dto.test.ts` already covering masking at the DTO layer.

## Change Log

- 2026-07-17: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-17: Story 2.4 implemented — dotenv store, EnvResolver, redaction utils, SecretField, environment variables strip
- 2026-07-17: Story context validated — epic deferral callout, two-secret-systems boundary, previous-story intelligence, testing standards, NFR6 scaffold clarity
- 2026-07-17: Validation patches — `scanOnStart: false` dotenv load test; EnvResolver/redact/SecretField/strip docs aligned to two-secret-systems + 2.5 extend-not-replace
