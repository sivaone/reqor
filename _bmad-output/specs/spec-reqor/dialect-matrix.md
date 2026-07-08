# Reqor — JetBrains HTTP Client Dialect Matrix (MVP)

This matrix is the authoritative IN/OUT boundary for `@reqor/http-parser` in the MVP. It gates CAP-3 and success metric SM-2. Constructs marked **OUT** must return an explicit unsupported diagnostic — never silent skip. **Status: Final.** IN/OUT boundaries confirmed; no week-4 review required.

| Construct | MVP | Notes |
|-----------|-----|-------|
| Request line (`METHOD URL` or `METHOD URL HTTP/1.1`) | **IN** | |
| Request separator `###` | **IN** | |
| Headers (`Key: Value`) | **IN** | |
| Request body — JSON, raw text, form-encoded | **IN** | |
| Query parameters in URL | **IN** | |
| `{{variable}}` placeholder from active environment | **IN** | |
| `{{$uuid}}` dynamic variable | **IN** | |
| `{{$timestamp}}` dynamic variable | **IN** | |
| `{{$randomInt}}` dynamic variable | **IN** | |
| `http-client.env.json` environment file | **IN** | |
| `{{$dotenv KEY}}` — resolve from repo `.env` | **IN** | |
| Multiple requests in one file (separated by `###`) | **IN** | |
| `@name` request references / request chaining | **OUT** | Post-MVP |
| Pre-request scripts (`> {% ... %}` before request) | **OUT** | Post-MVP |
| Response handler scripts (`> {% ... %}` after request) | **OUT** | Post-MVP |
| `.http` file inclusion / `import` / `run` directives | **OUT** | Post-MVP |
| OAuth2 helper variables | **OUT** | Post-MVP |
| VS Code REST Client dialect | **OUT** | Separate parser surface; post-MVP |

**Fixture test requirement:** The parser must pass ≥90% of a curated set of 50 real-world `.http` files drawn from open-source repositories. This suite is the gating criterion for SM-2 and must pass before public promotion of the npm package.

**Round-trip requirement:** Parse → serialize → parse must produce an equivalent AST for all IN constructs. Minimal-diff writes must change only the lines belonging to the edited Request block.
