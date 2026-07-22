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
  /** Draft header override; omit to use disk request headers */
  headers: Type.Optional(Type.Array(RequestHeaderDto)),
  /** Draft body override; `null` clears disk body; omit to keep disk body */
  body: Type.Optional(Type.Union([RequestBodyDto, Type.Null()])),
  /** Active environment override; omit to use configStore.activeEnvironment */
  environment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
})

export type ExecuteRequestType = Static<typeof ExecuteRequest>

export const ExecuteErrorCode = Type.Union([
  Type.Literal('NOT_FOUND'),
  Type.Literal('INVALID_REQUEST'),
  Type.Literal('PROXY_FAILED'),
  Type.Literal('TOO_MANY_REDIRECTS'),
  Type.Literal('UNRESOLVED_VARIABLE'),
])

export type ExecuteErrorCodeType = Static<typeof ExecuteErrorCode>

export const PreviewRequest = Type.Object({
  collectionId: Type.String(),
  requestIndex: Type.Integer({ minimum: 0 }),
  environment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  method: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
  /** Draft header override; omit to use disk request headers */
  headers: Type.Optional(Type.Array(RequestHeaderDto)),
  /** Draft body override; `null` clears disk body; omit to keep disk body */
  body: Type.Optional(Type.Union([RequestBodyDto, Type.Null()])),
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

export const SyncCollectionPatch = Type.Object({
  method: Type.String(),
  url: Type.String(),
  headers: Type.Array(RequestHeaderDto),
  /** `null` clears body; omit keeps body unchanged only when patch omitted entirely */
  body: Type.Optional(Type.Union([RequestBodyDto, Type.Null()])),
})

export type SyncCollectionPatchType = Static<typeof SyncCollectionPatch>

export const SyncCollectionRequest = Type.Object({
  content: Type.String(),
  requestIndex: Type.Optional(Type.Integer({ minimum: 0 })),
  patch: Type.Optional(SyncCollectionPatch),
})

export type SyncCollectionRequestType = Static<typeof SyncCollectionRequest>

export const SyncCollectionResponse = Type.Object({
  content: Type.String(),
  parseStatus: ParseStatus,
  requests: Type.Array(RequestDto),
  diagnostics: Type.Array(DiagnosticDto),
})

export type SyncCollectionResponseType = Static<typeof SyncCollectionResponse>

export const SaveCollectionRequest = Type.Object({
  content: Type.String(),
})

export type SaveCollectionRequestType = Static<typeof SaveCollectionRequest>

export const SaveCollectionWarning = Type.Object({
  code: Type.Literal('FULL_REWRITE'),
  message: Type.String(),
})

export type SaveCollectionWarningType = Static<typeof SaveCollectionWarning>

export const SaveCollectionResponse = Type.Object({
  savedAt: Type.String(),
  content: Type.String(),
  parseStatus: ParseStatus,
  requests: Type.Array(RequestDto),
  diagnostics: Type.Array(DiagnosticDto),
  warning: Type.Optional(SaveCollectionWarning),
})

export type SaveCollectionResponseType = Static<typeof SaveCollectionResponse>

export const HistoryEntrySummaryDto = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  sentAt: Type.String(),
  environmentName: Type.Union([Type.String(), Type.Null()]),
  collectionId: Type.String(),
  fingerprint: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  method: Type.String(),
  url: Type.String(),
  statusCode: Type.Integer(),
  durationMs: Type.Number(),
  sizeBytes: Type.Integer({ minimum: 0 }),
  body: Type.String(),
  bodyTruncated: Type.Boolean(),
})

export type HistoryEntrySummaryDtoType = Static<typeof HistoryEntrySummaryDto>

export const HistoryEntryDetailDto = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  sentAt: Type.String(),
  environmentName: Type.Union([Type.String(), Type.Null()]),
  collectionId: Type.String(),
  fingerprint: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  method: Type.String(),
  url: Type.String(),
  statusCode: Type.Integer(),
  statusText: Type.String(),
  durationMs: Type.Number(),
  sizeBytes: Type.Integer({ minimum: 0 }),
  responseHeaders: Type.Array(ExecuteResponseHeaderDto),
  body: Type.String(),
  bodyTruncated: Type.Literal(false),
})

export type HistoryEntryDetailDtoType = Static<typeof HistoryEntryDetailDto>

export const HistoryListResponse = Type.Object({
  entries: Type.Array(HistoryEntrySummaryDto),
  total: Type.Integer({ minimum: 0 }),
})

export type HistoryListResponseType = Static<typeof HistoryListResponse>

export const ImportedRequestDto = Type.Object({
  method: Type.String(),
  url: Type.String(),
  headers: Type.Array(RequestHeaderDto),
  body: Type.Optional(RequestBodyDto),
})

export type ImportedRequestDtoType = Static<typeof ImportedRequestDto>

export const ImportCurlRequest = Type.Object({
  curl: Type.String(),
})

export type ImportCurlRequestType = Static<typeof ImportCurlRequest>

export const ImportCurlResponse = Type.Object({
  request: ImportedRequestDto,
  warnings: Type.Array(Type.String()),
})

export type ImportCurlResponseType = Static<typeof ImportCurlResponse>

/** Same draft-aware identity/body shape as preview (Story 5.2). */
export const ExportCurlRequest = PreviewRequest

export type ExportCurlRequestType = PreviewRequestType

export const ExportCurlResponse = Type.Object({
  curl: Type.String(),
})

export type ExportCurlResponseType = Static<typeof ExportCurlResponse>
