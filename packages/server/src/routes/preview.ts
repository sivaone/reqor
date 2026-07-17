import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
  ApiErrorEnvelope,
  PreviewRequest,
  PreviewResponse,
} from '@reqor/shared-types'
import type { CollectionStore } from '../collection-store.js'
import type { ConfigStore } from '../config-store.js'
import type { EnvResolver } from '../env-resolver.js'
import type { EnvironmentStore } from '../environment-store.js'
import { redactSecrets } from '../redact-secrets.js'
import { resolveEnvironmentName } from '../resolve-environment-name.js'
import { resolveRequest } from '../resolve-request.js'

export interface PreviewRouteOptions {
  collectionStore: CollectionStore
  configStore: ConfigStore
  environmentStore: EnvironmentStore
  envResolver: EnvResolver
}

export const previewRoutes: FastifyPluginAsyncTypebox<PreviewRouteOptions> = async (
  app,
  options,
) => {
  const { collectionStore, configStore, environmentStore, envResolver } = options

  app.post(
    '/api/preview',
    {
      schema: {
        body: PreviewRequest,
        response: {
          200: PreviewResponse,
          400: ApiErrorEnvelope,
          404: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const collection = collectionStore.get(request.body.collectionId)
      if (!collection) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Collection not found',
            details: { collectionId: request.body.collectionId },
          },
        })
      }

      if (collection.parseStatus === 'error') {
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Collection has parse errors',
            details: { collectionId: request.body.collectionId },
          },
        })
      }

      const req = collection.requests[request.body.requestIndex]
      if (!req) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Request not found',
            details: {
              collectionId: request.body.collectionId,
              requestIndex: request.body.requestIndex,
            },
          },
        })
      }

      const environmentName = resolveEnvironmentName(
        request.body.environment,
        configStore,
        environmentStore,
      )

      const method = (request.body.method ?? req.method).toUpperCase().trim()
      const url = request.body.url ?? req.url

      const resolution = resolveRequest(
        {
          method,
          url,
          headers: req.headers.map((header) => ({
            name: header.name,
            value: header.value,
          })),
          ...(req.body
            ? { body: { kind: req.body.kind, content: req.body.content } }
            : {}),
          environmentName,
        },
        envResolver,
      )

      const secrets = resolution.secrets
      const redactedUrl = redactSecrets(resolution.resolved.url, secrets)
      const redactedHeaders = resolution.resolved.headers.map((header) => ({
        name: header.name,
        value: redactSecrets(header.value, secrets),
      }))

      return {
        url: redactedUrl,
        headers: redactedHeaders,
        unresolved: resolution.unresolved,
        hasVariables: resolution.hasVariables,
      }
    },
  )
}
