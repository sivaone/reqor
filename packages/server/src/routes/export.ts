import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { serializeCurl } from '@reqor/http-parser'
import {
  ApiErrorEnvelope,
  ExportCurlRequest,
  ExportCurlResponse,
  ExportSnippetRequest,
  ExportSnippetResponse,
} from '@reqor/shared-types'
import type { CollectionStore } from '../collection-store.js'
import type { ConfigStore } from '../config-store.js'
import type { EnvResolver } from '../env-resolver.js'
import type { EnvironmentStore } from '../environment-store.js'
import {
  loadMergedRequestForExport,
  loadMergedRequestForSnippetExport,
} from '../load-export-request.js'
import { ExecuteError } from '../proxy/execute-request.js'
import { serializeSnippetJavaScript } from '../serialize-snippet-javascript.js'
import { serializeSnippetPython } from '../serialize-snippet-python.js'

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

  app.post(
    '/api/export/snippet',
    {
      schema: {
        body: ExportSnippetRequest,
        response: {
          200: ExportSnippetResponse,
          400: ApiErrorEnvelope,
          404: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      try {
        const { language, ...previewFields } = request.body
        const redacted = loadMergedRequestForSnippetExport(
          collectionStore,
          previewFields,
          configStore,
          environmentStore,
          envResolver,
        )

        let snippet: string
        switch (language) {
          case 'javascript':
            snippet = serializeSnippetJavaScript(redacted)
            break
          case 'python':
            snippet = serializeSnippetPython(redacted)
            break
          case 'curl':
            snippet = serializeCurl(redacted)
            break
          default:
            return reply.status(400).send({
              error: {
                code: 'INVALID_REQUEST',
                message: 'Invalid snippet language',
              },
            })
        }

        return {
          language,
          snippet,
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
