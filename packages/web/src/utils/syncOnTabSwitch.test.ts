import { describe, expect, it } from 'vitest'
import { buildSyncPayload, matchRequestAfterSync } from './syncOnTabSwitch.js'
import type { RequestDraft } from './requestDraft.js'

const draft: RequestDraft = {
  content: 'GET https://example.com\n',
  method: 'GET',
  url: 'https://example.com',
  headers: [{ name: 'Accept', value: 'application/json' }],
}

describe('buildSyncPayload', () => {
  it('omits body from to-raw patch when draft has no body', () => {
    const payload = buildSyncPayload('to-raw', draft, 0)
    expect(payload.patch?.body).toBeUndefined()
  })

  it('includes body in patch when draft has body', () => {
    const withBody: RequestDraft = {
      ...draft,
      body: { kind: 'raw', content: 'hi' },
    }
    const payload = buildSyncPayload('to-raw', withBody, 0)
    expect(payload.patch?.body).toEqual({ kind: 'raw', content: 'hi' })
  })

  it('includes structured patch on to-visual when requested', () => {
    const payload = buildSyncPayload('to-visual', draft, 0, {
      includeStructuredPatch: true,
    })
    expect(payload.patch).toBeDefined()
    expect(payload.requestIndex).toBe(0)
  })
})

describe('matchRequestAfterSync', () => {
  const response = {
    content: 'GET https://example.com\n',
    parseStatus: 'ok' as const,
    requests: [
      {
        requestIndex: 0,
        fingerprint: 'a'.repeat(64),
        method: 'GET',
        url: 'https://example.com',
        headers: [],
      },
      {
        requestIndex: 1,
        fingerprint: 'b'.repeat(64),
        method: 'POST',
        url: 'https://example.com/other',
        headers: [],
      },
    ],
    diagnostics: [],
  }

  it('returns by index for to-raw regardless of fingerprint', () => {
    const matched = matchRequestAfterSync(response, 0, 'z'.repeat(64), 'to-raw')
    expect(matched?.requestIndex).toBe(0)
  })

  it('returns request at index for to-visual when raw edit changed fingerprint', () => {
    const matched = matchRequestAfterSync(response, 0, 'z'.repeat(64), 'to-visual')
    expect(matched?.requestIndex).toBe(0)
    expect(matched?.method).toBe('GET')
  })

  it('prefers fingerprint rematch when request moved to a different index', () => {
    const shifted = {
      ...response,
      requests: [
        {
          requestIndex: 0,
          fingerprint: 'b'.repeat(64),
          method: 'POST',
          url: 'https://example.com/other',
          headers: [],
        },
        {
          requestIndex: 1,
          fingerprint: 'c'.repeat(64),
          method: 'DELETE',
          url: 'https://example.com/removed',
          headers: [],
        },
      ],
    }
    const matched = matchRequestAfterSync(shifted, 1, 'b'.repeat(64), 'to-visual')
    expect(matched?.requestIndex).toBe(0)
    expect(matched?.method).toBe('POST')
  })

  it('falls back to fingerprint for to-visual when index content replaced', () => {
    const matched = matchRequestAfterSync(response, 1, 'b'.repeat(64), 'to-visual')
    expect(matched?.method).toBe('POST')
  })
})
