import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import {
  ApiErrorEnvelope,
  HistoryEntryDetailDto,
  HistoryListResponse,
} from '@reqor/shared-types'
import type { HistoryStore } from '../history-store.js'
import { toHistoryDetailDto, toHistorySummaryDto } from '../to-history-dto.js'

export interface HistoryRouteOptions {
  historyStore: HistoryStore
}

export const historyRoutes: FastifyPluginAsyncTypebox<HistoryRouteOptions> = async (
  app,
  options,
) => {
  const { historyStore } = options

  app.get(
    '/api/history',
    {
      schema: {
        response: {
          200: HistoryListResponse,
        },
      },
    },
    async () => {
      const entries = historyStore.list().map(toHistorySummaryDto)
      return {
        entries,
        total: entries.length,
      }
    },
  )

  app.get(
    '/api/history/:id',
    {
      schema: {
        params: Type.Object({
          id: Type.String({ pattern: '^[0-9]+$' }),
        }),
        response: {
          200: HistoryEntryDetailDto,
          404: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id)
      const row = historyStore.getById(id)

      if (!row) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'History entry not found',
          },
        })
      }

      return toHistoryDetailDto(row)
    },
  )
}
