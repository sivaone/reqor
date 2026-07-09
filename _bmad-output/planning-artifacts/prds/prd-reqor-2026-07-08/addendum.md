# Reqor PRD Addendum

Technical and implementation context that supports the PRD but does not belong in requirement statements.

---

## Tech Stack (Confirmed)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Local Server | **Node.js** (TypeScript) | User preference; fast iteration; npm distribution for `@reqor/cli`; strong HTTP ecosystem |
| Web UI | **React** (TypeScript) | User preference; component ecosystem for editor, sidebar, response viewer |
| HTTP client | `undici` or Node native `fetch` | Built into modern Node; no browser CORS concerns |
| History storage | SQLite via `better-sqlite3` or JSON files under `.reqor/` | Local-only; simple query for history list |
| Parser | Standalone TypeScript package `@reqor/http-parser` | Isolated for unit testing; future publishable library |

**Monorepo layout `[ASSUMPTION]`:**
```
packages/
  cli/          # reqor serve entrypoint
  server/       # Express/Fastify API + proxy + static UI serve
  web/          # React SPA
  http-parser/  # JetBrains dialect parser
```

---

## Architecture Overview

```
Browser (React UI)
    │  REST / WebSocket
    ▼
Local Server (Node)
    ├── Static file server (built React app)
    ├── Collection API (scan, parse, refresh)
    ├── Proxy API (execute HTTP requests)
    ├── Environment/secret resolver
    ├── History store (.reqor/history.db)
    └── File writer (persist .http edits)
    │
    ▼
Target API (localhost:8080, remote HTTPS, etc.)
```

**CORS pattern:** Browser talks only to `localhost:3000`. Local Server forwards HTTP to any target URL. This matches VS Code REST Client / Bruno architecture.

---

## JetBrains Dialect Support Matrix (Draft — finalize by week 4)

| Construct | MVP | Notes |
|-----------|-----|-------|
| Request line (`METHOD URL HTTP/1.1`) | IN | |
| Request separator `###` | IN | |
| Headers (`Key: Value`) | IN | |
| Request body (JSON, raw, form) | IN | |
| Query params in URL | IN | |
| `{{variable}}` from environment | IN | |
| `{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt}}` | IN | |
| `http-client.env.json` environments | IN | |
| `@name` request references | OUT | Post-MVP |
| `{{$dotenv KEY}}` | IN | Resolve from `.env` |
| Pre-request scripts (`> {% ... %}`) | OUT | Post-MVP |
| Response handlers (`> {% ... %}` after request) | OUT | Post-MVP |
| `.http` file inclusion (`import` / `run`) | OUT | Post-MVP |
| OAuth2 helpers | OUT | Post-MVP |

---

## Disk Write Strategy (Open — decide in architecture)

**Options considered:**

1. **Minimal-diff** — Parse to AST, apply edit to affected Request node only, serialize back preserving surrounding formatting. Best for Git diffs; harder to implement.
2. **Full formatter** — Parse and re-format entire file on save. Simpler; noisy Git diffs.

**Recommendation:** Minimal-diff for MVP save path; fall back to full-file rewrite with warning if minimal-diff fails.

---

## `.reqor/` Local Directory

Stored at Repository Root (gitignored by default):

```
.reqor/
  history.db       # or history.json
  config.json      # port preference, active environment, UI state
```

Provide `.reqor/` entry in project `.gitignore` template on first run `[ASSUMPTION]`.

Secrets resolve from repo `.env` variants (`.env`, `.env.local`, `.env.staging`, etc.) — read-only; not stored under `.reqor/` (per SPEC).

---

## npm Distribution

- Package: `@reqor/cli` — global bin `reqor`
- Command: `reqor serve [path] [--port 3000] [--no-open]`
- `npx @reqor/cli serve` supported without global install

---

## 8-Week Build Phases (Suggested)

| Weeks | Focus | Exit criteria |
|-------|-------|---------------|
| 1–3 | `@reqor/http-parser` + fixture tests | SM-2 fixture suite ≥ 90% pass |
| 4 | Local Server skeleton + scan + parse API | FR-3, FR-5 via API tests |
| 5 | Proxy execution + environments | FR-8, FR-9, UJ-3 demo |
| 6 | React UI — browse + send + response | UJ-1 end-to-end |
| 7 | Editor + save-to-disk + history | UJ-2, FR-16 |
| 8 | cURL import/export, snippets, polish, docs | All MVP FRs, README quickstart |

Postman import and VS Code dialect explicitly excluded from this schedule.

---

## Rejected Alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Electron desktop app for MVP | Slower to ship; web-first validates core workflow |
| Browser-direct fetch (no proxy) | CORS blocks localhost API testing |
| Dual dialect parser in MVP | Cuts 8-week timeline; JetBrains first per user decision |
| Postman import in MVP | Cut per user decision; import converter is significant scope |
| Proprietary `.reqor` collection format | Contradicts core value prop |

---

## License

`[ASSUMPTION: MIT]` — pending final decision (Open Question #4 in PRD).
