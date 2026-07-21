import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
  ApiErrorEnvelope,
  CollectionDetailDto,
  CollectionsListResponse,
  CollectionsRefreshResponse,
  SaveCollectionRequest,
  SaveCollectionResponse,
  SyncCollectionRequest,
  SyncCollectionResponse,
} from '@reqor/shared-types'
import type { CollectionStore } from '../collection-store.js'
import { minimalDiffSave } from '../save-collection.js'
import { syncCollection } from '../sync-collection.js'

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

  // Register sync before the generic GET `*` detail route for clarity.
  // URL shape: POST /api/collections/<id>/sync where id may contain slashes.
  // find-my-way trailing `*` would swallow `/sync`, so we accept `*` and strip suffix.
  app.post(
    '/api/collections/*',
    {
      schema: {
        body: SyncCollectionRequest,
        response: {
          200: SyncCollectionResponse,
          400: ApiErrorEnvelope,
          404: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { '*': string }
      const raw = params['*'] ?? ''
      if (!raw.endsWith('/sync')) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Collection sync route not found',
            details: { path: raw },
          },
        })
      }

      const id = raw.slice(0, -'/sync'.length)
      if (!id) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Collection not found',
            details: { id },
          },
        })
      }

      // Verify collection exists on disk (sync itself is in-memory content from client).
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

      const body = request.body
      const result = syncCollection(id, {
        content: body.content,
        requestIndex: body.requestIndex,
        patch: body.patch,
      })

      if (!result.ok) {
        return reply.status(400).send({
          error: {
            code: result.code,
            message: result.message,
          },
        })
      }

      return result.response
    },
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

  app.put(
    '/api/collections/*',
    {
      schema: {
        body: SaveCollectionRequest,
        response: {
          200: SaveCollectionResponse,
          400: ApiErrorEnvelope,
          404: ApiErrorEnvelope,
          500: ApiErrorEnvelope,
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

      const disk = await collectionStore.readDiskContent(id, repositoryRoot)
      if (!disk.ok) {
        const status = disk.code === 'NOT_FOUND' ? 404 : 500
        return reply.status(status).send({
          error: {
            code: disk.code,
            message: disk.message,
            details: { id },
          },
        })
      }

      const diff = minimalDiffSave(disk.content, request.body.content)
      if (!diff.ok) {
        return reply.status(400).send({
          error: {
            code: diff.code,
            message: diff.message,
            details: { line: diff.line },
          },
        })
      }

      const saved = await collectionStore.save(id, diff.content, repositoryRoot)
      if (!saved.ok) {
        const status = saved.code === 'NOT_FOUND' ? 404 : 500
        return reply.status(status).send({
          error: {
            code: saved.code,
            message: saved.message,
            details: { id },
          },
        })
      }

      return {
        savedAt: new Date().toISOString(),
        content: saved.detail.content,
        parseStatus: saved.detail.parseStatus,
        requests: saved.detail.requests,
        diagnostics: saved.detail.diagnostics,
        ...(diff.warning ? { warning: diff.warning } : {}),
      }
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
