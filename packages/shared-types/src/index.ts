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

export const ParseStatus = Type.Union([
  Type.Literal('ok'),
  Type.Literal('error'),
])

export type ParseStatusType = Static<typeof ParseStatus>

export const DiagnosticDto = Type.Object({
  line: Type.Integer({ minimum: 1 }),
  message: Type.String(),
  code: Type.Optional(Type.String()),
})

export type DiagnosticDtoType = Static<typeof DiagnosticDto>

export const RequestBodyDto = Type.Object({
  kind: Type.Union([
    Type.Literal('raw'),
    Type.Literal('json'),
    Type.Literal('form'),
  ]),
  content: Type.String(),
})

export type RequestBodyDtoType = Static<typeof RequestBodyDto>

export const RequestHeaderDto = Type.Object({
  name: Type.String(),
  value: Type.String(),
})

export type RequestHeaderDtoType = Static<typeof RequestHeaderDto>

export const RequestDto = Type.Object({
  requestIndex: Type.Integer({ minimum: 0 }),
  fingerprint: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  method: Type.String(),
  url: Type.String(),
  httpVersion: Type.Optional(Type.String()),
  headers: Type.Array(RequestHeaderDto),
  body: Type.Optional(RequestBodyDto),
})

export type RequestDtoType = Static<typeof RequestDto>

export const CollectionSummaryDto = Type.Object({
  id: Type.String(),
  parseStatus: ParseStatus,
  requestCount: Type.Integer({ minimum: 0 }),
  diagnostics: Type.Array(DiagnosticDto),
})

export type CollectionSummaryDtoType = Static<typeof CollectionSummaryDto>

export const CollectionDetailDto = Type.Object({
  id: Type.String(),
  content: Type.String(),
  parseStatus: ParseStatus,
  requests: Type.Array(RequestDto),
  diagnostics: Type.Array(DiagnosticDto),
})

export type CollectionDetailDtoType = Static<typeof CollectionDetailDto>

export const CollectionsListResponse = Type.Object({
  collections: Type.Array(CollectionSummaryDto),
})

export type CollectionsListResponseType = Static<typeof CollectionsListResponse>

export const CollectionsRefreshResponse = Type.Object({
  collections: Type.Array(CollectionSummaryDto),
})

export type CollectionsRefreshResponseType = Static<
  typeof CollectionsRefreshResponse
>

export const ExecuteRequest = Type.Object({
  collectionId: Type.String(),
  requestIndex: Type.Integer({ minimum: 0 }),
  followRedirects: Type.Optional(Type.Boolean()),
  method: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
  /** Active environment override; omit to use configStore.activeEnvironment */
  environment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
})

export type ExecuteRequestType = Static<typeof ExecuteRequest>

export const PreviewRequest = Type.Object({
  collectionId: Type.String(),
  requestIndex: Type.Integer({ minimum: 0 }),
  environment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  method: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
})

export type PreviewRequestType = Static<typeof PreviewRequest>

export const PreviewUnresolvedDto = Type.Object({
  name: Type.String(),
  raw: Type.String(),
})

export type PreviewUnresolvedDtoType = Static<typeof PreviewUnresolvedDto>

export const PreviewResponse = Type.Object({
  url: Type.String(),
  headers: Type.Array(RequestHeaderDto),
  unresolved: Type.Union([PreviewUnresolvedDto, Type.Null()]),
  hasVariables: Type.Boolean(),
})

export type PreviewResponseType = Static<typeof PreviewResponse>

export const ExecuteResponseHeaderDto = Type.Object({
  name: Type.String(),
  value: Type.String(),
})

export type ExecuteResponseHeaderDtoType = Static<typeof ExecuteResponseHeaderDto>

export const ExecuteResponse = Type.Object({
  status: Type.Integer(),
  statusText: Type.String(),
  headers: Type.Array(ExecuteResponseHeaderDto),
  body: Type.String(),
  timingMs: Type.Number(),
  sizeBytes: Type.Integer({ minimum: 0 }),
})

export type ExecuteResponseType = Static<typeof ExecuteResponse>

/** Six bullet characters — matches UX-DR14 / web --color-secret-masked */
export const SECRET_MASK = '••••••'

export const EnvironmentVariableDto = Type.Object({
  key: Type.String(),
  /** Plaintext for non-secrets; redacted mask for secrets (never plaintext secrets) */
  value: Type.String(),
  isSecret: Type.Boolean(),
})

export type EnvironmentVariableDtoType = Static<typeof EnvironmentVariableDto>

export const EnvironmentDto = Type.Object({
  name: Type.String(),
  sourceFile: Type.String(),
  variables: Type.Array(EnvironmentVariableDto),
})

export type EnvironmentDtoType = Static<typeof EnvironmentDto>

export const EnvironmentsListResponse = Type.Object({
  environments: Type.Array(EnvironmentDto),
})

export type EnvironmentsListResponseType = Static<typeof EnvironmentsListResponse>

export const ConfigDto = Type.Object({
  /** Persisted active environment name; null when none selected */
  activeEnvironment: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
})

export type ConfigDtoType = Static<typeof ConfigDto>

export const ConfigUpdateRequest = Type.Object({
  activeEnvironment: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
})

export type ConfigUpdateRequestType = Static<typeof ConfigUpdateRequest>
