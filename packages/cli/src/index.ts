import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildApp,
  DEFAULT_HOST,
  DEFAULT_PORT,
  loadReqorLocalEnv,
} from '@reqor/server'
import { ensureReqorBootstrap } from './bootstrap-reqor-dir.js'
import { resolveBrowserOpenCommand } from './browser-open.js'
import { formatServeUrl, parseCliArgs } from './cli-args.js'
import { formatRepositoryAccessError } from './repository-path.js'
import { resolveStaticRoot } from './resolve-static-root.js'

let app: Awaited<ReturnType<typeof buildApp>> | undefined
let shuttingDown = false

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
if (process.platform === 'win32') {
  SHUTDOWN_SIGNALS.push('SIGBREAK')
}

function registerGracefulShutdown(): void {
  async function shutdown(signal: NodeJS.Signals) {
    if (shuttingDown) {
      return
    }
    shuttingDown = true

    if (!app) {
      process.exit(0)
      return
    }

    try {
      await app.close()
      process.exit(0)
    } catch (err) {
      console.error(`Failed to shut down after ${signal}:`, err)
      process.exit(1)
    }
  }

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, () => {
      void shutdown(signal)
    })
  }
}

function openBrowser(url: string): void {
  try {
    const { command, args } = resolveBrowserOpenCommand(url, process.platform)
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  } catch (err) {
    console.warn(`Could not open browser: ${String(err)}`)
  }
}

export async function serve(pathArg?: string): Promise<void> {
  const repositoryRoot = path.resolve(pathArg ?? process.cwd())

  try {
    const stat = await fs.stat(repositoryRoot)
    if (!stat.isDirectory()) {
      console.error(`Path is not a directory: ${repositoryRoot}`)
      process.exit(1)
    }
  } catch (err) {
    console.error(formatRepositoryAccessError(repositoryRoot, err))
    process.exit(1)
  }

  await ensureReqorBootstrap(repositoryRoot)
  loadReqorLocalEnv(repositoryRoot)

  const staticRoot = resolveStaticRoot()
  app = await buildApp({ repositoryRoot, staticRoot })

  try {
    await app.listen({ host: DEFAULT_HOST, port: DEFAULT_PORT })
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
      console.error(
        'Port 3000 is already in use. Stop the other process or choose a different port.',
      )
      process.exit(1)
    }
    throw err
  }

  const url = formatServeUrl(DEFAULT_HOST, DEFAULT_PORT)
  console.log(`Reqor running at ${url}`)
  openBrowser(url)
}

function isCliMain(): boolean {
  const entry = process.argv[1]
  if (entry === undefined) {
    return false
  }

  try {
    return (
      realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
    )
  } catch {
    return false
  }
}

if (isCliMain()) {
  registerGracefulShutdown()

  const parsed = parseCliArgs(process.argv.slice(2))

  if (!parsed) {
    console.error('Usage: reqor serve [path]')
    process.exit(1)
  }

  if (parsed.command === 'serve') {
    serve(parsed.repositoryPath).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
