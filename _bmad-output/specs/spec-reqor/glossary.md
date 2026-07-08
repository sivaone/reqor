# Reqor — Domain Glossary

Domain terms used in SPEC.md and throughout all downstream skills. Terms here are authoritative; use them consistently in code, API routes, DTOs, and documentation.

| Term | Definition |
|------|------------|
| **Collection** | A logical grouping of Requests derived from one `.http` file on disk. One `.http` file = one Collection. Collection ID = repo-relative `.http` path using POSIX separators. |
| **Request** | A single HTTP call defined within a `.http` file: method, URL, headers, body. Identified by `collectionId` + `requestIndex` + `fingerprint` (hash of method + urlTemplate). |
| **`.http` file** | Plain-text file using JetBrains HTTP Client syntax stored in the repository filesystem. |
| **JetBrains HTTP Client dialect** | The `.http` syntax used by IntelliJ IDEA HTTP Client: request separators (`###`), variable placeholders (`{{name}}`), environment references, and dynamic variables. MVP support scope defined in `dialect-matrix.md`. |
| **Environment** | A named set of variables (and optional secrets) used to resolve placeholders in Requests at send time. Sourced from `http-client.env.json`. |
| **Secret** | A sensitive variable value resolved via `{{$dotenv KEY}}`. Sourced server-side from the repo's existing `.env` file variants (`.env`, `.env.local`, `.env.staging`, etc.) that developers already maintain and gitignore. Reqor reads these files; it never writes to them. Must not appear in logs, history, API responses, or exported snippets in plaintext. |
| **Local Server** | The Node.js (Fastify 5.x) process started by `reqor serve`. Single authority for parsing `.http` files, resolving environments and secrets, proxying HTTP traffic, persisting history, and writing disk changes. |
| **Web UI** | The React 19 SPA served from `http://localhost:3000`. Presentation only — issues commands to Local Server; never calls target URLs directly. |
| **Proxy** | The Local Server component that executes HTTP Requests on behalf of the Web UI, eliminating browser CORS limits against localhost and remote APIs. |
| **History Entry** | A persisted record of a sent Request containing: timestamp, active environment name, method, URL, status code, duration (ms). Stored in `.reqor/history.db`. Response body truncated at 1MB in display; full body retrievable via detail endpoint. |
| **Repository Root** | The directory passed to `reqor serve`. Scanned recursively for `.http` files. `node_modules` and `.git` always excluded; `.gitignore` honored where present. |
| **`.reqor/`** | Local runtime state directory at Repository Root (gitignored). Contains `history.db` and `config.json` only — no secrets vault. Created on first run; CLI ensures `.gitignore` entry. |
| **fingerprint** | `hash(method + urlTemplate)` for a Request. Used to rematch selection and history replay across collection reloads (AD-21). |
| **minimal-diff write** | Disk save strategy: parse to AST, patch only the affected Request node, serialize preserving surrounding formatting. Falls back to full-file rewrite with a warning on patch failure (AD-5). |
| **EnvResolver** | Server-side component owning variable/secret merge at send time. Merge order: active `http-client.env.json` variables → matching `.env` file variant (`.env.local` > `.env.staging` > `.env`). Reqor reads `.env` variants; it never writes to them. |
