# Reqor

Local-first HTTP client for `.http` collections — monorepo scaffold.

## Prerequisites

- **Node.js** 24.x (`>=24 <25`) — see `.nvmrc`
- **pnpm** 11.x

## Repository structure

```
packages/
  cli/            @reqor/cli — CLI entry (stub)
  server/         @reqor/server — Fastify API
  web/            @reqor/web — Vite + React UI
  http-parser/    @reqor/http-parser — parser stub
  shared-types/   @reqor/shared-types — TypeBox schemas
```

## Commands

```bash
pnpm install
pnpm turbo build
pnpm turbo test
pnpm turbo typecheck
pnpm turbo dev    # Vite :5173, Fastify :3000
```

Open [http://localhost:5173](http://localhost:5173) — the UI proxies `/api` to the server and displays the health response.

### Stopping dev

Press **Ctrl+C** once in the dev terminal. Turbo runs with `--ui=stream` so shutdown signals reach `tsx watch` and Vite on Windows, and the Fastify server closes its listener before exit.

If the terminal still hangs after ~5 seconds, press **Ctrl+C** again to force quit, or **Ctrl+Break** in PowerShell. As a last resort, free ports 3000 and 5173:

```powershell
Get-NetTCPConnection -LocalPort 3000,5173 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## License
MIT
