import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { HealthResponse } from '@reqor/shared-types'
import { CollectionStore } from './collection-store.js'
import { collectionsRoutes } from './routes/collections.js'

export interface BuildAppOptions {
  repositoryRoot: string
  scanOnStart?: boolean
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

  return app
}
