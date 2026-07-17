import { describe, expect, it } from 'vitest'
import {
  collectRequestVariables,
  parseHttpClientEnvironments,
  parseHttpFile,
  scanVariables,
} from './index.js'

describe('@reqor/http-parser', () => {
  it('returns empty result for empty input', () => {
    expect(parseHttpFile('')).toEqual({ requests: [], diagnostics: [] })
  })

  it('exports scanVariables and collectRequestVariables from public API', () => {
    expect(typeof scanVariables).toBe('function')
    expect(typeof collectRequestVariables).toBe('function')
    const result = parseHttpFile('GET https://{{host}}')
    expect(result.requests).toHaveLength(1)
    expect(collectRequestVariables(result.requests[0]!)).toHaveLength(1)
  })

  it('exports parseHttpClientEnvironments from public API', () => {
    expect(typeof parseHttpClientEnvironments).toBe('function')
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({ dev: { host: 'localhost' } }),
    })
    expect(result.environments).toHaveLength(1)
    expect(result.environments[0]?.name).toBe('dev')
  })
})
