import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { HealthResponse } from '@reqor/shared-types'

export function buildApp() {
  const app = Fastify().withTypeProvider<TypeBoxTypeProvider>()

  app.get(
    '/api/health',
    {
      schema: {
        response: {
          200: HealthResponse,
        },
      },
    },
    async () => ({ status: 'ok', version: '0.0.0' }),
  )

  return app
}
