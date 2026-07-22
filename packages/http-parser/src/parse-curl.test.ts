import { describe, expect, it } from 'vitest'
import { parseCurl } from './parse-curl.js'

describe('parseCurl', () => {
  it('parses method, url, headers, and body', () => {
    const result = parseCurl(
      `curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{"name":"test"}'`,
    )
    expect(result.method).toBe('POST')
    expect(result.url).toBe('https://api.example.com/users')
    expect(result.headers).toEqual([{ name: 'Content-Type', value: 'application/json' }])
    expect(result.body).toEqual({ kind: 'json', content: '{"name":"test"}' })
    expect(result.warnings).toEqual([])
  })

  it('defaults to POST when -d is present without -X', () => {
    const result = parseCurl(`curl https://api.example.com/users -d 'hello'`)
    expect(result.method).toBe('POST')
    expect(result.body?.content).toBe('hello')
  })

  it('maps -u to Authorization Basic header', () => {
    const result = parseCurl(`curl -u alice:secret https://api.example.com`)
    expect(result.headers).toEqual([
      { name: 'Authorization', value: 'Basic ' + Buffer.from('alice:secret').toString('base64') },
    ])
  })

  it('handles --json flag', () => {
    const result = parseCurl(`curl --json '{"a":1}' https://api.example.com`)
    expect(result.method).toBe('POST')
    expect(result.body?.kind).toBe('json')
    expect(result.headers.some((h) => h.name === 'Content-Type' && h.value.includes('json'))).toBe(
      true,
    )
  })

  it('supports --data-raw', () => {
    const result = parseCurl(`curl --data-raw 'raw-body' https://api.example.com`)
    expect(result.body?.content).toBe('raw-body')
    expect(result.method).toBe('POST')
  })

  it('warns on unsupported flags but still imports partial request', () => {
    const result = parseCurl(`curl --cookie foo=bar https://api.example.com/path`)
    expect(result.url).toBe('https://api.example.com/path')
    expect(result.warnings).toContain('Unsupported flag: --cookie')
  })

  it('handles inline flag values', () => {
    const result = parseCurl(`curl -H=Accept:application/json https://api.example.com`)
    expect(result.headers).toEqual([{ name: 'Accept', value: 'application/json' }])
  })

  it('returns empty url for empty input', () => {
    const result = parseCurl('   ')
    expect(result.url).toBe('')
    expect(result.warnings).toContain('Empty cURL command')
  })

  it('handles backslash line continuations', () => {
    const result = parseCurl(`curl -X POST \\
      'https://api.example.com/users' \\
      -d 'hello'`)
    expect(result.url).toBe('https://api.example.com/users')
    expect(result.body?.content).toBe('hello')
  })

  it('warns on @file body references', () => {
    const result = parseCurl(`curl -d @payload.json https://api.example.com`)
    expect(result.warnings).toContain('File references in -d are not supported')
    expect(result.body?.content).toBe('@payload.json')
  })
})
