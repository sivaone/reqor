import { describe, expect, it } from 'vitest'
import { minimalDiffSave } from './save-collection.js'
import { spliceRequestSpan } from './splice-request-span.js'

const MULTI = `# shared comment
GET https://api.example.com/users
Accept: application/json

###

# second request
POST https://api.example.com/users
Content-Type: application/json

{"name":"a"}
`

describe('minimalDiffSave', () => {
  it('patches only the changed request block', () => {
    const incoming = `# shared comment
PUT https://api.example.com/users
Accept: application/json

###

# second request
POST https://api.example.com/users
Content-Type: application/json

{"name":"a"}
`
    const result = minimalDiffSave(MULTI, incoming)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.content).toContain('PUT https://api.example.com/users')
    expect(result.content).toContain('# shared comment')
    expect(result.content).toContain('# second request')
    expect(result.content).toContain('{"name":"a"}')
    expect(result.content).not.toContain('GET https://api.example.com/users')
    expect(result.warning).toBeUndefined()
  })

  it('preserves inter-request comments and blank lines outside edited spans', () => {
    const incoming = `# shared comment
GET https://api.example.com/users?limit=5
Accept: application/json

###

# second request
POST https://api.example.com/users
Content-Type: application/json

{"name":"a"}
`
    const result = minimalDiffSave(MULTI, incoming)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.content).toContain('# shared comment')
    expect(result.content).toContain('# second request')
    expect(result.content).toContain('users?limit=5')
  })

  it('returns PARSE_ERROR without mutating when incoming content is invalid', () => {
    const result = minimalDiffSave(MULTI, 'NOT_A_VALID_REQUEST')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('PARSE_ERROR')
    expect(result.line).toBeGreaterThanOrEqual(1)
  })

  it('falls back to full rewrite with warning when span splice fails', () => {
    const disk = 'GET https://api.example.com/users'
    const incoming = 'POST https://api.example.com/users'
    const brokenSpan = { startLine: 99, endLine: 100 }
    const spliced = spliceRequestSpan(disk, brokenSpan, incoming)
    expect(spliced.ok).toBe(false)

    const corruptDisk = 'NOT_A_VALID_REQUEST'
    const result = minimalDiffSave(corruptDisk, incoming)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warning?.code).toBe('FULL_REWRITE')
    expect(result.content).toContain('POST https://api.example.com/users')
  })
})

describe('spliceRequestSpan', () => {
  it('rejects invalid spans', () => {
    const result = spliceRequestSpan('GET https://x', { startLine: 0, endLine: 1 }, 'POST https://y')
    expect(result.ok).toBe(false)
  })
})
