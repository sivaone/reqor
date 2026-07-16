import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { HealthResponse } from '@reqor/shared-types'
import { CollectionStore } from './collection-store.js'
import { collectionsRoutes } from './routes/collections.js'
import { executeRoutes } from './routes/execute.js'

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

  if (options.scanOnStart !== false) {
    await collectionStore.loadAll(options.repositoryRoot)
  }

  app.decorate('collectionStore', collectionStore)

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

  await app.register(executeRoutes, {
    collectionStore,
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
