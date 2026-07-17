import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { EnvironmentsListResponse } from '@reqor/shared-types'
import type { EnvironmentStore } from '../environment-store.js'

export interface EnvironmentsRouteOptions {
  environmentStore: EnvironmentStore
}

export const environmentsRoutes: FastifyPluginAsyncTypebox<
  EnvironmentsRouteOptions
> = async (app, options) => {
  const { environmentStore } = options

  app.get(
    '/api/environments',
    {
      schema: {
        response: {
          200: EnvironmentsListResponse,
        },
      },
    },
    async () => ({ environments: environmentStore.list() }),
  )
}
