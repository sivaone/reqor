import { describe, expect, it } from 'vitest'
import { parseHttpFile } from './index.js'

describe('@reqor/http-parser', () => {
  it('returns empty result for empty input', () => {
    expect(parseHttpFile('')).toEqual({ requests: [], diagnostics: [] })
  })
})
