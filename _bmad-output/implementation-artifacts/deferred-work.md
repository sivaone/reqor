# Deferred Work Log

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
