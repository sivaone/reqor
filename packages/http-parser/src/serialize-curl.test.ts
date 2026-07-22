import { describe, expect, it } from 'vitest'
import { parseCurl } from './parse-curl.js'
import { serializeCurl } from './serialize-curl.js'

describe('serializeCurl', () => {
  it('serializes POST with JSON body using --json', () => {
    const curl = serializeCurl({
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: [
        { name: 'Accept', value: 'application/json' },
        { name: 'Content-Type', value: 'application/json' },
      ],
      body: { kind: 'json', content: '{"name":"test"}' },
    })

    expect(curl).toBe(
      `curl -X POST 'https://api.example.com/users' -H 'Accept: application/json' --json '{"name":"test"}'`,
    )
  })

  it('omits -X for GET requests', () => {
    const curl = serializeCurl({
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [{ name: 'Accept', value: 'application/json' }],
    })

    expect(curl).toBe(
      `curl 'https://api.example.com/users' -H 'Accept: application/json'`,
    )
  })

  it('serializes raw body with -d', () => {
    const curl = serializeCurl({
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: [],
      body: { kind: 'raw', content: 'hello' },
    })

    expect(curl).toBe(`curl -X POST 'https://api.example.com/users' -d 'hello'`)
  })

  it('uses --data-raw for multiline body content', () => {
    const curl = serializeCurl({
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: [],
      body: { kind: 'raw', content: 'line1\nline2' },
    })

    expect(curl).toBe(
      `curl -X POST 'https://api.example.com/users' --data-raw 'line1\nline2'`,
    )
  })

  it('keeps Authorization Basic as a header', () => {
    const token = Buffer.from('alice:secret').toString('base64')
    const curl = serializeCurl({
      method: 'GET',
      url: 'https://api.example.com',
      headers: [{ name: 'Authorization', value: `Basic ${token}` }],
    })

    expect(curl).toBe(
      `curl 'https://api.example.com' -H 'Authorization: Basic ${token}'`,
    )
  })

  it('escapes embedded single quotes for shell', () => {
    const curl = serializeCurl({
      method: 'POST',
      url: 'https://api.example.com',
      headers: [],
      body: { kind: 'raw', content: "it's fine" },
    })

    expect(curl).toBe(`curl -X POST 'https://api.example.com' -d 'it'\\''s fine'`)
  })

  it('roundtrips happy paths without embedded single quotes', () => {
    const input = {
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: [{ name: 'Accept', value: 'application/json' }],
      body: { kind: 'json' as const, content: '{"name":"test"}' },
    }

    const parsed = parseCurl(serializeCurl(input))
    expect(parsed.method).toBe(input.method)
    expect(parsed.url).toBe(input.url)
    expect(parsed.headers).toContainEqual(input.headers[0])
    expect(parsed.body).toEqual({ kind: 'json', content: input.body.content })
    expect(parsed.warnings).toEqual([])
  })
})
