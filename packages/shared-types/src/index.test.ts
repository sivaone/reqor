import { describe, expect, it } from 'vitest'
import { Value } from '@sinclair/typebox/value'
import {
  ApiErrorEnvelope,
  CollectionDetailDto,
  CollectionSummaryDto,
  CollectionsListResponse,
  CollectionsRefreshResponse,
  DiagnosticDto,
  HealthResponse,
  ParseStatus,
  RequestBodyDto,
  RequestDto,
  RequestHeaderDto,
  type CollectionDetailDtoType,
  type CollectionSummaryDtoType,
  type DiagnosticDtoType,
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
})
