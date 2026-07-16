---
baseline_commit: 61fa8eb
---

# Story 2.1: Variable and Dynamic Placeholder Parsing

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Definition of Done

- [ ] `pnpm --filter @reqor/http-parser test build` passes with new variable scanner tests
- [ ] `pnpm turbo build test typecheck` pass workspace-wide (no regressions from Epic 1)
- [ ] SM-2 fixture gate still ≥45/50 pass (no regression from structured variable work)
- [ ] All round-trip tests still pass — placeholders remain literal in url/headers/body fields
- [ ] `scanVariables` / `collectRequestVariables` exported from `@reqor/http-parser` public API
- [ ] Each dynamic type (`$uuid`, `$timestamp`, `$randomInt`, `$dotenv`) has dedicated unit test coverage including mixed-case builtins
- [ ] `parseHttpFile` output shape unchanged — no `variables` on `ParseResult` / `ParsedRequest`
- [ ] No variable **resolution** at send time, no env file parsing, no web/server API changes

### Anti-patterns (do not ship)

- Do not generate uuid / timestamp / randomInt values
- Do not substitute placeholders in AST or DTO fields
- Do not add `variables[]` to `RequestDto` / shared-types
- Do not modify `packages/server`, `packages/web`, `packages/shared-types`, `packages/cli`
- Do not add runtime deps to `@reqor/http-parser`
- Do not emit `VariableReference` for OUT dynamics (`$random.integer(...)`, `$isoTimestamp`, `$random.uuid`, etc.)

## Story

As a **developer using JetBrains variable syntax in my `.http` files**,
I want Reqor to recognize variable placeholders and dynamic generators,
So that my existing templated requests parse correctly and downstream stories can resolve them safely.

## Acceptance Criteria

1. **Given** a `.http` file containing `{{host}}`, `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, or `{{$dotenv KEY}}`  
   **When** `parseHttpFile` produces a `ParsedRequest` and the caller runs `collectRequestVariables` (or `scanVariables` on a field)  
   **Then** placeholders are recognized in URL, header **values**, and body content (FR6)  
   **And** recognition is via the exported scanner API — **not** a new field on `ParseResult` / `ParsedRequest`, and **not** mutation of stored template strings

2. **And** `$uuid`, `$timestamp`, `$randomInt` are classified as built-in dynamic variables per `dialect-matrix.md` IN scope (bare forms only)

3. **And** `{{$dotenv KEY}}` references are recognized with extracted key name for server-side resolution in Story 2.4 (FR6) — **not resolved in this story**

4. **And** parser unit tests cover each dynamic variable type individually plus simple env placeholders in url/header/body

5. **And** existing literal preservation behavior from Story 1.2 is unchanged — url/header/body strings still contain original `{{…}}` text for round-trip serialize

## Tasks / Subtasks

- [ ] Task 1: Define variable reference model (AC: #1–#3) — AD-3, FR6
  - [ ] 1.1 Add types in `packages/http-parser/src/variables.ts` (re-export from `ast.ts` or `index.ts` as needed):
    ```typescript
    export type VariableKind =
      | 'env'        // {{host}}, {{token}} — resolved from active environment (Story 2.5)
      | 'uuid'       // {{$uuid}}
      | 'timestamp'  // {{$timestamp}}
      | 'randomInt'  // {{$randomInt}} bare form only
      | 'dotenv'     // {{$dotenv KEY}} — resolved from repo .env variants (Story 2.4)

    /** Which ParsedRequest field the placeholder was scanned from */
    export type VariableLocation =
      | { part: 'url' }
      | { part: 'header'; index: number } // index into request.headers
      | { part: 'body' }

    export interface VariableReference {
      kind: VariableKind
      /** Env var name or dotenv KEY; for builtins use 'uuid' | 'timestamp' | 'randomInt' */
      name: string
      /** Exact matched placeholder substring, e.g. "{{host}}" or "{{$dotenv API_KEY}}" */
      raw: string
      /** 0-based start index within the scanned field string (url / header value / body content) */
      start: number
      /** 0-based end index (exclusive) within that same field string */
      end: number
      /** Field provenance — required so Story 2.5 can replace by offset without colliding across fields */
      location: VariableLocation
    }
    ```
  - [ ] 1.2 Export types + scanner functions from `packages/http-parser/src/index.ts`
  - [ ] 1.3 Do **not** add variable fields to `@reqor/shared-types` `RequestDto` — API exposure waits for Story 2.5 (AD-22)

- [ ] Task 2: Implement variable scanner (AC: #1–#3) — FR6, dialect-matrix
  - [ ] 2.1 Create `packages/http-parser/src/variables.ts` with pure functions:
    - `scanVariables(text: string, location: VariableLocation): VariableReference[]` — find all `{{…}}` placeholders in one field string; every ref carries the same `location`
    - `collectRequestVariables(request: ParsedRequest): VariableReference[]` — scan url, every header **value** (in order), then body content; concatenate in that order. **No cross-field dedupe** — left-to-right scan already unique within a field
  - [ ] 2.2 Matching rules (**authoritative — implement exactly; sample code below must match these rules**):
    - Pattern: `/\{\{([^}]*)\}\}/g` — reject empty `{{}}`
    - Trim inner whitespace before classification: `{{ host }}` → env name `host`
    - Classification order (first match wins):
      1. Inner matches `/^\$uuid$/i` → kind `uuid`, name `uuid`
      2. Inner matches `/^\$timestamp$/i` → kind `timestamp`, name `timestamp`
      3. Inner matches `/^\$randomInt$/i` → kind `randomInt`, name `randomInt` (**bare only** — `$randomInt(0,10)` / `$random.integer(...)` → no emit)
      4. Inner matches `/^\$dotenv\s+(.+)$/i` → kind `dotenv`, name = captured KEY trimmed (e.g. `API_KEY`, `API_TOKEN`; allow space in KEY)
      5. Inner matches `/^\$oauth/i` → **do not emit** (must stay equivalent to `parse.ts` `OAUTH_PATTERN = /\{\{\s*\$oauth/i` — prefer shared constant or comment both must match)
      6. Inner matches `/^[\w.-]+$/` → kind `env`, name = inner trimmed (preserve original casing)
      7. Otherwise → **do not emit**, **no new diagnostic** (malformed `{{…}}`, unknown `$isoTimestamp`, `$random.uuid`, `$random.integer(...)`, empty `{{$dotenv}}`, etc.)
  - [ ] 2.3 Overlapping matches: scan left-to-right; after a match, continue past `end` (prefer `String.prototype.matchAll` with a fresh regex, or reset `lastIndex` each call)
  - [ ] 2.4 Case sensitivity: `$uuid` / `$timestamp` / `$randomInt` / `$dotenv` token match is case-insensitive; env var **names** preserve source casing
  - [ ] 2.5 Zero runtime dependencies — hand-rolled scanner only (AD-3)
  - [ ] 2.6 Do **not** scan header names, comments, or separator titles — FR6 scope is url, header values, body

- [ ] Task 3: Keep parse pipeline unchanged (AC: #1, #5)
  - [ ] 3.1 **Do not mutate** `ParsedRequest.url` / header values / body content — recognition is side-channel via scanner only
  - [ ] 3.2 **Do not** add `variables` to `ParseResult` or change `parseHttpFile` return shape
  - [ ] 3.3 Defer `collectParseResultVariables` — Story 2.5 can map `result.requests` itself
  - [ ] 3.4 Verify existing `parse.test.ts` "preserves variable placeholders literally" still passes unchanged
  - [ ] 3.5 `serialize.ts` and `diagnostics.ts` behavior unchanged; `astEquivalent` must not start comparing variable arrays

- [ ] Task 4: Unit tests (AC: #4) — NFR10 support
  - [ ] 4.1 Create `packages/http-parser/src/variables.test.ts`:
    - `{{host}}` in URL → one `env` ref, name `host`, `location.part === 'url'`
    - `{{token}}` in header value → `env`, `location: { part: 'header', index: N }`
    - `{{body}}` in body content → `env`, `location.part === 'body'`
    - `{{$uuid}}` alone and embedded in query string
    - `{{$timestamp}}` in URL
    - `{{$randomInt}}` and mixed-case `{{$RandomInt}}` → `randomInt`
    - `{{$dotenv API_KEY}}` and `{{$dotenv API_TOKEN}}` (fixture 44 uses `API_TOKEN`) → kind `dotenv`, correct name
    - Multiple placeholders in one string → ordered refs with correct `start`/`end` relative to that field
    - Same offset in url and a header → distinct refs distinguished by `location` (not colliding)
    - `{{ host }}` whitespace trim → name `host`
    - `{{$oauth.token}}` → **not** in scan results (OAuth OUT; parse still emits `UNSUPPORTED_CONSTRUCT`)
    - Unknown / OUT inners → no ref: `{{not valid!}}`, `{{$isoTimestamp}}`, `{{$random.integer(1,10)}}`, `{{$randomInt(0,5)}}`, `{{$dotenv}}`
  - [ ] 4.2 Integration-style test (`parse.test.ts` or `variables.test.ts`):
    ```typescript
    const result = parseHttpFile(`GET https://{{host}}/api?id={{$uuid}}
    Authorization: Bearer {{token}}
    X-Secret: {{$dotenv API_TOKEN}}

    {"user":"{{name}}"}`)
    const results = collectRequestVariables(result.requests[0]!)
    // assert kinds/names/locations across url, headers, body
    ```
  - [ ] 4.3 Optional: export smoke test that `scanVariables` / `collectRequestVariables` are public from `index.js`
  - [ ] 4.4 Extend `roundtrip.test.ts` only if needed — existing "variables preserved" case must still pass
  - [ ] 4.5 Run full fixture gate — must remain ≥45/50 (corpus: `15-ktor-variables`, `28-intellij-uuid-var`, `29-intellij-timestamp`, `30-intellij-random`, `44-dotenv-var`, `48-out-oauth-with-request`)

- [ ] Task 5: Package hygiene (AC: all)
  - [ ] 5.1 Confirm `@reqor/http-parser` still has **zero** runtime `dependencies`
  - [ ] 5.2 Run `pnpm turbo build test typecheck`
  - [ ] 5.3 Do **not** modify `packages/server`, `packages/web`, `packages/shared-types`, `packages/cli`

## Dev Notes

### Epic Context

Epic 2 delivers UJ-3: developer selects an environment, resolves variables/secrets, previews resolved request, sends confidently. **Story 2.1 is the parser foundation** — structured recognition of JetBrains placeholders. Stories 2.2–2.5 build env loading, selection, secret resolution, and send-time substitution on top of this API.

**Epic 1 is complete** (1.1–1.7 done). Parser already preserves `{{…}}` as literal substrings (Story 1.2 Task 2.5). This story adds **typed extraction** without changing stored template strings.

### Architecture Compliance (MUST follow)

| AD / FR | Requirement for 2.1 |
|---------|---------------------|
| AD-3 | Variable scanning lives in `@reqor/http-parser` only; zero runtime deps |
| AD-17 | OAuth `{{$oauth…}}` stays OUT — scanner must not classify as IN variable |
| AD-20 | Parser recognizes syntax; **server owns merge/resolution** — not in 2.1 |
| AD-22 | Parser exports AST + scanner types; API DTOs unchanged until 2.5 |
| FR6 | Recognize placeholders in url, header values, bodies |

### In Scope vs Out of Scope

**In scope:** FR6 placeholder **recognition**; `VariableReference` model with `location`; `scanVariables` / `collectRequestVariables`; unit tests per dynamic type; preserve literal AST fields + round-trip.

**Out of scope / do not implement:**
- Substituting/resolving values at parse or send time → **Story 2.5**
- Generating uuid / timestamp / randomInt values → **Story 2.5**
- `http-client.env.json` parsing → **Story 2.2**
- `.env` file loading / `{{$dotenv}}` value resolution → **Story 2.4**
- Environment selector UI → **Story 2.3**
- Send disabled on unresolved vars / pre-send preview → **Story 2.5**
- Adding `variables[]` to `RequestDto` or collections API → **Story 2.5**
- Web UI changes → none
- Changing `POST /api/execute` behavior → still sends literal templates from DTO (1.7 until 2.5)
- New diagnostics for unknown / OUT `{{…}}` inners (except existing OAuth path in `parse.ts`)
- JetBrains OUT dynamics: `$isoTimestamp`, `$random.uuid`, `$random.integer(from,to)`, `$random.email`, etc.

### Variable Kind Reference (dialect-matrix IN only)

| Source syntax | kind | name field | Resolved in |
|---------------|------|------------|-------------|
| `{{host}}` | `env` | `host` | Story 2.5 |
| `{{$uuid}}` | `uuid` | `uuid` | Story 2.5 (generated at send) |
| `{{$timestamp}}` | `timestamp` | `timestamp` | Story 2.5 |
| `{{$randomInt}}` | `randomInt` | `randomInt` | Story 2.5 |
| `{{$dotenv API_KEY}}` | `dotenv` | `API_KEY` | Story 2.4 + 2.5 |
| `{{$oauth.token}}` | — | — | OUT (1.2 `UNSUPPORTED_CONSTRUCT`) |
| `{{$random.integer(1,10)}}` etc. | — | — | OUT of matrix — no emit |

[Source: `_bmad-output/specs/spec-reqor/dialect-matrix.md`]

### Current Code State (UPDATE)

| File | Current state | This story changes |
|------|---------------|-------------------|
| `packages/http-parser/src/ast.ts` | Request AST only | Optional re-export of variable types |
| `packages/http-parser/src/parse.ts` | Preserves literals; `OAUTH_PATTERN` | **No behavioral change** to parse output |
| `packages/http-parser/src/variables.ts` | — | **NEW** scanner + types |
| `packages/http-parser/src/index.ts` | parse + serialize exports | Export variable API |
| `packages/http-parser/src/serialize.ts` | Literal rewrite | **Do not change** |
| `packages/http-parser/src/diagnostics.ts` | Diagnostic helpers | **Do not change** |
| `packages/http-parser/src/parse.test.ts` | Literal preservation test | Optional integration assert |
| `packages/server/src/to-dto.ts` | Maps parser → RequestDto | **Do not modify** |
| `packages/server/src/proxy/execute-request.ts` | Sends literal url/headers/body | **Do not modify** |

### Scanner Implementation Guide

Task 2.2 rules are authoritative. Sample below must match them (especially `$randomInt` case-folding and `location`).

```typescript
// variables.ts — illustrative; implement with exhaustive tests

export function scanVariables(
  text: string,
  location: VariableLocation,
): VariableReference[] {
  const refs: VariableReference[] = []
  const re = /\{\{([^}]*)\}\}/g
  for (const match of text.matchAll(re)) {
    const raw = match[0]
    const inner = match[1]!.trim()
    if (!inner) continue
    const start = match.index!
    const end = start + raw.length
    const classified = classifyInner(inner)
    if (classified) {
      refs.push({ ...classified, raw, start, end, location })
    }
  }
  return refs
}

/** Must match Task 2.2 classification order exactly */
function classifyInner(inner: string): Pick<VariableReference, 'kind' | 'name'> | null {
  if (/^\$uuid$/i.test(inner)) return { kind: 'uuid', name: 'uuid' }
  if (/^\$timestamp$/i.test(inner)) return { kind: 'timestamp', name: 'timestamp' }
  if (/^\$randomInt$/i.test(inner)) return { kind: 'randomInt', name: 'randomInt' }
  const dotenv = inner.match(/^\$dotenv\s+(.+)$/i)
  if (dotenv) return { kind: 'dotenv', name: dotenv[1]!.trim() }
  // Keep equivalent to parse.ts OAUTH_PATTERN = /\{\{\s*\$oauth/i
  if (/^\$oauth/i.test(inner)) return null
  if (/^[\w.-]+$/.test(inner)) return { kind: 'env', name: inner }
  return null
}

export function collectRequestVariables(request: ParsedRequest): VariableReference[] {
  const out: VariableReference[] = []
  out.push(...scanVariables(request.url, { part: 'url' }))
  request.headers.forEach((h, index) => {
    out.push(...scanVariables(h.value, { part: 'header', index }))
  })
  if (request.body) {
    out.push(...scanVariables(request.body.content, { part: 'body' }))
  }
  return out
}
```

**Important:** Classification only — never resolve `$randomInt` to a number or `$uuid` to a UUID in this story.

### Downstream Consumer Contract (for Story 2.5)

Story 2.5 will resolve per field using `location` + `start`/`end` (or re-`scanVariables` each field):

1. Resolve `env` names from active environment (2.2/2.3)
2. Resolve `dotenv` names from repo `.env` variants (2.4)
3. Generate `uuid` / `timestamp` / `randomInt` at send time
4. Replace placeholders in a **copy** of url/headers/body — **not** in stored DTO templates

Document in code comments that `VariableReference.raw` is the exact substring to replace within the field identified by `location`.

### Do Not Regress (Epic 1)

- SM-2 fixture gate ≥45/50 — 50/50 today; do not break corpus files
- `astEquivalent` round-trip tests for IN constructs
- OUT constructs still emit `UNSUPPORTED_CONSTRUCT` (OAuth, scripts, `@name`, etc.)
- `serializeHttpFile` still outputs literal `{{…}}` unchanged
- Server collections API still returns url templates verbatim (Story 1.3 contract)
- Execute still forwards literal templates (Story 1.7) until 2.5

### Testing Standards

- **Framework:** Vitest 3.x colocated `src/*.test.ts`; ESM imports with `.js` suffix
- **Coverage focus:** one dedicated test per dynamic builtin + dotenv + env + multi-field request + OUT non-emits + mixed-case `$RandomInt`
- **No server/web tests** in this story
- Run `pnpm --filter @reqor/http-parser test` then full `pnpm turbo build test typecheck`

### Project Structure Notes

```text
packages/http-parser/src/
  variables.ts           # NEW — types, scanVariables, collectRequestVariables, classifyInner
  variables.test.ts      # NEW — per-type + OUT non-emit + location tests
  index.ts               # UPDATE — re-export variable API
  ast.ts                 # OPTIONAL re-export only
  parse.ts               # UNCHANGED behavior (OAuth diagnostic stays)
  serialize.ts           # UNCHANGED
  diagnostics.ts         # UNCHANGED
  parse.test.ts          # OPTIONAL — integration assert on collectRequestVariables
  roundtrip.test.ts      # Must still pass
  fixtures.test.ts       # Must still pass SM-2 gate
```

### Previous Story Intelligence (Epic 1 — parser baseline)

**Story 1.2 (done):** Hand-rolled line parser; preserves `{{host}}`, `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}`, `{{$dotenv …}}` as literal substrings; OAuth emits `UNSUPPORTED_CONSTRUCT` via `OAUTH_PATTERN`; zero runtime deps; 50/50 fixture pass.

**Story 1.7 (done):** Execute sends literal url/headers/body from `RequestDto` — variables in templates are sent unreplaced to target (expected until 2.5). Do not touch execute path.

**Key gap 1.2 explicitly deferred:** "recognizes placeholders as literal text but does not resolve" — 2.1 adds structured `VariableReference` extraction on top.

### Git Intelligence

- `61fa8eb` — Story 1.7 HTTP proxy + response panel
- `a4453ac` — Sidebar review patches
- Patterns: ESM `.js` imports, colocated vitest, zero-dep http-parser, `astEquivalent` for round-trip

### Latest Technical Information

- **JetBrains MVP IN set (dialect-matrix):** bare `$uuid`, `$timestamp`, `$randomInt`, plus `{{$dotenv KEY}}` — generate values at **send** time in Story 2.5, not at parse
- **JetBrains has more dynamics** (`$isoTimestamp`, `$random.integer(...)`, `$random.uuid`, …) — **OUT of Reqor MVP**; scanner must not invent support
- **`{{$dotenv KEY}}`:** parse key name only in 2.1; resolve from repo `.env` variants in 2.4/2.5 (SPEC / AD-20)
- **No new npm packages** — regex/`matchAll` sufficient; avoid chevrotain/template engines (AD-3)

### Project Context Reference

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1, FR6]
- [Source: `_bmad-output/planning-artifacts/prds/prd-reqor-2026-07-08/prd.md` — FR-6]
- [Source: `_bmad-output/specs/spec-reqor/dialect-matrix.md`]
- [Source: `_bmad-output/specs/spec-reqor/SPEC.md` — CAP-3, dynamic vars]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md` — AD-3, AD-17, AD-20, AD-22]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-reqor-2026-07-08/solution-design.md` — §6 Parser; §8 Web UI → Environment merge order]
- [Source: `_bmad-output/implementation-artifacts/1-2-jetbrains-request-parser-with-fixture-test-suite.md`]
- [Source: `_bmad-output/implementation-artifacts/1-7-http-proxy-execution-and-response-panel.md` — out of scope guards]
- [Source: `packages/http-parser/src/parse.ts` (`OAUTH_PATTERN`), `parse.test.ts`, `ast.ts`]
- [Source: `packages/http-parser/fixtures/corpus/15-ktor-variables.http`, `28-intellij-uuid-var.http`, `29-intellij-timestamp.http`, `30-intellij-random.http`, `44-dotenv-var.http`, `48-out-oauth-with-request.http`]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-16: Ultimate context engine analysis completed — comprehensive developer guide created
- 2026-07-16: Story context validated — variable scanner API, classification rules, OAuth OUT boundary, Epic 1 regression guards, and downstream 2.5 contract locked in
- 2026-07-16: Applied full validation pass — field `location` on VariableReference, fixed `$randomInt` case-folding sample, AC1 scanner-only recognition, MVP IN/OUT dynamics locked, OAuth/`matchAll`/fixture guidance tightened
