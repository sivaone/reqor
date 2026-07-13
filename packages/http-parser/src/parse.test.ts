import { describe, expect, it } from 'vitest'
import {
  DIAG_PARSE_ERROR,
  DIAG_UNSUPPORTED_CONSTRUCT,
  parseHttpFile,
} from './index.js'

describe('parseHttpFile', () => {
  it('parses single GET with query string', () => {
    const result = parseHttpFile('GET https://api.example.com/users?id=1&active=true')
    expect(result.diagnostics).toEqual([])
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0]).toMatchObject({
      method: 'GET',
      url: 'https://api.example.com/users?id=1&active=true',
    })
  })

  it('parses POST with JSON body and Content-Type', () => {
    const content = `POST https://api.example.com/users
Content-Type: application/json

{"name": "alice"}`

    const result = parseHttpFile(content)
    expect(result.diagnostics).toEqual([])
    expect(result.requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.example.com/users',
    })
    expect(result.requests[0]!.body).toEqual({
      kind: 'json',
      content: '{"name": "alice"}',
      line: 4,
    })
  })

  it.each(['PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])(
    'parses %s requests',
    (method) => {
      const result = parseHttpFile(`${method} https://api.example.com/resource`)
      expect(result.requests[0]!.method).toBe(method)
    },
  )

  it('parses multiple requests separated by ###', () => {
    const content = `GET https://a.test/one

###

POST https://a.test/two

{"x":1}

###

DELETE https://a.test/three`

    const result = parseHttpFile(content)
    expect(result.diagnostics).toEqual([])
    expect(result.requests).toHaveLength(3)
    expect(result.requests.map((r) => r.method)).toEqual(['GET', 'POST', 'DELETE'])
  })

  it('parses multi-line URL continuation', () => {
    const content = `GET https://api.example.com
    /v1/users
    ?page=1`

    const result = parseHttpFile(content)
    expect(result.requests[0]!.url).toBe('https://api.example.com/v1/users?page=1')
  })

  it('parses multi-line header values', () => {
    const content = `GET https://api.example.com
X-Custom: line-one
    line-two`

    const result = parseHttpFile(content)
    expect(result.requests[0]!.headers[0]).toMatchObject({
      name: 'X-Custom',
      value: 'line-one line-two',
    })
  })

  it('parses form-urlencoded body', () => {
    const content = `POST https://api.example.com/login
Content-Type: application/x-www-form-urlencoded

user=alice&pass=secret`

    const result = parseHttpFile(content)
    expect(result.requests[0]!.body?.kind).toBe('form')
  })

  it('preserves variable placeholders literally', () => {
    const content = `GET https://{{host}}/api?id={{$uuid}}&ts={{$timestamp}}&n={{$randomInt}}
Authorization: Bearer {{token}}
X-Dotenv: {{$dotenv API_KEY}}

{{body}}`

    const result = parseHttpFile(content)
    expect(result.requests[0]!.url).toContain('{{host}}')
    expect(result.requests[0]!.url).toContain('{{$uuid}}')
    expect(result.requests[0]!.headers[0]!.value).toBe('Bearer {{token}}')
    expect(result.requests[0]!.body?.content).toBe('{{body}}')
  })

  it('defaults method to GET when omitted', () => {
    const result = parseHttpFile('https://api.example.com/health')
    expect(result.requests[0]!.method).toBe('GET')
  })

  it('parses HTTP version suffix', () => {
    const result = parseHttpFile('GET https://api.example.com HTTP/2')
    expect(result.requests[0]!.httpVersion).toBe('HTTP/2')
  })

  it('emits diagnostic for malformed request line', () => {
    const result = parseHttpFile('NOTAMETHOD')
    expect(result.diagnostics.some((d) => d.code === DIAG_PARSE_ERROR)).toBe(true)
    expect(result.diagnostics[0]!.line).toBeGreaterThan(0)
  })

  it('emits diagnostic for malformed header', () => {
    const result = parseHttpFile('GET https://api.example.com\nBadHeader')
    expect(result.diagnostics.some((d) => d.code === DIAG_PARSE_ERROR)).toBe(true)
  })

  it('detects @name request reference', () => {
    const result = parseHttpFile('@ref = GET https://api.example.com')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DIAG_UNSUPPORTED_CONSTRUCT,
        message: expect.stringContaining('@name'),
      }),
    )
  })

  it('detects pre-request script', () => {
    const content = `> {% client.global.set("x", 1); %}
GET https://api.example.com`

    const result = parseHttpFile(content)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DIAG_UNSUPPORTED_CONSTRUCT,
        message: expect.stringContaining('pre-request script'),
      }),
    )
    expect(result.requests).toHaveLength(1)
  })

  it('detects response handler script', () => {
    const content = `GET https://api.example.com

> {% client.test("ok", response.status === 200); %}`

    const result = parseHttpFile(content)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DIAG_UNSUPPORTED_CONSTRUCT,
        message: expect.stringContaining('response handler script'),
      }),
    )
    expect(result.requests).toHaveLength(1)
  })

  it('detects file inclusion', () => {
    const content = `POST https://api.example.com
Content-Type: application/json

< ./payload.json`

    const result = parseHttpFile(content)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DIAG_UNSUPPORTED_CONSTRUCT,
        message: expect.stringContaining('file inclusion'),
      }),
    )
  })

  it('detects OAuth2 helper variable', () => {
    const result = parseHttpFile('GET https://api.example.com\nAuthorization: Bearer {{$oauth.token}}')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: DIAG_UNSUPPORTED_CONSTRUCT,
        message: expect.stringContaining('OAuth2'),
      }),
    )
  })

  it('continues parsing after errors in one block', () => {
    const content = `BROKEN

###

GET https://api.example.com/ok`

    const result = parseHttpFile(content)
    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0]!.url).toBe('https://api.example.com/ok')
  })
})
