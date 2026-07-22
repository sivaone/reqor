import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { serializeCurl } from '@reqor/http-parser'
import {
  ApiErrorEnvelope,
  ExportCurlRequest,
  ExportCurlResponse,
} from '@reqor/shared-types'
import type { CollectionStore } from '../collection-store.js'
import type { ConfigStore } from '../config-store.js'
import type { EnvResolver } from '../env-resolver.js'
import type { EnvironmentStore } from '../environment-store.js'
import { loadMergedRequestForExport } from '../load-export-request.js'
import { ExecuteError } from '../proxy/execute-request.js'

export interface ExportRouteOptions {
  collectionStore: CollectionStore
  configStore: ConfigStore
  environmentStore: EnvironmentStore
  envResolver: EnvResolver
}

export const exportRoutes: FastifyPluginAsyncTypebox<ExportRouteOptions> = async (
  app,
  options,
) => {
  const { collectionStore, configStore, environmentStore, envResolver } = options

  app.post(
    '/api/export/curl',
    {
      schema: {
        body: ExportCurlRequest,
        response: {
          200: ExportCurlResponse,
          400: ApiErrorEnvelope,
          404: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const redacted = loadMergedRequestForExport(
          collectionStore,
          request.body,
          configStore,
          environmentStore,
          envResolver,
        )

        return {
          curl: serializeCurl(redacted),
        }
      } catch (error) {
        if (error instanceof ExecuteError) {
          const status = error.httpStatus as 400 | 404
          return reply.status(status).send({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          })
        }

        throw error
      }
    },
  )
}
