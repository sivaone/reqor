import { describe, expect, it } from 'vitest'
import { HISTORY_BODY_DISPLAY_LIMIT } from './constants.js'
import { truncateBodyForDisplay } from './history-truncate.js'

describe('truncateBodyForDisplay', () => {
  it('returns body unchanged when under limit', () => {
    const result = truncateBodyForDisplay('hello')
    expect(result).toEqual({ body: 'hello', bodyTruncated: false })
  })

  it('truncates when body exceeds UTF-8 byte limit', () => {
    const body = 'x'.repeat(HISTORY_BODY_DISPLAY_LIMIT + 1)
    const result = truncateBodyForDisplay(body)
    expect(result.bodyTruncated).toBe(true)
    expect(result.body.length).toBeLessThan(body.length)
    expect(new TextEncoder().encode(result.body).length).toBe(HISTORY_BODY_DISPLAY_LIMIT)
  })

  it('does not split multi-byte UTF-8 codepoints at the limit', () => {
    // "é" is C3 A9 (2 bytes). Build a body that ends with an incomplete lead byte at limit.
    const prefix = 'a'.repeat(HISTORY_BODY_DISPLAY_LIMIT - 1)
    const body = `${prefix}é`
    const result = truncateBodyForDisplay(body)
    expect(result.bodyTruncated).toBe(true)
    expect(result.body).toBe(prefix)
    expect(new TextEncoder().encode(result.body).length).toBe(HISTORY_BODY_DISPLAY_LIMIT - 1)
    expect(result.body).not.toContain('\uFFFD')
  })
})
