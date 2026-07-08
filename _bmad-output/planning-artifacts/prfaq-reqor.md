---
title: "PRFAQ: Reqor"
status: "complete"
created: "2026-07-08"
updated: "2026-07-08"
stage: 5
mvp_scope_note: "JetBrains dialect only; no Postman import in MVP"
inputs: []
concept_type: "open-source developer tool"
product_name: "Reqor"
---

# Reqor Launches: Open Your Repo's `.http` Files in the Browser — No Install, No Proprietary Formats

## Backend developers at small teams get a zero-install REST client that treats the `.http` files already in their repo as the collection.

**Remote, July 8, 2026** — Today marks the launch of **Reqor** (Requestor), an open-source, web-first REST API client for backend and fullstack developers who test HTTP APIs daily and are tired of maintaining a separate Postman workspace that never matches what's in Git. Reqor does one thing well: send HTTP requests, keep them in plain text, and stay out of your way. No mock servers. No API design suite. No GraphQL, gRPC, or WebSocket tabs. Just collections, history, variables, secrets, and requests in `.http` and cURL — the formats you already use.

You're on a new machine, or a contractor's laptop, or CI debugging a failing endpoint. You don't want to install Postman, wait for it to sync, and hunt for the right collection version. You want to open a browser, point at the `.http` files sitting next to your service code, and send a request. That's the job Reqor was built for.

Postman turned a simple request client into a platform — mandatory accounts, cloud sync, Flows, AI assistants, and team features locked behind per-seat pricing. When free team collaboration ended in March 2026, small teams felt it immediately: the tool they'd standardized on now costs money for the workflow they actually use. Meanwhile, the `.http` files in their repo — the ones reviewed in pull requests, versioned in Git, editable in VS Code and IntelliJ — sit unused because there's no good way to browse and run them outside the IDE. Reqor closes that gap.

**Reqor** runs in any browser with zero installation. Start a local server inside your existing repo and Reqor automatically loads every `.http` file as a collection in the web UI — no import step, no format conversion, no duplicate source of truth. Prefer a hosted instance? Use Reqor Cloud and open the same UI from any machine without carrying collections around. Variables, secrets, and request history stay scoped to your environment. Export any request as cURL or a code snippet in your stack's language.

> "We built Reqor because Postman stopped being a request client. Your `.http` files are already the source of truth — Reqor just gives them a UI that works everywhere."
> — Siva, Creator

### How It Works

1. **Open your repo** — `cd` into a project that already has `.http` files. Run `reqor serve` (or `npx @reqor/cli .`). Reqor scans the directory and opens your files as collections in the browser. No account, no install beyond a single CLI binary.
2. **Write requests your way** — Edit in the visual builder, or directly in `.http` or cURL format. Switch between views without losing context. Changes write back to the files on disk.
3. **Run from any machine** — Local server for offline, repo-native work. Reqor Cloud for teams that want a shared URL without syncing collections through a vendor vault.
4. **Configure environments** — Variables and secrets resolve at runtime, scoped per environment. History tracks every request and response for debugging.
5. **Export and share** — Copy as cURL, JavaScript `fetch`, Python `requests`, or your language of choice. Share collections via Git — because they *are* your Git files.

> "We had `.http` files in the repo and a Postman collection that was always out of date. I run Reqor in the project root and the UI just reflects what's in Git. No sync button, no second source of truth."
> — Backend engineer, 12-person startup

### Getting Started

Install the CLI (`npm install -g @reqor/cli` or download a binary). `cd` into any repo with `.http` files and run `reqor serve`. Your browser opens to `localhost:3000` with collections ready to run. First request in under 60 seconds. No account required for local use. Reqor Cloud available for teams who want hosted access.

---

<!-- coaching-notes-stage-1 -->
## Coaching Notes — Stage 1 (Ignition)

**Concept type:** Open-source developer tool (commercial sustainability via optional cloud hosting, not freemium feature gating)

**Customer hypothesis (confirmed):** Backend and fullstack developers at small-to-mid teams (5–50 engineers) who test REST APIs daily, maintain `.http` files or Postman collections alongside code, and are actively frustrated by Postman's bloat and 2026 pricing changes.

**Assumptions challenged:**
- "Web-first" = browser-based via local server OR cloud; desktop app is explicit future extension, not v1
- Deliberate scope exclusion (REST-only, no mocks/design) is a differentiator, not a limitation
- `.http` + cURL dual-format support is the sharpest wedge; repo-native auto-load is the hero workflow

**Key research findings shaping framing:**
- Postman March 2026 free-tier team collaboration removal triggered measurable migration to Bruno/Hoppscotch
- Bruno (40K+ stars): desktop-first, proprietary `.bru` format — gap for web-first `.http` native
- Hoppscotch: closest web-first OSS analog but multi-protocol, own collection model
- `.http` ecosystem fragmented (JetBrains vs VS Code dialects) — compatibility is a real engineering burden
- Market ~$1.75–2.1B, growing 12–22% CAGR; trend toward lightweight, Git-native, privacy-reserving tools

**Out-of-scope confirmed by user:** API design, mock servers, non-HTTP protocols (GraphQL, gRPC, WebSocket)

<!-- coaching-notes-stage-2 -->
## Coaching Notes — Stage 2 (Press Release)

**Product name:** Reqor (short for Requestor) — confirmed by user

**Web-first rationale (confirmed):**
- Start small; ship faster than desktop
- Zero install — open on any machine via browser
- Repo-native: `reqor serve` in project root auto-loads `.http` files as collections
- Cloud hosting path for team access without local server
- Desktop app is explicit later extension, not v1 promise

**Rejected framings:**
- "Postman killer" — overused, invites comparison on features we explicitly exclude
- "Revolutionary API testing platform" — violates scope; we're a client, not a platform
- "Nothing Else" in headline — reads as incomplete; replaced with positive repo-native framing

**Competitive positioning:**
- vs Postman: lean, no paywall for core workflow, plain-text portability, no sync drift
- vs Bruno: web-first + `.http` native + zero install (Bruno uses `.bru`, desktop-first, requires install)
- vs Hoppscotch: REST-only focus + `.http`/cURL as primary formats + repo-native auto-load
- vs Thunder Client/IDE tools: standalone web UI accessible outside IDE, team cloud option

**Hero differentiator identified:** `cd repo && reqor serve` → `.http` files become collections automatically. This is the "why web-first" answer Bruno can't give.

**Out-of-scope preserved:** No mocks, no API design, no multi-protocol. Desktop app deferred to post-v1.

**Stage 2 status:** LOCKED (2026-07-08). User approved draft; headline updated to "No Proprietary Formats" per user request (removed competitor-negative "No Postman" framing).

---

## Customer FAQ

### Q: How is Reqor different from Bruno or Hoppscotch? I already switched once.

A: Bruno is a desktop app with its own `.bru` file format — great if you want offline and Git-native, but you install it and learn a proprietary syntax. Hoppscotch is browser-first but multi-protocol with its own collection model. Reqor is the only open-source client built around `.http` and cURL as the native format, with a repo-native workflow: `cd` into your project, run `reqor serve`, and the `.http` files already in your tree become your collections. No import, no format conversion, no install beyond a CLI binary. If your requests already live in `.http` files next to your code, Reqor is the path of least resistance.

### Q: My team uses both VS Code REST Client and JetBrains HTTP Client syntax. Which `.http` dialect does Reqor support?

A: The MVP targets the **JetBrains HTTP Client dialect** — requests, headers, query params, body, variable references, and environment files as used in IntelliJ IDEA. This matches teams who already commit JetBrains-style `.http` files alongside their code. VS Code REST Client dialect support is planned as a fast-follow after MVP. Advanced scripting directives and edge-case constructs will be documented with an explicit support matrix. If a file doesn't parse, Reqor shows the error inline rather than silently dropping requests.

### Q: Reqor runs in a browser. How does it handle CORS when I'm hitting `localhost:8080` from the UI?

A: Requests don't originate from the browser directly — they go through the Reqor local server, which acts as a proxy. When you run `reqor serve`, the CLI/server component sends HTTP requests on your behalf, exactly like the JetBrains HTTP Client or Bruno does. The browser is the UI; the server is the client. This is a solved pattern, not a hack — but it's worth stating clearly because "browser-based API client" sounds like a CORS nightmare until you understand the architecture.

### Q: You only support REST/HTTP. What if my team also uses GraphQL or gRPC?

A: Reqor deliberately doesn't support those protocols in MVP. The bet is that a large segment of backend developers — especially those maintaining `.http` files — primarily test REST endpoints and are tired of paying for or navigating UI built for protocols they don't use. For GraphQL/gRPC, keep using Insomnia, Bruno, or your IDE. Reqor isn't trying to replace every API tool — it's trying to be the best REST client for repo-native `.http` workflows. A desktop app may extend reach later; multi-protocol support is not on the roadmap.

### Q: What happens to my collections and secrets if Reqor shuts down or you stop maintaining it?

A: Your collections are plain-text `.http` files in your repo — they don't depend on Reqor to exist. Open them in IntelliJ, VS Code, or any `.http` runner tomorrow and they still work. Secrets stored in Reqor's local environment files follow the same principle: plain-text or `.env`-compatible formats you own. Reqor Cloud data would be exportable as `.http` files and environment configs. Open-source means the community can fork and maintain even if the original project stops. No vendor vault, no lock-in.

### Q: Is Reqor free? What's the catch with Reqor Cloud?

A: Reqor is open-source. Local use (`reqor serve`) is free, requires no account, and has no feature paywall for core workflows — collections, history, variables, secrets, export. Reqor Cloud is optional paid hosting for teams who want a shared URL and managed access without running a local server. Pricing follows the Hoppscotch/Bruno model: free self-host forever, modest per-user cloud fee for convenience. The catch isn't hidden features — it's that cloud hosting costs money to run, and that's what you pay for.

### Q: Can I import my Postman collections and go back if I don't like it?

A: Not in the MVP — Reqor launches with native `.http` and cURL only. Postman collection import is planned as a fast-follow to ease migration for teams still on Postman JSON. Going back is always trivial because your working format is `.http`, not a Reqor-specific export. If you already have `.http` files in your repo, you don't need import at all — that's the whole point.

### Q: Why should I trust a new open-source tool over Postman, which has 35M users and enterprise support?

A: You shouldn't trust Reqor because it's new — you should try it because the cost of switching is near zero. Run `reqor serve` in a repo that already has `.http` files. If it works in 60 seconds, keep it. If not, close the tab. Postman's moat is team collaboration infrastructure and enterprise governance — not sending a GET request. Reqor isn't competing on enterprise SSO or API governance; it's competing on "can I hit this endpoint without friction?" For that job, incumbency matters less than whether the tool respects your existing workflow.

### Q: How does team collaboration work without forcing everyone into a cloud account?

A: The primary collaboration model is Git: `.http` files in the repo, reviewed in PRs, edited by anyone with repo access. Reqor Cloud is optional for teams who want a shared browser URL (e.g., QA, PMs, contractors without repo clone). Local `reqor serve` requires no accounts. Team sharing doesn't require Reqor's servers — it requires the same Git workflow you already use for code.

### Q: Does Reqor work offline?

A: Yes. `reqor serve` runs entirely on your machine — no internet required to send requests to local or network endpoints. The UI is served locally. Reqor Cloud obviously requires connectivity, but local mode is fully offline-capable.

<!-- coaching-notes-stage-3 -->
## Coaching Notes — Stage 3 (Customer FAQ)

**Gaps revealed (need user decisions):**
- `.http` dialect support matrix — v1 must document what's in/out explicitly
- Postman import fidelity — how complete is v1 import?
- Reqor Cloud pricing — not finalized; referenced as "modest per-user" model
- Filesystem watch/live reload — not promised in FAQ; clarify in v1 spec

**Trade-off decisions (accepted for v1):**
- REST-only — accepted; GraphQL/gRPC users stay on other tools
- Proxy-via-local-server for CORS — accepted architecture pattern
- Git-as-collaboration primary; cloud secondary

**The hard question answered:** CORS/browser limitation — solved by local server proxy, not browser-direct requests

**Competitive intelligence surfaced:** Switching cost is near-zero if `.http` files already exist; Reqor wins on path-of-least-resistance, not feature count

**Scope signals for downstream PRD:** CLI (`reqor serve`), local proxy server, `.http` parser (JetBrains dialect MVP), environment/secrets management, code snippet export, cURL import/export. Postman import and VS Code dialect deferred post-MVP.

**MVP scope updates (2026-07-08):** JetBrains `.http` dialect only in MVP; VS Code REST Client dialect post-MVP. No Postman import in MVP.

**Stage 3 status:** LOCKED (2026-07-08). User approved all customer FAQ answers without modification.

---

## Internal FAQ

### Q: What's the hardest technical problem to solve in v1?

A: The `.http` parser targeting the **JetBrains HTTP Client dialect** is the hardest problem. There is no canonical spec — JetBrains supports variable syntax, environment files, request separation, and scripting directives that must be handled without silent failures. Building a parser that handles the core constructs used in real JetBrains `.http` files is the critical path. Second hardest: bidirectional sync between the visual editor and on-disk `.http` files without corrupting formatting developers care about in Git diffs. VS Code REST Client dialect is deferred post-MVP to keep the 8-week timeline focused. The proxy server and web UI are well-understood problems; the JetBrains parser is the bet.

### Q: What does v1 actually include — and what gets cut?

A: **In MVP (8 weeks):** CLI (`reqor serve`), local proxy server, web UI for browsing/sending/editing requests, auto-load `.http` files from repo directory, **JetBrains HTTP Client dialect parser**, environment variables and secrets (local), request history, cURL import/export, code snippet export. **Cut from MVP:** Postman collection import (fast-follow), VS Code REST Client dialect (fast-follow), Reqor Cloud, desktop app, filesystem watch/live reload (manual refresh MVP), advanced `.http` scripting, CI/CD integration, team auth/SSO. **Explicit no forever (for now):** mocks, API design, GraphQL/gRPC/WebSocket.

### Q: What's the realistic timeline to a usable v1?

A: **8 weeks to a local-only MVP** — `reqor serve`, web UI, JetBrains `.http` file auto-load and parsing, proxy server, core request send/edit/history, variables/secrets, and cURL export. Postman import and VS Code dialect support land as fast-follows after MVP. Reqor Cloud is explicitly deferred until local adoption is validated. Desktop app is post-v1.

### Q: How does Reqor sustain itself without becoming Postman?

A: Revenue model: open-source local tool (free forever) + optional Reqor Cloud hosting ($5–8/user/month range, aligned with Hoppscotch/Bruno). No feature paywalls on core workflow — the paid tier is infrastructure (hosting, team URLs, managed access), not capability gating. Risk mitigation: keep the OSS core genuinely complete for solo local use; cloud is convenience, not ransom. If cloud never gains traction, the project still has value as OSS — sustainability falls to community contributions and potential sponsorship (GitHub Sponsors, Open Collective).

### Q: Bruno has 40K GitHub stars and the Git-native narrative. Why won't Reqor be "Bruno but worse"?

A: Bruno chose proprietary `.bru` format and desktop-first — forcing a format migration. Reqor's wedge is zero migration: if you already have `.http` files, Reqor works on day one. The risk is real — Bruno has momentum — but the audiences differ: Bruno targets teams willing to adopt a new format; Reqor targets teams who already committed to `.http` in their repos and IDE workflows. Reqor doesn't need to beat Bruno on stars; it needs to be the obvious choice for the `.http`-already-in-repo segment. That's a narrower but defensible niche.

### Q: What's the adoption strategy for the first 1,000 users?

A: **Distribution:** GitHub (open-source), Hacker News / Reddit launch post timed to Postman migration sentiment, Dev.to / blog posts demonstrating `cd repo && reqor serve` workflow, npm package for `@reqor/cli`. **Activation hook:** Zero friction — no account, works in 60 seconds on existing `.http` files. **Content:** "Migrate from Postman in 5 minutes" guide, side-by-side `.http` vs `.bru` vs Postman JSON comparison. **Community:** GitHub issues as feedback loop, Discord for early adopters. **Not doing in v1:** paid ads, sales team, conference sponsorships.

### Q: What kills this project?

A: **Most likely:** Scope creep — adding mocks, GraphQL, or "just one more Postman feature" until Reqor is bloated and indistinguishable from alternatives. **Second:** Parser compatibility frustration — developers try Reqor, their `.http` files break, they leave and don't come back. **Third:** Building cloud before validating local adoption — burning months on infra nobody asked for. **Fourth:** Bruno or Hoppscotch adds native `.http` import/export that's good enough. Mitigation: ruthless scope discipline, parser quality as non-negotiable v1 priority, ship local-first, track `.http` dialect coverage metrics.

### Q: What's the maintenance burden for a solo maintainer?

A: Ongoing: parser updates as VS Code/JetBrains dialects evolve, security patches for proxy server, dependency updates for web UI, community issue triage. Estimate 5–10 hours/week steady state post-v1. Mitigation: MIT/Apache license to attract contributors, modular architecture (parser as separate package others can contribute to), comprehensive test suite with real-world `.http` file fixtures from open-source repos. Accept that v1 launch means signing up for long-term maintenance — budget for it or plan contributor onboarding from day one.

### Q: Any legal, security, or licensing exposure?

A: **Proxy server risk:** Reqor's local server sends HTTP requests on the user's behalf, including to internal/private endpoints. Must document clearly that Reqor runs locally and doesn't exfiltrate data. No telemetry without explicit opt-in. **Secrets handling:** Local secrets in `.env`-compatible files — never log secrets, never send to cloud without explicit user action. **License:** MIT or Apache 2.0 for maximum adoption. **Trademark:** Register "Reqor" early if adoption grows. **Supply chain:** Sign CLI binaries, publish checksums, use Dependabot. Low regulatory exposure — this is a developer tool, not handling end-user data at scale (until cloud, which adds GDPR considerations for EU teams).

### Q: If this succeeds, what does Reqor look like in 3 years?

A: **Best case:** The default REST client for `.http`-native teams — 10K+ GitHub stars, healthy contributor community, Reqor Cloud generating enough revenue to fund 1–2 full-time maintainers. Desktop app (Electron/Tauri) extends reach. `.http` parser becomes a standalone library used by other tools. **Realistic case:** Solid niche tool with 2–5K stars, solo maintainer + occasional contributors, cloud breaks even or modest revenue, known in the "Postman alternative" conversation as the `.http`-native option. **Acceptable case:** Useful OSS tool that never monetizes but saves thousands of developers from Postman bloat — still a win for an open-source project. **Not pursuing:** Enterprise platform, API governance, becoming an "API company."

<!-- coaching-notes-stage-4 -->
## Coaching Notes — Stage 4 (Internal FAQ)

**Feasibility risks identified:**
- JetBrains `.http` dialect parser is critical path and highest technical risk
- Bidirectional file sync (UI ↔ disk) without corrupting Git-friendly formatting
- Bruno adding good `.http` support would compress the niche

**MVP scope (user-confirmed 2026-07-08):**
- **In:** JetBrains HTTP Client dialect only
- **Out of MVP:** Postman import, VS Code REST Client dialect (both fast-follow)

**Resource/timeline estimates:**
- Local v1 MVP: **8 weeks** (user-confirmed) — local run only, no cloud
- Reqor Cloud: defer until post-v1 validation
- Steady-state maintenance: 5–10 hrs/week solo

**Stage 4 status:** LOCKED (2026-07-08). User confirmed 8-week local-only MVP timeline; all other internal FAQ answers approved.

---

## The Verdict

**Concept strength:** Reqor is a **focused, defensible niche product** with a clear hero workflow and honest scope boundaries. The concept survived the gauntlet — the press release tells a coherent story, the customer FAQ holds up under skepticism, and the internal FAQ acknowledges real risks without hand-waving. This is ready for PRD creation with one condition: the `.http` parser must be treated as the product, not a feature.

### Forged in Steel

- **Hero workflow:** `cd repo && reqor serve` → `.http` files become collections. Specific, differentiated, and immediately demonstrable in a 60-second demo.
- **Positioning clarity:** REST-only, no mocks, no API design, no proprietary formats. Scope discipline is a feature, not an apology.
- **Customer persona:** Backend/fullstack devs at 5–50 person teams with `.http` files in repo — narrow enough to build for, large enough to matter.
- **Zero-switching-cost adoption:** No account, no format migration, no install beyond CLI. The "try it and close the tab" pitch is honest.
- **Architecture answer:** Browser-as-UI + local proxy server resolves the CORS objection cleanly.
- **Sustainability model:** OSS core free forever; cloud is infrastructure revenue, not feature ransom — avoids the Postman trap by design.
- **Timeline commitment:** 8-week local-only MVP is aggressive but achievable if scope stays locked.

### Needs More Heat

- **JetBrains dialect support matrix:** Must be defined before week 4 — which JetBrains constructs are in MVP (requests, variables, environments, file inclusion?) vs fast-follow.
- **Bidirectional file sync rules:** How does the visual editor write back to `.http` files without mangling JetBrains formatting? Needs a technical spec before UI work begins.
- **Product naming in npm/registry:** `@reqor/cli` package availability and trademark check — do before public launch.
- **Customer quote:** Still placeholder. Replace with your real experience before external launch.

### Cracks in the Foundation

- **Parser quality is make-or-break.** If Reqor breaks real JetBrains `.http` files on first try, nothing else matters. Mitigation: build JetBrains parser first (weeks 1–3), test against JetBrains-style `.http` fixtures from real repos before touching UI polish.
- **Bruno competitive pressure.** Bruno has momentum and community. If Bruno adds `.http` import that's "good enough," Reqor's wedge narrows. Mitigation: ship fast (8 weeks), own the JetBrains `.http`-native narrative.
- **JetBrains-only MVP limits audience.** Teams on VS Code REST Client dialect won't adopt until fast-follow ships. Mitigation: message MVP clearly as "IntelliJ/JetBrains `.http` first"; ship VS Code dialect soon after.
- **Solo maintainer sustainability.** 5–10 hrs/week post-launch is manageable only if architecture is modular and test coverage is high from day one.

**Overall verdict:** **Forged with heat remaining.** The concept is sound, the niche is real, and the 8-week scope is now tighter and more achievable. Proceed to PRD. Treat the JetBrains parser as week-1 priority.

---
