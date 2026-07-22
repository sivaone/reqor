# Epic 5 Context: Import, Export, and Share

<!-- Generated from planning artifacts. Regenerated/corrected for draft-aware export (Story 5.2). -->

## Goal

Enable developers to move requests in and out of Reqor without leaving the local workflow: paste a cURL command from API docs into the editor for immediate testing, copy a configured request as a terminal-ready cURL command for teammates, or export runnable code snippets in JavaScript, Python, or cURL. All import/export operations respect the draft-only editing model (no implicit disk writes) and never expose secrets in plaintext.

## Stories

- Story 5.1: cURL Import
- Story 5.2: cURL Export
- Story 5.3: Code Snippet Export

## Requirements & Constraints

- cURL import converts pasted commands into a Request DTO in the editor draft only — explicit Save is required to persist to disk.
- Supported cURL flags: `-X`, `-H`, `-d`, `--data-raw`, `--json`, `-u` (basic auth). Unsupported flags produce a warning but still import a partial request.
- cURL export substitutes variables from the active environment and redacts secrets with `SECRET_MASK` (`••••••`). Non-secret portions must match what Send would use; secret-bearing fields are intentionally non-runnable until the user substitutes real values (NFR6 overrides plaintext terminal auth).
- Snippet export offers JavaScript (`fetch`), Python (`requests`), and cURL formats, each including method, URL, headers, and body.
- Secret values in exported cURL and snippets must never appear in plaintext — use `SECRET_MASK` redaction (cURL export) or `/* SECRET */` placeholder comments (snippets).
- Postman collection import is explicitly out of scope for MVP.
- Additional snippet languages (Go, Java) are deferred post-MVP.

## Technical Decisions

- cURL import and export serialization live in `packages/http-parser`; server owns HTTP routes and env/secret resolution; snippet formatting for Story 5.3 lives in `packages/server` (may call shared load + redaction helpers).
- Three REST endpoints govern this epic:
  - `POST /api/import/curl` — cURL string → Request DTO
  - `POST /api/export/curl` — draft-aware export body (same shape as `PreviewRequest`: `collectionId`, `requestIndex`, optional `environment`, optional draft overrides) → `{ curl: string }`
  - `POST /api/export/snippet` — draft-aware (Story 5.3; same identity/draft body pattern; response includes language + snippet)
- **Do not use** planning’s `GET /api/export/curl/:requestId` or `GET /api/export/snippet/:requestId` — path-only GET cannot carry unsaved draft overrides (AD-21 identity is `collectionId` + `requestIndex`, same as execute/preview/save).
- All schemas are defined in `@reqor/shared-types` with TypeBox validation.
- All conversion and secret redaction happen server-side; the browser never parses or generates cURL.
- Export resolves the active environment via the same `resolveRequest` path as execute; secrets are redacted with `redactSecrets` on url, headers, and body before serialization.
- Shared helper `loadMergedRequestForExport` (or equivalent) returns **redacted request fields** for both cURL and snippet serializers — not a single hard-coded output string.
- Error responses use the standard envelope: `{ error: { code, message, details? } }`. Unresolved variables block export with `UNRESOLVED_VARIABLE` (execute semantics).

## UX & Interaction Patterns

- cURL import is triggered from the request toolbar via a modal: textarea paste, semi-transparent overlay (`rgba(0,0,0,0.4)`) with a white card and no drop shadow. Esc closes the modal.
- cURL export is a one-click **Copy cURL** toolbar action (no modal) with copy-to-clipboard.
- Snippet export is triggered from the request toolbar via a popover with tabs for JavaScript, Python, and cURL, each with copy-to-clipboard. Esc closes the popover.
- Import/export toolbar controls require screen reader labels (`aria-label`).
- Warning microcopy for unsupported cURL flags follows the direct developer-tool voice — state the issue plainly, no marketing fluff.

## Cross-Story Dependencies

- Requires the request workspace and editor draft infrastructure from Epics 1 and 3 (import populates draft; export reads loaded request + draft).
- Requires active environment selection and secret resolution from Epic 2 (FR9/FR14/FR15) for variable substitution and secret redaction on export.
- Story 5.1 (import) can proceed once draft-state editing exists; Stories 5.2 and 5.3 (export) additionally require environment resolution to be functional.
- Stories 5.2 and 5.3 share server-side export load/redact infrastructure and both depend on a loaded request identified by `collectionId` + `requestIndex`.
