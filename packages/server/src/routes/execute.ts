import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
  ApiErrorEnvelope,
  ExecuteRequest,
  ExecuteResponse,
} from '@reqor/shared-types'
import type { CollectionStore } from '../collection-store.js'
import type { ConfigStore } from '../config-store.js'
import type { EnvResolver } from '../env-resolver.js'
import type { EnvironmentStore } from '../environment-store.js'
import type { HistoryStore } from '../history-store.js'
import { recordHistoryEntry } from '../record-history-entry.js'
import { ExecuteError, executeRequest } from '../proxy/execute-request.js'
import { resolveEnvironmentName } from '../resolve-environment-name.js'

export interface ExecuteRouteOptions {
  collectionStore: CollectionStore
  configStore: ConfigStore
  environmentStore: EnvironmentStore
  envResolver: EnvResolver
  historyStore: HistoryStore
}

export const executeRoutes: FastifyPluginAsyncTypebox<ExecuteRouteOptions> = async (
  app,
  options,
) => {
  const { collectionStore, configStore, environmentStore, envResolver, historyStore } =
    options

  app.post(
    '/api/execute',
    {
      schema: {
        body: ExecuteRequest,
        response: {
          200: ExecuteResponse,
          400: ApiErrorEnvelope,
          404: ApiErrorEnvelope,
          502: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const abortController = new AbortController()

      const onClose = () => {
        if (!request.raw.complete) {
          abortController.abort()
        }
      }

      request.raw.on('close', onClose)

      try {
        const environmentName = resolveEnvironmentName(
          request.body.environment,
          configStore,
          environmentStore,
        )

        const result = await executeRequest(
          collectionStore,
          request.body,
          { envResolver, environmentName },
          abortController.signal,
        )

        recordHistoryEntry(historyStore, result.history, result.response, app.log)

        return result.response
      } catch (error) {
        if (error instanceof ExecuteError) {
          const status = error.httpStatus as 400 | 404 | 502
          return reply.status(status).send({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          })
        }

        return reply.status(502).send({
          error: {
            code: 'PROXY_FAILED',
            message: 'Unexpected proxy failure',
          },
        })
      } finally {
        request.raw.off('close', onClose)
      }
    },
  )
}
