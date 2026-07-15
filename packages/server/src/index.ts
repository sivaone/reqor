import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { DEFAULT_HOST, DEFAULT_PORT } from './constants.js'
import { loadReqorLocalEnv } from './load-local-env.js'
import { resolveRepositoryRoot } from './resolve-repository-root.js'

let app: FastifyInstance | undefined
let shuttingDown = false

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
if (process.platform === 'win32') {
  SHUTDOWN_SIGNALS.push('SIGBREAK')
}

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

async function start() {
  loadReqorLocalEnv()
  const repositoryRoot = resolveRepositoryRoot()
  app = await buildApp({ repositoryRoot })
  await app.listen({ host: DEFAULT_HOST, port: DEFAULT_PORT })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
