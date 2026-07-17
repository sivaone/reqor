import { SECRET_MASK } from '@reqor/shared-types'
import { describe, expect, it } from 'vitest'
import { redactObject, redactSecrets } from './redact-secrets.js'

describe('redactSecrets', () => {
  it('replaces known secret substrings with SECRET_MASK', () => {
    const result = redactSecrets('Bearer super-secret-token', ['super-secret-token'])
    expect(result).toBe(`Bearer ${SECRET_MASK}`)
    expect(result).not.toContain('super-secret-token')
  })

  it('redacts longest secrets first to avoid partial leaks', () => {
    const result = redactSecrets('abc abcdef', ['abc', 'abcdef'])
    expect(result).toBe(`${SECRET_MASK} ${SECRET_MASK}`)
  })

  it('returns text unchanged when no secrets provided', () => {
    expect(redactSecrets('plain text', [])).toBe('plain text')
  })
})

describe('redactObject', () => {
  it('redacts string fields recursively', () => {
    const input = {
      message: 'token=abc123',
      nested: { header: 'Authorization: abc123' },
      count: 1,
    }
    const result = redactObject(input, ['abc123'])
    expect(result.message).toBe(`token=${SECRET_MASK}`)
    expect(result.nested.header).toBe(`Authorization: ${SECRET_MASK}`)
    expect(result.count).toBe(1)
  })
})
