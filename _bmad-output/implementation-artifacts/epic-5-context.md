# Epic 5 Context: Import, Export, and Share

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable developers to move requests in and out of Reqor without leaving the local workflow: paste a cURL command from API docs into the editor for immediate testing, copy a configured request as a terminal-ready cURL command for teammates, or export runnable code snippets in JavaScript, Python, or cURL. All import/export operations respect the draft-only editing model (no implicit disk writes) and never expose secrets in plaintext.

## Stories

- Story 5.1: cURL Import
- Story 5.2: cURL Export
- Story 5.3: Code Snippet Export

## Requirements & Constraints

- cURL import converts pasted commands into a Request DTO in the editor draft only — explicit Save is required to persist to disk.
- Supported cURL flags: `-X`, `-H`, `-d`, `--data-raw`, `--json`, `-u` (basic auth). Unsupported flags produce a warning but still import a partial request.
- cURL export substitutes variables from the active environment and redacts secrets; the exported command must execute equivalently in a terminal against the same environment.
- Snippet export offers JavaScript (`fetch`), Python (`requests`), and cURL formats, each including method, URL, headers, and body.
- Secret values in exported cURL and snippets must never appear in plaintext — use redaction (cURL) or `/* SECRET */` placeholder comments (snippets).
- Postman collection import is explicitly out of scope for MVP.
- Additional snippet languages (Go, Java) are deferred post-MVP.

## Technical Decisions

- cURL import and export logic lives in `packages/server` with `packages/http-parser` for cURL-to-Request conversion; snippet export lives in `packages/server` only.
- Three REST endpoints govern this epic: `POST /api/import/curl` (cURL string → Request DTO), `GET /api/export/curl/:requestId` (Request → cURL string), `GET /api/export/snippet/:requestId` (Request → formatted snippet). All schemas are defined in `@reqor/shared-types` with TypeBox validation.
- All conversion and secret redaction happen server-side; the browser never parses cURL or generates `.http` syntax.
- Export endpoints resolve the active environment and substitute variables using the same server-side resolution path as request execution; secrets are redacted per the server-side secret-handling rule (read from repo `.env` variants, never returned in plaintext).
- Export endpoints identify requests by `requestId` (collection-relative request identity from the collections API).
- Error responses use the standard envelope: `{ error: { code, message, details? } }`.

## UX & Interaction Patterns

- cURL import is triggered from the request toolbar via a modal: textarea paste, semi-transparent overlay (`rgba(0,0,0,0.4)`) with a white card and no drop shadow. Esc closes the modal.
- Snippet export is triggered from the request toolbar via a popover with tabs for JavaScript, Python, and cURL, each with copy-to-clipboard. Esc closes the popover.
- Import/export icon-only toolbar buttons require screen reader labels.
- Warning microcopy for unsupported cURL flags follows the direct developer-tool voice — state the issue plainly, no marketing fluff.
- cURL export copy-to-clipboard is available from the request toolbar.

## Cross-Story Dependencies

- Requires the request workspace and editor draft infrastructure from Epics 1 and 3 (import populates draft; export reads the loaded request).
- Requires active environment selection and secret resolution from Epic 2 for variable substitution and secret redaction on export.
- Story 5.1 (import) can proceed once draft-state editing exists; Stories 5.2 and 5.3 (export) additionally require environment resolution to be functional.
- Stories 5.2 and 5.3 share the same server-side export infrastructure and both depend on a loaded request with a valid `requestId`.
