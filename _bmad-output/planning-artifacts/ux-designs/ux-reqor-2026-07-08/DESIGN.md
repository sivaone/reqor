---
name: Reqor
description: Local-first REST client web UI for JetBrains .http files. Swagger UI–inspired palette; minimal developer-tool chrome.
colors:
  header-background: '#1B1B1B'
  header-foreground: '#FFFFFF'
  background: '#FFFFFF'
  surface: '#FAFAFA'
  surface-muted: '#F0F0F0'
  foreground: '#3B4151'
  foreground-muted: '#777777'
  border: '#D8DDE7'
  border-subtle: '#E8E8E8'
  primary: '#4990E2'
  primary-foreground: '#FFFFFF'
  method-get: '#61AFFE'
  method-post: '#49CC90'
  method-put: '#FCA130'
  method-patch: '#50E3C2'
  method-delete: '#F93E3E'
  method-head: '#9012FE'
  method-options: '#0D5AA7'
  success: '#49CC90'
  warning: '#FCA130'
  error: '#F93E3E'
  secret-masked: '#C4C4C4'
typography:
  body:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  app-title:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 2px
  md: 4px
  lg: 6px
spacing:
  header-height: 48px
  sidebar-width: 280px
  panel-gap: 0px
  inset: 12px
  inset-sm: 8px
components:
  app-header:
    background: '{colors.header-background}'
    foreground: '{colors.header-foreground}'
    height: '{spacing.header-height}'
  button-send:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.foreground}'
    border: '{colors.border}'
    radius: '{rounded.md}'
  method-badge:
    radius: '{rounded.sm}'
    foreground: '#FFFFFF'
  sidebar-tab-active:
    border-bottom: '2px solid {colors.primary}'
    foreground: '{colors.foreground}'
  sidebar-tab-inactive:
    foreground: '{colors.foreground-muted}'
  parse-error-badge:
    background: '{colors.error}'
    foreground: '#FFFFFF'
    radius: '{rounded.sm}'
  response-status-success:
    foreground: '{colors.success}'
  response-status-error:
    foreground: '{colors.error}'
status: final
updated: 2026-07-08
sources:
  - ../../specs/spec-reqor/SPEC.md
  - ../../prds/prd-reqor-2026-07-08/prd.md
  - ../../architecture/architecture-reqor-2026-07-08/ARCHITECTURE-SPINE.md
  - imports/sample-reference.png
  - imports/stitch-reference.html
---

> **Reference hierarchy.** `DESIGN.md` and `EXPERIENCE.md` are the build contract. `imports/sample-reference.png` and `imports/stitch-reference.html` are visual references only — spines win on any conflict.

## Brand & Style

Reqor is a **local-first developer tool** — not a SaaS product, not a collaboration platform. The visual posture is borrowed from **Swagger UI**: neutral surfaces, a dark application header, HTTP method colors as the only chromatic vocabulary, and no decorative chrome. The reference image (`imports/sample-reference.png`) shows the Reqor shell composition; implementation details follow this spine, not the screenshot pixel-for-pixel.

Super simple means: if a surface doesn't help a developer send or inspect an HTTP request, it doesn't ship in MVP.

→ Layout references: `imports/sample-reference.png` (Stitch Reqor shell screenshot), `imports/stitch-reference.html` (interactive HTML). **This spine wins on conflict.**

## Colors

Swagger UI palette, adapted for Reqor's three-pane layout.

- **Header (`#1B1B1B` / white text)** — Application name bar only. The darkest surface in the app. No menu items, no search, no account buttons.
- **Primary action (`#4990E2`)** — Send button, active tab underline, primary links. Swagger's execute-button blue.
- **Method colors** — Standard Swagger HTTP verb palette: GET `#61AFFE`, POST `#49CC90`, PUT `#FCA130`, PATCH `#50E3C2`, DELETE `#F93E3E`, HEAD `#9012FE`, OPTIONS `#0D5AA7`. Used on method badges in sidebar, request line, and history list. Never repurposed for non-HTTP semantics.
- **Surfaces** — `background` white, `surface` `#FAFAFA` for sidebar and response panel backgrounds, `surface-muted` `#F0F0F0` for table headers and inactive areas.
- **Text** — `foreground` `#3B4151` (Swagger body text), `foreground-muted` `#777777` for secondary labels and timestamps.
- **Borders** — `#D8DDE7` dividers between panes; `#E8E8E8` within panels.
- **Semantic** — `success` green for 2xx status, `warning` amber for partial import / full-file rewrite warnings, `error` red for 4xx/5xx status and parse errors. `secret-masked` gray for `••••••` placeholders.

Avoid: gradients, brand illustrations, accent colors outside method palette, dark mode in MVP `[ASSUMPTION]`.

## Typography

System sans-serif throughout — no custom webfonts in MVP `[ASSUMPTION]`. Three roles:

- **Body** — 14px for labels, form fields, sidebar items, response metadata.
- **Label** — 12px semibold uppercase for section headers (Params, Headers, Body) and tab labels.
- **Mono** — 13px for URLs, raw `.http` editor, response body, code snippets.
- **App title** — 16px semibold in header: "Reqor".

## Layout & Spacing

Fixed three-pane layout at **1280px minimum viewport** (per SPEC).

```
┌─────────────────────────────────────────────────────────┐
│ Reqor                              [Environment ▾]      │  app-header
├──────────────┬──────────────────────────────────────────┤
│ Collections │ History │                                 │
│ [search]    │         │  REQUEST PANEL (top, ~50%)      │
│             │         │  method · url · Send            │
│  tree       │  list   │  Params | Headers | Body | Raw  │
│             │         ├─────────────────────────────────┤
│             │         │  RESPONSE PANEL (bottom, ~50%)  │
│             │         │  status · time · size           │
│             │         │  Body | Headers                 │
└──────────────┴─────────┴─────────────────────────────────┘
```

- **Header** — 48px fixed height. Left: app name. Right: environment selector dropdown.
- **Sidebar** — 280px fixed width. Top: Collections | History tab pair. Below active tab: contextual search field. Remaining height: scrollable tree (Collections) or chronological list (History).
- **Main workspace** — Fills remaining width. Vertically split: request panel top, response panel bottom. Split is resizable `[ASSUMPTION: default 50/50, drag handle between panels]`.
- **No** bottom status bar. **No** right vertical utility bar. **No** global top search.

Pane gaps: 0 — borders only (`{colors.border}` 1px). Internal padding: `{spacing.inset}` (12px).

## Elevation & Depth

Flat. No shadows in MVP. Depth is communicated by background tone (`background` vs `surface`) and 1px borders only. Modals (cURL import, snippet copy) use a semi-transparent overlay (`rgba(0,0,0,0.4)`) with a white card — no drop shadow `[ASSUMPTION]`.

## Shapes

Minimal rounding — developer tool, not consumer app.

- Inputs, buttons: `{rounded.md}` (4px)
- Method badges, error pills: `{rounded.sm}` (2px)
- Modals: `{rounded.lg}` (6px)

No pill shapes except method badges.

## Components

| Component | Visual spec |
|---|---|
| **App header** | `{components.app-header}`. Single row. "Reqor" left-aligned. Environment selector right-aligned. No other chrome. |
| **Sidebar tabs** | Text tabs, no background fill. Active: `{components.sidebar-tab-active}`. Inactive: `{components.sidebar-tab-inactive}`. |
| **Contextual search** | Full-width input below tabs. Placeholder: "Filter collections…" or "Filter history…" depending on active tab. `{colors.border}` outline, `{rounded.md}`. |
| **Collection tree row** | File-path label in `{typography.body}`. Method-colored dot or mini-badge per request. Parse-error file: red `{components.parse-error-badge}` icon + line number on expand. |
| **History row** | Method badge + truncated URL + timestamp + status code. Status uses `{components.response-status-success}` or `{components.response-status-error}`. |
| **Request line** | Method dropdown (method-colored when open), URL input (`{typography.mono}`), Send button (`{components.button-send}`). Save button secondary (`{components.button-secondary}`) when draft dirty. |
| **Request sub-tabs** | Underline style matching sidebar tabs. Params, Headers (count), Body, Raw `.http`. |
| **Response status bar** | Inline row above response body: `200 OK · 98 ms · 897 B`. Not a footer — lives inside response panel header. |
| **Response body** | `{typography.mono}` in `{colors.surface}` background. JSON/XML/plain syntax highlighting `[ASSUMPTION: basic highlighter]`. |
| **Secret field** | Masked value in `{colors.secret-masked}`. Never shows plaintext after initial server resolution. |
| **Empty state** | Centered in sidebar or workspace. `{colors.foreground-muted}` text, one line of guidance, no illustration. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use Swagger method colors for HTTP verbs only | Repurpose method colors for UI states |
| Keep header to app name + environment selector | Add menu bar, sign-in, notifications, or global search |
| Put search inside Collections and History tabs | Add a top-bar search |
| Show response metadata inline in the response panel header | Add a bottom status bar |
| Use flat borders and neutral backgrounds | Add shadows, gradients, or marketing chrome |
| Mask secrets with `••••••` gray placeholders | Show plaintext secrets anywhere in UI |
| Use reference image for shell composition | Copy reference elements rejected in spine (New Request, flat list, wrong tabs) |
