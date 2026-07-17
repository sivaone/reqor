# Deferred Work Log

## Deferred from: code review of 2-5-send-time-variable-resolution-and-pre-send-preview (2026-07-17)

- **Dotenv fallback values redacted in preview URL** [packages/server/src/env-resolver.ts] — all dotenv values are treated as secrets for redaction; env-kind fallback from `.env` may show `••••••` in the URL preview even for non-secret keys like `host`; narrow redaction to referenced keys when productizing clearer preview UX

## Deferred from: code review of 2-4-secret-resolution-from-env-variants (2026-07-17)

- **`parseEnvLine` parsing gaps** [packages/server/src/parse-env-line.ts] — no inline-comment stripping, unterminated-quote handling, multi-line quoted values, lone-CR line endings, or whitespace-in-key detection; logic moved unchanged from `load-local-env.ts`, pre-existing
- **No Fastify `declare module 'fastify'` type augmentation** [packages/server/src/app.ts] — `dotenvStore`/`envResolver` decorators require `as unknown as` casts; matches pre-existing pattern for `collectionStore`/`environmentStore`/`configStore`
- **No file-size/line-count guard on repo `.env` reads at startup** [packages/server/src/dotenv-store.ts] — matches pre-existing unbounded-read pattern in `EnvironmentStore.readEnvFile`
- **`DotenvStore.load()` single-flight queue concurrency untested** [packages/server/src/dotenv-store.ts] — mirrors the same untested pattern in `EnvironmentStore.loadAll()`

## Deferred from: code review of 2-3-environment-selection-with-persistence (2026-07-17)

- **Concurrent PUTs / multi-process stale in-memory config** — local single-writer MVP assumed; revisit if multi-instance becomes supported
- **Whitespace-only and case-insensitive env name matching** — exact name match only for MVP
- **UTF-8 BOM handling on config.json load** — optional hardening; invalid JSON already maps to null
- **Disk write failure codes (EACCES/ENOSPC) → typed API error** — follow existing server error patterns when needed
- **Empty env list leaves orphaned persisted name uncleared** — select is disabled when environments are empty, so a stale `activeEnvironment` cannot be cleared until env files reappear; acceptable for MVP

## Deferred from: code review of 2-2-environment-file-parsing-and-listing (2026-07-17)

- ~~**Demo uses unresolved `{{host}}` while execute still sends literals** — deferred: I changed it for future testing; restore or resolve in Story 2.5 send-time resolution~~ **Done (2026-07-17 / Story 2.5)** — `demo.http` + `http-client.env.json` `development` resolves `{{host}}` via send-time `resolveRequest`
- **No `http-client.private.env.json` gitignore guidance or fixture guard** — Story 2.2 adds private-companion parsing but does not document or enforce ignoring private env files; add repo hygiene guidance when private-secret workflows are productized

## Deferred from: code review of 1-5-app-shell-and-design-system-tokens (2026-07-15)

- **NFR1 load-time performance has no automated benchmark** — manual smoke acceptable for shell MVP; add perf test infrastructure in a follow-up if NFR1 regression guarding is needed
- **useCollections generic error messages without structured detail** — tolerable for 1.5 cold-load shell; richer error UX can wait for Story 1.6
- **App.test.tsx lacks integrated fetch-error coverage** — error path covered in SidebarShell.test.tsx in isolation
- **WorkspaceShell.test.tsx minimal panel/separator coverage** — optional per story task 4.4; drag simulation not required for 1.5
- **Duplicated createWrapper across test files** — test maintainability follow-up; extract shared test utility when test surface grows
- **Story task 4.3 references useCollections.test.ts but file is .test.tsx** — documentation nit only

## Deferred from: Code review of Story 1.2 (2026-07-13)

- **SourceSpan semantics in astEquivalent** [packages/http-parser/src/ast.ts:116-179] — Story 3.3 (minimal-diff save) will require full SourceSpan tracking for accurate line ranges; current design correctly treats SourceSpan as cosmetic metadata for 1.2 round-trip tests
- **Body kind classifier heuristic edge case** [packages/http-parser/src/ast.ts:81-83] — Rare edge case where bodies starting with `&` could be misclassified; acceptable design choice; low probability in practice
- **ParseOptions documentation** [packages/http-parser/src/index.ts] — Type is exported correctly but lacks consumer-facing documentation; documentation/examples improvements separate from code review
- **Multi-request SourceSpan accuracy in serializer** [packages/http-parser/src/serialize.ts:30-35] — Serializer has no access to original source line numbers; Story 3.3 will implement proper tracking for minimal-diff patches
