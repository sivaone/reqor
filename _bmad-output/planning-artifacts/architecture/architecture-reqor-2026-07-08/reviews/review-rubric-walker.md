# Reviewer Gate — Rubric Walker

**Target:** `ARCHITECTURE-SPINE.md` (Reqor MVP, feature altitude, draft)  
**Reviewer:** Rubric Walker (good-spine checklist)  
**Date:** 2026-07-08  
**Inputs skimmed:** `prd-reqor-2026-07-08/prd.md`, addendum, `.memlog.md`

---

## Gate Verdict

**CONDITIONAL PASS** — Core paradigm, package boundaries, and local deployment envelope are solid and map all FR-1..FR-19. Fix four bindable gaps (dialect scope, editor sync, redirect policy, env-parse ownership) and refresh one stale stack pin before epic decomposition.

---

## Checklist Walk

| Criterion | Result | Notes |
| --- | --- | --- |
| Fixes real divergence points for epics/stories below | **Partial** | Monorepo, deps, parser ownership, disk truth, proxy, secrets, API contract well covered. Gaps at editor sync, redirect toggle, env-file parsing seam, dialect matrix scope. |
| Every AD Rule enforceable and prevents stated divergence | **Pass** | AD-1..AD-16 have concrete Binds/Prevents/Rule; enforceable via dependency lint, code review, integration tests. |
| Nothing under Deferred could let two units diverge | **Pass** | Deferred items are post-MVP cuts or legal/publish housekeeping. Edit-only and manual refresh align with PRD. Dialect matrix gap is an *open* item, not safely deferred. |
| Named tech verified-current | **Partial** | Node 24.x Krypton Active LTS confirmed (Jul 2026). better-sqlite3 pinned **11.x** but npm current is **12.11.1** (Jun 2026). Other majors (pnpm 10, Turbo 2, Fastify 5, React 19, Vite 6, TS 5.9, Vitest 3) plausible at major.x granularity. |
| Covers PRD capabilities | **Pass** | Capability map binds FR-1..FR-19 to packages and governing ADs. |
| Every dimension at feature altitude decided, deferred, or open question | **Partial** | Deployment/ops covered (local dev, prod-like, CI, no cloud). Operations/logging via conventions only (acceptable). Missing binds for FR-8 redirect and FR-11/12 sync; dialect matrix still open despite week-4 PRD gate. |
| Ratifies brownfield / no parent-spine conflict | **N/A** | Greenfield. |

---

## Findings

### F-1 — JetBrains dialect MVP scope not binding (HIGH)

**Checklist:** fixes divergence points; deferred must not hide divergence  
**Evidence:** PRD FR-5..FR-7 and addendum draft matrix define IN/OUT constructs (e.g. `{{$dotenv}}`, dynamic vars, env file formats). Spine AD-3 owns parser dialect generically; Deferred lists advanced constructs but does **not** adopt the addendum matrix or cite it as binding. Memlog still logs `(question) Final JetBrains dialect matrix — finalize by week 4`.  
**Divergence prevented if fixed:** Parser epic, server integration, and SM-2 fixture suite could implement different MVP subsets.  
**Autofix:** Add AD (or extend AD-3 Rule) binding parser MVP scope to addendum matrix version; move matrix finalization from open question to adopted reference doc with week-4 checkpoint.

### F-2 — Visual/raw editor sync authority missing (HIGH)

**Checklist:** fixes divergence points for stories below  
**Evidence:** FR-11 and FR-12 require bidirectional sync between form and raw `.http` editor. Capability map assigns editor to `web + server` with AD-4/AD-10 only — disk truth and DTO shapes, not sync model.  
**Divergence prevented if fixed:** Web stories could choose client-side dual buffers vs server round-trip parse-on-blur vs parser-as-single-transform; save path (AD-5) assumes AST patch but editor state model is unconstrained.  
**Autofix:** AD Rule: canonical edit model flows through parser AST (server-mediated or shared parse in web via API only); one representation authority; explicit sync trigger (save, debounced parse, or tab switch).

### F-3 — HTTP redirect policy absent (MEDIUM)

**Checklist:** covers PRD capabilities; dimension decided/deferred/open  
**Evidence:** PRD FR-8 consequence: "follows redirects by default; developer can disable redirect following per request." No AD, convention, or Deferred entry. AD-9/AD-6 govern proxy path but not redirect behavior.  
**Divergence prevented if fixed:** Proxy implementation vs request editor UI could default differently or omit per-request toggle.  
**Autofix:** Extend AD-6 or AD-9 Rule: Node `fetch` redirect option server-side; default `follow`; per-request flag in Request DTO and proxy handler.

### F-4 — Environment file parsing ownership ambiguous (MEDIUM)

**Checklist:** fixes divergence points  
**Evidence:** AD-3 binds FR-7 to http-parser; AD-8 binds resolution at send time to server. No rule states whether `http-client.env.json` / env file **parse** lives in http-parser vs server-only loader.  
**Divergence prevented if fixed:** Server routes vs parser package could duplicate env file logic or disagree on file discovery paths.  
**Autofix:** Clarify in AD-3: parser (or dedicated parser submodule) owns env file parse + variable definitions; server orchestrates load order and secret overlay from `.reqor/secrets.env`.

### F-5 — better-sqlite3 version stale (MEDIUM)

**Checklist:** named tech verified-current  
**Evidence:** Stack table lists `better-sqlite3 | 11.x`. npm registry (Jun 15, 2026) shows **12.11.1** as latest stable. Native addon major bump affects Node 24 CI and `engines` compatibility testing.  
**Autofix:** Update Stack to `12.x` and verify native build on Node 24 in CI pin.

---

## Strengths (no action)

- Thin-Client Local BFF paradigm is crisp and diagrammed; prevents the highest-risk split (browser calling targets).
- AD-2 dependency DAG is enforceable and matches monorepo intent.
- AD-4/AD-5 resolve PRD open question #2 (minimal-diff vs full formatter) decisively.
- AD-12/AD-13 resolve PRD open question #5 (secrets/history under `.reqor/` at repo root).
- AD-9 resolves PRD open question #7 (fail-fast port conflict); Deferred documents auto-increment revisit.
- Deployment & environments table covers local dev, prod-like, CI, explicit no-cloud — adequate for MVP feature altitude.
- AD-16 aligns with PRD security NFR on no telemetry.

---

## Tail (medium/low — see spine, no gate block)

- History replay contract (FR-16 re-open entry) unspecified beyond persistence — likely story-level if replay uses same Request DTO.
- cURL import/export (FR-17/18) ownership implied by map but no AD on cURL ↔ AST conversion boundary.
- Performance NFRs (2s load, 100ms send feedback) and basic keyboard a11y not in spine — acceptable deferral for dev-tool MVP if stories inherit from PRD §10.
- Spine `status: draft`; finalize after fixes and lint_spine.py pass.

---

## Recommended pre-handoff actions

1. Add/clarify ADs for F-1, F-2, F-3, F-4 (or extend existing AD Rules in place, stable IDs).
2. Bump better-sqlite3 to 12.x in Stack; log version in memlog.
3. Run `lint_spine.py` after edits.
4. Set `status: final` only after user confirms dialect matrix adoption.
