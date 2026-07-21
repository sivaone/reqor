import { describe, expect, it } from 'vitest'
import { applyVisualPatch, syncCollection } from './sync-collection.js'

const MULTI = `# shared comment
GET https://api.example.com/users
Accept: application/json

###

# second request
POST https://api.example.com/users
Content-Type: application/json

{"name":"a"}
`

describe('applyVisualPatch', () => {
  it('updates one request block and preserves other blocks/comments', () => {
    const result = applyVisualPatch({
      content: MULTI,
      requestIndex: 0,
      patch: {
        method: 'GET',
        url: 'https://api.example.com/users?limit=10',
        headers: [{ name: 'Accept', value: 'application/json' }],
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).toContain('GET https://api.example.com/users?limit=10')
    expect(result.content).toContain('# shared comment')
    expect(result.content).toContain('# second request')
    expect(result.content).toContain('POST https://api.example.com/users')
    expect(result.content).toContain('{"name":"a"}')
  })

  it('clears body when patch.body is null', () => {
    const result = applyVisualPatch({
      content: MULTI,
      requestIndex: 1,
      patch: {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        body: null,
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).not.toContain('{"name":"a"}')
    expect(result.content).toContain('POST https://api.example.com/users')
  })

  it('returns INVALID_REQUEST_INDEX for missing request', () => {
    const result = applyVisualPatch({
      content: MULTI,
      requestIndex: 9,
      patch: {
        method: 'GET',
        url: 'https://x',
        headers: [],
      },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('INVALID_REQUEST_INDEX')
  })
})

describe('syncCollection', () => {
  it('reparses raw content and returns diagnostics on bad syntax', () => {
    const result = syncCollection('demo.http', {
      content: 'NOT_A_VALID_REQUEST',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.response.parseStatus).toBe('error')
    expect(result.response.diagnostics.length).toBeGreaterThan(0)
    expect(result.response.diagnostics[0]?.line).toBeGreaterThanOrEqual(1)
  })

  it('applies visual patch then returns updated DTOs', () => {
    const result = syncCollection('http/users.http', {
      content: MULTI,
      requestIndex: 0,
      patch: {
        method: 'PUT',
        url: 'https://api.example.com/users/1',
        headers: [{ name: 'Accept', value: 'application/json' }],
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.response.parseStatus).toBe('ok')
    expect(result.response.requests[0]?.method).toBe('PUT')
    expect(result.response.requests[0]?.url).toBe('https://api.example.com/users/1')
    expect(result.response.requests[1]?.method).toBe('POST')
  })

  it('requires requestIndex when patch provided', () => {
    const result = syncCollection('demo.http', {
      content: MULTI,
      patch: {
        method: 'GET',
        url: 'https://x',
        headers: [],
      },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('INVALID_REQUEST_INDEX')
  })
})
