import { describe, expect, it } from 'vitest'
import { Value } from '@sinclair/typebox/value'
import {
  ApiErrorEnvelope,
  ConfigDto,
  ConfigUpdateRequest,
  CollectionDetailDto,
  CollectionSummaryDto,
  CollectionsListResponse,
  CollectionsRefreshResponse,
  DiagnosticDto,
  ExecuteRequest,
  ExecuteErrorCode,
  ExecuteResponse,
  ExecuteResponseHeaderDto,
  EnvironmentDto,
  EnvironmentsListResponse,
  EnvironmentVariableDto,
  HealthResponse,
  ParseStatus,
  PreviewRequest,
  PreviewResponse,
  RequestBodyDto,
  RequestDto,
  RequestHeaderDto,
  SECRET_MASK,
  type CollectionDetailDtoType,
  type ConfigDtoType,
  type ConfigUpdateRequestType,
  type CollectionSummaryDtoType,
  type DiagnosticDtoType,
  type EnvironmentDtoType,
  type EnvironmentVariableDtoType,
  type ExecuteRequestType,
  type ExecuteResponseHeaderDtoType,
  type ExecuteResponseType,
  type PreviewRequestType,
  type PreviewResponseType,
  type RequestBodyDtoType,
  type RequestHeaderDtoType,
  type RequestDtoType,
} from './index.js'

describe('@reqor/shared-types', () => {
  it('exports HealthResponse schema', () => {
    expect(HealthResponse).toBeDefined()
    expect(HealthResponse.properties.status).toBeDefined()
    expect(HealthResponse.properties.version).toBeDefined()
  })

  it('exports ApiErrorEnvelope schema', () => {
    expect(ApiErrorEnvelope).toBeDefined()
    expect(ApiErrorEnvelope.properties.error).toBeDefined()
  })

  it('validates collection and request DTO sample values', () => {
    const header: RequestHeaderDtoType = {
      name: 'Content-Type',
      value: 'application/json',
    }
    expect(Value.Check(RequestHeaderDto, header)).toBe(true)

    const body: RequestBodyDtoType = {
      kind: 'json',
      content: '{"name":"alice"}',
    }
    expect(Value.Check(RequestBodyDto, body)).toBe(true)

    const request: RequestDtoType = {
      requestIndex: 0,
      fingerprint: 'a'.repeat(64),
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [header],
      body,
    }
    expect(Value.Check(RequestDto, request)).toBe(true)

    const diagnostic: DiagnosticDtoType = {
      line: 1,
      message: 'Parse error',
      code: 'PARSE_ERROR',
    }
    expect(Value.Check(DiagnosticDto, diagnostic)).toBe(true)

    const summary: CollectionSummaryDtoType = {
      id: 'http/users.http',
      parseStatus: 'ok',
      requestCount: 1,
      diagnostics: [],
    }
    expect(Value.Check(CollectionSummaryDto, summary)).toBe(true)

    const detail: CollectionDetailDtoType = {
      id: 'http/users.http',
      content: 'GET https://api.example.com/users',
      parseStatus: 'ok',
      requests: [request],
      diagnostics: [],
    }
    expect(Value.Check(CollectionDetailDto, detail)).toBe(true)

    expect(
      Value.Check(CollectionsListResponse, { collections: [summary] }),
    ).toBe(true)
    expect(
      Value.Check(CollectionsRefreshResponse, { collections: [summary] }),
    ).toBe(true)
    expect(Value.Check(ParseStatus, 'ok')).toBe(true)
    expect(Value.Check(ParseStatus, 'error')).toBe(true)
  })

  it('validates execute request and response DTO sample values', () => {
    expect(Value.Check(ExecuteErrorCode, 'UNRESOLVED_VARIABLE')).toBe(true)
    expect(Value.Check(ExecuteErrorCode, 'NOT_A_CODE')).toBe(false)

    const executeRequest: ExecuteRequestType = {
      collectionId: 'demo.http',
      requestIndex: 0,
      followRedirects: true,
      method: 'GET',
      url: 'https://httpbin.dev/get',
      headers: [{ name: 'Accept', value: 'application/json' }],
      body: null,
      environment: 'development',
    }
    expect(Value.Check(ExecuteRequest, executeRequest)).toBe(true)
    expect(
      Value.Check(ExecuteRequest, {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: null,
      }),
    ).toBe(true)
    expect(
      Value.Check(ExecuteRequest, {
        collectionId: 'demo.http',
        requestIndex: 0,
        body: { kind: 'raw', content: 'hi' },
      }),
    ).toBe(true)

    const header: ExecuteResponseHeaderDtoType = {
      name: 'Content-Type',
      value: 'application/json',
    }
    expect(Value.Check(ExecuteResponseHeaderDto, header)).toBe(true)

    const executeResponse: ExecuteResponseType = {
      status: 200,
      statusText: 'OK',
      headers: [header],
      body: '{"ok":true}',
      timingMs: 98.4,
      sizeBytes: 897,
    }
    expect(Value.Check(ExecuteResponse, executeResponse)).toBe(true)
  })

  it('validates preview request and response DTO sample values', () => {
    const previewRequest: PreviewRequestType = {
      collectionId: 'demo.http',
      requestIndex: 0,
      environment: 'development',
      method: 'GET',
      url: 'https://{{host}}/get',
      headers: [],
      body: null,
    }
    expect(Value.Check(PreviewRequest, previewRequest)).toBe(true)
    expect(
      Value.Check(PreviewRequest, {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: null,
      }),
    ).toBe(true)
    expect(
      Value.Check(PreviewRequest, {
        collectionId: 'demo.http',
        requestIndex: 0,
        headers: [{ name: 'X-Debug', value: '1' }],
        body: { kind: 'json', content: '{}' },
      }),
    ).toBe(true)

    const previewResponse: PreviewResponseType = {
      url: 'https://httpbin.dev/get',
      headers: [{ name: 'Authorization', value: SECRET_MASK }],
      unresolved: null,
      hasVariables: true,
    }
    expect(Value.Check(PreviewResponse, previewResponse)).toBe(true)
    expect(
      Value.Check(PreviewResponse, {
        url: 'https://{{host}}/get',
        headers: [],
        unresolved: { name: 'host', raw: '{{host}}' },
        hasVariables: true,
      }),
    ).toBe(true)
  })

  it('rejects invalid execute DTO values', () => {
    expect(
      Value.Check(ExecuteRequest, {
        collectionId: 'demo.http',
        requestIndex: -1,
      }),
    ).toBe(false)
    expect(
      Value.Check(ExecuteResponse, {
        status: 200,
        statusText: 'OK',
        headers: [],
        body: '',
        timingMs: 10,
        sizeBytes: -1,
      }),
    ).toBe(false)
  })

  it('rejects invalid DTO indexes, counts, lines, and fingerprints', () => {
    expect(
      Value.Check(DiagnosticDto, { line: 0, message: 'Invalid line' }),
    ).toBe(false)
    expect(
      Value.Check(RequestDto, {
        requestIndex: -1,
        fingerprint: 'not-a-sha256',
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
      }),
    ).toBe(false)
    expect(
      Value.Check(CollectionSummaryDto, {
        id: 'users.http',
        parseStatus: 'ok',
        requestCount: 0.5,
        diagnostics: [],
      }),
    ).toBe(false)
  })

  it('exports SECRET_MASK and validates environment DTO sample values', () => {
    expect(SECRET_MASK).toBe('••••••')

    const variable: EnvironmentVariableDtoType = {
      key: 'host',
      value: 'localhost',
      isSecret: false,
    }
    expect(Value.Check(EnvironmentVariableDto, variable)).toBe(true)

    const secretVariable: EnvironmentVariableDtoType = {
      key: 'password',
      value: SECRET_MASK,
      isSecret: true,
    }
    expect(Value.Check(EnvironmentVariableDto, secretVariable)).toBe(true)

    const environment: EnvironmentDtoType = {
      name: 'development',
      sourceFile: 'http-client.env.json',
      variables: [variable, secretVariable],
    }
    expect(Value.Check(EnvironmentDto, environment)).toBe(true)
    expect(Value.Check(EnvironmentsListResponse, { environments: [environment] })).toBe(true)
  })

  it('exports and validates config DTO sample values', () => {
    const config: ConfigDtoType = { activeEnvironment: 'development' }
    expect(Value.Check(ConfigDto, config)).toBe(true)
    expect(Value.Check(ConfigDto, { activeEnvironment: null })).toBe(true)

    const update: ConfigUpdateRequestType = { activeEnvironment: 'staging' }
    expect(Value.Check(ConfigUpdateRequest, update)).toBe(true)
    expect(Value.Check(ConfigUpdateRequest, { activeEnvironment: null })).toBe(true)
    expect(Value.Check(ConfigUpdateRequest, { activeEnvironment: '' })).toBe(false)
  })
})
