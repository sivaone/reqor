---
title: "PRFAQ Distillate: Reqor"
type: llm-distillate
source: "prfaq-reqor.md"
created: "2026-07-08"
updated: "2026-07-08"
purpose: "Token-efficient context for downstream PRD creation"
product_name: "Reqor"
concept_type: "open-source developer tool"
---

# Reqor — PRFAQ Distillate

## Product Identity

- **Name:** Reqor (short for Requestor)
- **Type:** Open-source, web-first REST API client
- **Tagline:** Open your repo's `.http` files in the browser — no install, no proprietary formats
- **Customer:** Backend/fullstack developers at small-to-mid teams (5–50 engineers) who test REST APIs daily and maintain `.http` files alongside code
- **Problem:** Postman bloated, paywalled, sync drift vs Git; `.http` files in repo have no good browser UI

## Hero Workflow (Primary Differentiator)

- `cd` into repo → `reqor serve` (or `npx @reqor/cli .`) → `.http` files auto-load as collections in browser
- Zero install beyond CLI binary; no account for local use
- Collections ARE `.http` files on disk — no import, no proprietary format, no sync button

## Architecture

- **Browser:** UI only (React or similar SPA)
- **Local server:** HTTP client + proxy (handles CORS — requests never originate from browser directly)
- **Storage:** `.http` files on disk; secrets in `.env`-compatible local files
- **Deployment:** Local (`reqor serve`) MVP; Reqor Cloud deferred post-MVP; desktop app year-2

## MVP Scope — IN (8 weeks, local-only)

- CLI: `reqor serve`
- Local proxy server
- Web UI: browse, send, edit requests
- Auto-load `.http` files from repo directory
- **JetBrains HTTP Client dialect parser** (requests, headers, query params, body, variables, environment files)
- Environment variables and secrets (local)
- Request history
- cURL import/export
- Code snippet export (JS fetch, Python requests, etc.)

## MVP Scope — OUT (fast-follow or later)

- **Postman collection import** — fast-follow post-MVP
- **VS Code REST Client dialect** — fast-follow post-MVP
- Reqor Cloud (after local validation)
- Desktop app (Electron/Tauri)
- Filesystem watch / live reload (manual refresh in MVP)
- Advanced `.http` scripting
- CI/CD integration
- Team auth / SSO
- **Forever out (for now):** mocks, API design, GraphQL, gRPC, WebSocket

## Timeline (User-Confirmed)

- **8 weeks:** Local-only MVP with JetBrains dialect parser
- Postman import: post-MVP fast-follow
- VS Code dialect: post-MVP fast-follow
- Reqor Cloud: not before local adoption validated
- Steady-state maintenance post-MVP: 5–10 hrs/week solo

## Critical Path & Technical Risks

1. **JetBrains `.http` parser** — highest risk; build weeks 1–3; test against JetBrains-style fixtures from real repos
2. **Bidirectional UI ↔ disk sync** — must preserve JetBrains formatting in Git diffs
3. **Parser failure = product death** — inline parse errors required; no silent drops
4. **JetBrains-only MVP** — VS Code dialect teams wait until fast-follow; message clearly at launch

## Competitive Positioning

| Competitor | Gap Reqor Exploits |
|-----------|-------------------|
| Postman | Bloated, paywalled, proprietary cloud sync, sync drift |
| Bruno | Desktop-first, proprietary `.bru` format — requires migration |
| Hoppscotch | Multi-protocol, own collection model — not `.http`-native |
| IDE `.http` tools | IDE-bound, no standalone web UI, limited team UX |

**Moat:** Zero migration for teams with JetBrains `.http` files already in repo.

**Kill risks:** Scope creep; JetBrains parser compatibility failures; building cloud before local validation

## Business Model

- Local OSS: free forever, no feature paywalls on core workflow
- Reqor Cloud (future): $5–8/user/month hypothesis — hosting convenience only
- Fallback: community contributions, GitHub Sponsors, Open Collective

## Adoption Strategy (First 1,000 Users)

- GitHub OSS launch, HN/Reddit timed to Postman migration sentiment
- npm `@reqor/cli`, blog/Dev.to demo of `reqor serve` workflow
- Zero-friction activation: works in 60 seconds on existing JetBrains `.http` files
- No paid ads, no sales team in MVP

## Rejected Framings

- "Postman killer" — overused, invites wrong comparison
- "Revolutionary API testing platform" — violates REST-only client scope
- Dual-dialect MVP — cut to JetBrains-only to hold 8-week line
- Postman import in MVP — cut; fast-follow instead

## Open Questions for PRD

- JetBrains dialect support matrix: explicit in/out list for MVP constructs
- Bidirectional file sync formatting rules (JetBrains output fidelity)
- `@reqor/cli` npm package availability
- License: MIT vs Apache 2.0 (decide before public repo)
- Reqor Cloud pricing final number
- Postman import scope when fast-follow begins
- VS Code dialect priority vs other fast-follows
- Replace placeholder customer quote with founder's real experience

## Verdict Summary

- **Status:** Forged with heat remaining — ready for PRD
- **Priority #1:** JetBrains parser quality in weeks 1–3
- **Priority #2:** Define JetBrains dialect support matrix by week 4
- **Priority #3:** Hold 8-week line — no Postman import, no VS Code dialect in MVP

## Downstream PRD Requirements Signals

- CLI package (`@reqor/cli`) with `serve` command
- Local HTTP proxy server component
- JetBrains `.http` parser library (testable in isolation)
- Web SPA: collection browser, request editor (visual + raw `.http`/cURL), response viewer
- Environment/secret management (local `.env`-compatible)
- Request history store (local)
- cURL parser/generator
- Code snippet generator (multi-language)
- **Post-MVP:** Postman collection importer, VS Code REST Client dialect parser
