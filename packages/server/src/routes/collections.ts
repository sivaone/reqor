import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
  ApiErrorEnvelope,
  CollectionDetailDto,
  CollectionsListResponse,
  CollectionsRefreshResponse,
} from '@reqor/shared-types'
import type { CollectionStore } from '../collection-store.js'

export interface CollectionsRouteOptions {
  collectionStore: CollectionStore
  repositoryRoot: string
}

// Collection ids are repo-relative paths (e.g. http/users.http) and contain
// slashes. Fastify wildcard `*` captures the full remainder after the prefix.
export const collectionsRoutes: FastifyPluginAsyncTypebox<
  CollectionsRouteOptions
> = async (app, options) => {
  const { collectionStore, repositoryRoot } = options

  app.get(
    '/api/collections',
    {
      schema: {
        response: {
          200: CollectionsListResponse,
        },
      },
    },
    async () => ({ collections: collectionStore.list() }),
  )

  app.get(
    '/api/collections/*',
    {
      schema: {
        response: {
          200: CollectionDetailDto,
          404: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { '*': string }
      const id = params['*'] ?? ''

      const collection = collectionStore.get(id)
      if (!collection) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Collection not found',
            details: { id },
          },
        })
      }

      return collection
    },
  )

  app.post(
    '/api/collections/refresh',
    {
      schema: {
        response: {
          200: CollectionsRefreshResponse,
          500: ApiErrorEnvelope,
        },
      },
    },
    async (_request, reply) => {
      try {
        const collections = await collectionStore.loadAll(repositoryRoot)
        return { collections }
      } catch {
        return reply.status(500).send({
          error: {
            code: 'REFRESH_FAILED',
            message: 'Failed to refresh collections',
          },
        })
      }
    },
  )
}
