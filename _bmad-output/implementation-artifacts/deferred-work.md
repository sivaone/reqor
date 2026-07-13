# Deferred Work Log

## Deferred from: Code review of Story 1.2 (2026-07-13)

- **SourceSpan semantics in astEquivalent** [packages/http-parser/src/ast.ts:116-179] — Story 3.3 (minimal-diff save) will require full SourceSpan tracking for accurate line ranges; current design correctly treats SourceSpan as cosmetic metadata for 1.2 round-trip tests
- **Body kind classifier heuristic edge case** [packages/http-parser/src/ast.ts:81-83] — Rare edge case where bodies starting with `&` could be misclassified; acceptable design choice; low probability in practice
- **ParseOptions documentation** [packages/http-parser/src/index.ts] — Type is exported correctly but lacks consumer-facing documentation; documentation/examples improvements separate from code review
- **Multi-request SourceSpan accuracy in serializer** [packages/http-parser/src/serialize.ts:30-35] — Serializer has no access to original source line numbers; Story 3.3 will implement proper tracking for minimal-diff patches
