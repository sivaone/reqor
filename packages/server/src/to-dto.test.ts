import { describe, expect, it } from 'vitest'
import { DIAG_PARSE_ERROR, parseHttpFile } from '@reqor/http-parser'
import {
  computeFingerprint,
  toCollectionDetail,
  toCollectionSummary,
  toRequestDto,
} from './to-dto.js'

describe('to-dto', () => {
  it('computes stable fingerprint from method and url', () => {
    const first = computeFingerprint('GET', 'https://api.example.com/users')
    const second = computeFingerprint('GET', 'https://api.example.com/users')
    const different = computeFingerprint('POST', 'https://api.example.com/users')

    expect(first).toBe(second)
    expect(first).not.toBe(different)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('keeps fingerprint stable when request index changes', () => {
    const content = `GET https://api.example.com/users

###

POST https://api.example.com/users`

    const parseResult = parseHttpFile(content)
    const first = toRequestDto(parseResult.requests[0]!, 0)
    const second = toRequestDto(parseResult.requests[1]!, 1)

    expect(first.fingerprint).not.toBe(second.fingerprint)
    expect(first.requestIndex).toBe(0)
    expect(second.requestIndex).toBe(1)
  })

  it('maps parse result to collection detail and summary', () => {
    const content = 'GET https://api.example.com/users'
    const parseResult = parseHttpFile(content)
    const detail = toCollectionDetail('http/users.http', content, parseResult)
    const summary = toCollectionSummary(detail)

    expect(detail.parseStatus).toBe('ok')
    expect(detail.requests).toHaveLength(1)
    expect(detail.requests[0]).toMatchObject({
      requestIndex: 0,
      method: 'GET',
      url: 'https://api.example.com/users',
    })
    expect(detail.requests[0]!.headers.every((header) => !('line' in header))).toBe(
      true,
    )
    expect(summary).toEqual({
      id: 'http/users.http',
      parseStatus: 'ok',
      requestCount: 1,
      diagnostics: [],
    })
  })

  it('marks parseStatus error when PARSE_ERROR diagnostics exist', () => {
    const parseResult = parseHttpFile('NOT_A_REQUEST')
    const detail = toCollectionDetail('bad.http', 'NOT_A_REQUEST', parseResult)

    expect(parseResult.diagnostics.some((d) => d.code === DIAG_PARSE_ERROR)).toBe(
      true,
    )
    expect(detail.parseStatus).toBe('error')
  })
})
