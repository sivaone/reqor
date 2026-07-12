import { Type, type Static } from '@sinclair/typebox'

export const HealthResponse = Type.Object({
  status: Type.String(),
  version: Type.String(),
})

export type HealthResponseType = Static<typeof HealthResponse>

export const ApiErrorEnvelope = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    details: Type.Optional(Type.Unknown()),
  }),
})

export type ApiErrorEnvelopeType = Static<typeof ApiErrorEnvelope>
