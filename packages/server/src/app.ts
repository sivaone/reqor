import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import path from 'node:path'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { HealthResponse } from '@reqor/shared-types'
import { CollectionStore } from './collection-store.js'
import { ConfigStore } from './config-store.js'
import { DotenvStore } from './dotenv-store.js'
import { EnvResolver } from './env-resolver.js'
import { EnvironmentStore } from './environment-store.js'
import { HistoryStore } from './history-store.js'
import { collectionsRoutes } from './routes/collections.js'
import { configRoutes } from './routes/config.js'
import { environmentsRoutes } from './routes/environments.js'
import { executeRoutes } from './routes/execute.js'
import { historyRoutes } from './routes/history.js'
import { previewRoutes } from './routes/preview.js'

export { DEFAULT_HOST, DEFAULT_PORT } from './constants.js'
export { loadReqorLocalEnv } from './load-local-env.js'

export interface BuildAppOptions {
  repositoryRoot: string
  scanOnStart?: boolean
  staticRoot?: string
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify().withTypeProvider<TypeBoxTypeProvider>()
  const collectionStore = new CollectionStore()
  const environmentStore = new EnvironmentStore()
  const dotenvStore = new DotenvStore()
  const envResolver = new EnvResolver(dotenvStore, environmentStore)
  const configStore = new ConfigStore(
    path.join(options.repositoryRoot, '.reqor', 'config.json'),
  )
  const historyStore = new HistoryStore(
    path.join(options.repositoryRoot, '.reqor', 'history.db'),
  )

  if (options.scanOnStart !== false) {
    await Promise.all([
      collectionStore.loadAll(options.repositoryRoot),
      environmentStore.loadAll(options.repositoryRoot),
    ])
  }

  // Dotenv + config load even when scanOnStart is false (same pattern as Story 2.3 config).
  await Promise.all([
    dotenvStore.load(options.repositoryRoot),
    configStore.load(),
  ])

  app.decorate('collectionStore', collectionStore)
  app.decorate('environmentStore', environmentStore)
  app.decorate('dotenvStore', dotenvStore)
  app.decorate('envResolver', envResolver)
  app.decorate('configStore', configStore)

  app.get(
    '/api/health',
    {
      schema: {
        response: {
          200: HealthResponse,
        },
      },
    },
    async () => ({ status: 'ok', version: '0.0.0' }),
  )

  await app.register(collectionsRoutes, {
    collectionStore,
    repositoryRoot: options.repositoryRoot,
  })

  await app.register(environmentsRoutes, {
    environmentStore,
  })

  await app.register(configRoutes, {
    configStore,
    environmentStore,
  })

  await app.register(previewRoutes, {
    collectionStore,
    configStore,
    environmentStore,
    envResolver,
  })

  await app.register(executeRoutes, {
    collectionStore,
    configStore,
    environmentStore,
    envResolver,
    historyStore,
  })

  await app.register(historyRoutes, {
    historyStore,
  })

  app.addHook('onClose', async () => {
    historyStore.close()
  })

  if (options.staticRoot) {
    await app.register(fastifyStatic, {
      root: options.staticRoot,
      prefix: '/',
    })

    app.setNotFoundHandler((request, reply) => {
      const pathname = request.url.split('?')[0] ?? request.url
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Route not found' },
        })
      }

      return reply.sendFile('index.html')
    })
  }

  return app
}
