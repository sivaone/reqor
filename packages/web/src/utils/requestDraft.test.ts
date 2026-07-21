import type { RequestDtoType } from '@reqor/shared-types'
import { describe, expect, it } from 'vitest'
import {
  applyUrlParams,
  draftEquals,
  draftFromRequest,
  parseUrlParams,
  structuredFieldsDifferFromBaseline,
  validateRequestDraft,
  type RequestDraft,
} from './requestDraft.js'

const baseRequest: RequestDtoType = {
  requestIndex: 0,
  fingerprint: 'a'.repeat(64),
  method: 'get',
  url: 'https://httpbin.dev/get?x=1',
  headers: [{ name: 'Accept', value: 'application/json' }],
  body: { kind: 'json', content: '{"a":1}' },
}

describe('draftFromRequest / draftEquals', () => {
  it('copies method uppercased and deep-clones headers/body including content', () => {
    const draft = draftFromRequest(baseRequest, 'GET https://example.com\n')
    expect(draft.method).toBe('GET')
    expect(draft.url).toBe('https://httpbin.dev/get?x=1')
    expect(draft.content).toBe('GET https://example.com\n')
    expect(draft.headers).toEqual([{ name: 'Accept', value: 'application/json' }])
    expect(draft.body).toEqual({ kind: 'json', content: '{"a":1}' })
    draft.headers[0]!.name = 'X'
    expect(baseRequest.headers[0]!.name).toBe('Accept')
  })

  it('omits body when request has none', () => {
    const draft = draftFromRequest({ ...baseRequest, body: undefined }, '')
    expect(draft.body).toBeUndefined()
  })

  it('detects dirty when any field differs including content', () => {
    const a = draftFromRequest(baseRequest, 'file-a')
    const b = draftFromRequest(baseRequest, 'file-a')
    expect(draftEquals(a, b)).toBe(true)
    expect(draftEquals(a, { ...b, content: 'file-b' })).toBe(false)
    expect(draftEquals(a, { ...b, method: 'POST' })).toBe(false)
    expect(draftEquals(a, { ...b, url: 'https://other' })).toBe(false)
    expect(draftEquals(a, { ...b, headers: [] })).toBe(false)
    expect(draftEquals(a, { ...b, body: { kind: 'raw', content: '' } })).toBe(false)
    const noBody = { ...b }
    delete noBody.body
    expect(draftEquals(a, noBody)).toBe(false)
  })
})

describe('structuredFieldsDifferFromBaseline', () => {
  const baseline = {
    content: 'GET https://example.com',
    method: 'GET',
    url: 'https://example.com',
    headers: [],
  }

  it('returns true when structured fields change but content stays stale', () => {
    const draft = {
      ...baseline,
      url: 'https://example.com/edited',
    }
    expect(structuredFieldsDifferFromBaseline(draft, baseline)).toBe(true)
  })

  it('returns false when only raw content changes', () => {
    const draft = {
      ...baseline,
      content: 'POST https://example.com',
    }
    expect(structuredFieldsDifferFromBaseline(draft, baseline)).toBe(false)
  })
})

describe('parseUrlParams / applyUrlParams', () => {
  it('round-trips absolute URL query params', () => {
    const url = 'https://httpbin.dev/get?retry=1&name=priya'
    const params = parseUrlParams(url)
    expect(params).toEqual([
      { key: 'retry', value: '1' },
      { key: 'name', value: 'priya' },
    ])
    expect(applyUrlParams(url, params)).toBe(url)
  })

  it('round-trips relative path with query', () => {
    const url = '/api/users?x=1'
    expect(parseUrlParams(url)).toEqual([{ key: 'x', value: '1' }])
    expect(applyUrlParams(url, [{ key: 'x', value: '2' }])).toBe('/api/users?x=2')
  })

  it('preserves template host base and query', () => {
    const url = '{{host}}/get?retry=1'
    expect(parseUrlParams(url)).toEqual([{ key: 'retry', value: '1' }])
    expect(applyUrlParams(url, [{ key: 'retry', value: '2' }])).toBe('{{host}}/get?retry=2')
    expect(applyUrlParams('http://{{host}}/path', [{ key: 'a', value: 'b' }])).toBe(
      'http://{{host}}/path?a=b',
    )
  })

  it('returns empty params and strips query when cleared', () => {
    expect(parseUrlParams('https://httpbin.dev/get')).toEqual([])
    expect(applyUrlParams('https://httpbin.dev/get?x=1', [])).toBe('https://httpbin.dev/get')
  })

  it('preserves URL hash fragments when editing params', () => {
    const url = 'https://httpbin.dev/get?retry=1#section'
    const params = parseUrlParams(url)
    expect(params).toEqual([{ key: 'retry', value: '1' }])
    expect(applyUrlParams(url, params)).toBe(url)
    expect(applyUrlParams(url, [{ key: 'retry', value: '2' }])).toBe(
      'https://httpbin.dev/get?retry=2#section',
    )
    expect(applyUrlParams(url, [])).toBe('https://httpbin.dev/get#section')
  })
})

describe('validateRequestDraft', () => {
  const draft = (overrides: Partial<RequestDraft> = {}): RequestDraft => ({
    content: '',
    method: 'GET',
    url: 'https://httpbin.dev/get',
    headers: [],
    ...overrides,
  })

  it('accepts clean GET without body', () => {
    expect(validateRequestDraft(draft()).valid).toBe(true)
  })

  it('rejects GET/HEAD/OPTIONS with non-empty body', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const result = validateRequestDraft(
        draft({ method, body: { kind: 'raw', content: ' hi ' } }),
      )
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/should not include a body/i)
    }
  })

  it('rejects bodyless methods with Content-Type and empty/absent body', () => {
    const withHeader = draft({
      headers: [{ name: 'Content-Type', value: 'application/json' }],
    })
    expect(validateRequestDraft(withHeader).valid).toBe(false)
    expect(validateRequestDraft(withHeader).message).toMatch(/Content-Type/i)

    const emptyBody = draft({
      headers: [{ name: 'content-type', value: 'text/plain' }],
      body: { kind: 'raw', content: '   ' },
    })
    expect(validateRequestDraft(emptyBody).valid).toBe(false)
  })

  it('rejects empty header names', () => {
    const result = validateRequestDraft(
      draft({ method: 'POST', headers: [{ name: '  ', value: 'x' }] }),
    )
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/Header name is required/i)
  })

  it('rejects empty query parameter names', () => {
    const result = validateRequestDraft(
      draft({ url: 'https://httpbin.dev/get?=' }),
    )
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/Query parameter name is required/i)
  })

  it('allows POST with body and Content-Type', () => {
    expect(
      validateRequestDraft(
        draft({
          method: 'POST',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          body: { kind: 'json', content: '{}' },
        }),
      ).valid,
    ).toBe(true)
  })
})
