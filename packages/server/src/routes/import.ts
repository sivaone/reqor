import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { parseCurl } from '@reqor/http-parser'
import {
  ApiErrorEnvelope,
  ImportCurlRequest,
  ImportCurlResponse,
} from '@reqor/shared-types'

export const importRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post(
    '/api/import/curl',
    {
      schema: {
        body: ImportCurlRequest,
        response: {
          200: ImportCurlResponse,
          400: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const curl = request.body.curl.trim()
      if (!curl) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_CURL',
            message: 'cURL command is empty',
          },
        })
      }

      let parsed
      try {
        parsed = parseCurl(curl)
      } catch {
        return reply.status(400).send({
          error: {
            code: 'INVALID_CURL',
            message: 'Failed to parse cURL command',
          },
        })
      }

      if (!parsed.url) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_CURL',
            message: 'No URL found in cURL command',
            details: { warnings: parsed.warnings },
          },
        })
      }

      return {
        request: {
          method: parsed.method,
          url: parsed.url,
          headers: parsed.headers,
          body: parsed.body,
        },
        warnings: parsed.warnings,
      }
    },
  )
}
