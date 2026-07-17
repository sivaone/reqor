import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { ApiErrorEnvelope, ConfigDto, ConfigUpdateRequest } from '@reqor/shared-types'
import type { ConfigStore } from '../config-store.js'
import type { EnvironmentStore } from '../environment-store.js'

export interface ConfigRouteOptions {
  configStore: ConfigStore
  environmentStore: EnvironmentStore
}

export const configRoutes: FastifyPluginAsyncTypebox<ConfigRouteOptions> = async (
  app,
  options,
) => {
  const { configStore, environmentStore } = options

  app.get(
    '/api/config',
    {
      schema: {
        response: {
          200: ConfigDto,
        },
      },
    },
    async () => configStore.get(),
  )

  app.put(
    '/api/config',
    {
      schema: {
        body: ConfigUpdateRequest,
        response: {
          200: ConfigDto,
          400: ApiErrorEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { activeEnvironment } = request.body

      if (activeEnvironment !== null && !environmentStore.get(activeEnvironment)) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_ENVIRONMENT',
            message: 'Environment not found',
            details: { name: activeEnvironment },
          },
        })
      }

      return configStore.save({ activeEnvironment })
    },
  )
}
