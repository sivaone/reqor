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

### Stopping dev (when Ctrl+C hangs)

On Windows, `pnpm turbo dev` can occasionally get stuck on `2 tasks shutting down...` if child processes (`tsx watch`, Vite) do not exit cleanly.

1. Press **Ctrl+C** once and wait ~5 seconds.
2. If the terminal is still hung, open a **new** PowerShell window and run:

```powershell
Get-NetTCPConnection -LocalPort 3000,5173,5174 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-Process turbo -ErrorAction SilentlyContinue | Stop-Process -Force
```

3. Close the stuck terminal tab (or press **Ctrl+Break**), then start dev again with `pnpm turbo dev`.

## License
MIT
