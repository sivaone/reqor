import { describe, expect, it } from 'vitest'
import { parseHttpFile } from './parse.js'
import {
  collectRequestVariables,
  scanVariables,
  type VariableReference,
} from './variables.js'

function ref(
  partial: Pick<VariableReference, 'kind' | 'name' | 'raw' | 'start' | 'end'> &
    Partial<Pick<VariableReference, 'location'>>,
): VariableReference {
  return {
    location: partial.location ?? { part: 'url' },
    ...partial,
  }
}

describe('scanVariables', () => {
  it('recognizes {{host}} in URL as env ref', () => {
    const url = 'https://{{host}}/api'
    const refs = scanVariables(url, { part: 'url' })
    expect(refs).toEqual([
      ref({
        kind: 'env',
        name: 'host',
        raw: '{{host}}',
        start: 8,
        end: 16,
        location: { part: 'url' },
      }),
    ])
  })

  it('recognizes {{token}} in header value with header index', () => {
    const value = 'Bearer {{token}}'
    const refs = scanVariables(value, { part: 'header', index: 2 })
    expect(refs).toEqual([
      ref({
        kind: 'env',
        name: 'token',
        raw: '{{token}}',
        start: 7,
        end: 16,
        location: { part: 'header', index: 2 },
      }),
    ])
  })

  it('recognizes {{body}} in body content', () => {
    const content = '{"user":"{{body}}"}'
    const refs = scanVariables(content, { part: 'body' })
    expect(refs).toEqual([
      ref({
        kind: 'env',
        name: 'body',
        raw: '{{body}}',
        start: 9,
        end: 17,
        location: { part: 'body' },
      }),
    ])
  })

  it('recognizes {{$uuid}} alone and embedded in query string', () => {
    const alone = '{{$uuid}}'
    expect(scanVariables(alone, { part: 'url' })).toEqual([
      ref({
        kind: 'uuid',
        name: 'uuid',
        raw: '{{$uuid}}',
        start: 0,
        end: 9,
      }),
    ])

    const embedded = 'https://api.test?id={{$uuid}}&x=1'
    expect(scanVariables(embedded, { part: 'url' })).toEqual([
      ref({
        kind: 'uuid',
        name: 'uuid',
        raw: '{{$uuid}}',
        start: 20,
        end: 29,
      }),
    ])
  })

  it('recognizes {{$timestamp}} in URL', () => {
    const url = 'https://api.test?ts={{$timestamp}}'
    expect(scanVariables(url, { part: 'url' })).toEqual([
      ref({
        kind: 'timestamp',
        name: 'timestamp',
        raw: '{{$timestamp}}',
        start: 20,
        end: 34,
      }),
    ])
  })

  it('recognizes {{$randomInt}} and mixed-case {{$RandomInt}}', () => {
    expect(scanVariables('{{$randomInt}}', { part: 'url' })).toEqual([
      ref({
        kind: 'randomInt',
        name: 'randomInt',
        raw: '{{$randomInt}}',
        start: 0,
        end: 14,
      }),
    ])
    expect(scanVariables('{{$RandomInt}}', { part: 'url' })).toEqual([
      ref({
        kind: 'randomInt',
        name: 'randomInt',
        raw: '{{$RandomInt}}',
        start: 0,
        end: 14,
      }),
    ])
  })

  it('recognizes mixed-case builtins {{$UUID}}, {{$Timestamp}}, {{$Dotenv KEY}}', () => {
    expect(scanVariables('{{$UUID}}', { part: 'url' })).toEqual([
      ref({
        kind: 'uuid',
        name: 'uuid',
        raw: '{{$UUID}}',
        start: 0,
        end: 9,
      }),
    ])
    expect(scanVariables('{{$Timestamp}}', { part: 'url' })).toEqual([
      ref({
        kind: 'timestamp',
        name: 'timestamp',
        raw: '{{$Timestamp}}',
        start: 0,
        end: 14,
      }),
    ])
    expect(scanVariables('{{$Dotenv API_KEY}}', { part: 'url' })).toEqual([
      ref({
        kind: 'dotenv',
        name: 'API_KEY',
        raw: '{{$Dotenv API_KEY}}',
        start: 0,
        end: 19,
      }),
    ])
  })

  it('recognizes {{$dotenv API_KEY}} and {{$dotenv API_TOKEN}}', () => {
    expect(scanVariables('{{$dotenv API_KEY}}', { part: 'url' })).toEqual([
      ref({
        kind: 'dotenv',
        name: 'API_KEY',
        raw: '{{$dotenv API_KEY}}',
        start: 0,
        end: 19,
      }),
    ])
    expect(scanVariables('{{$dotenv API_TOKEN}}', { part: 'url' })).toEqual([
      ref({
        kind: 'dotenv',
        name: 'API_TOKEN',
        raw: '{{$dotenv API_TOKEN}}',
        start: 0,
        end: 21,
      }),
    ])
  })

  it('recognizes {{$dotenv KEY WITH SPACES}} with trimmed key', () => {
    expect(scanVariables('{{$dotenv KEY WITH SPACES}}', { part: 'url' })).toEqual([
      ref({
        kind: 'dotenv',
        name: 'KEY WITH SPACES',
        raw: '{{$dotenv KEY WITH SPACES}}',
        start: 0,
        end: 27,
      }),
    ])
  })

  it('clones location so sibling refs do not share one mutable object', () => {
    const location = { part: 'url' as const }
    const refs = scanVariables('{{a}}/{{b}}', location)
    expect(refs).toHaveLength(2)
    refs[0]!.location = { part: 'body' }
    expect(refs[1]!.location).toEqual({ part: 'url' })
    expect(location).toEqual({ part: 'url' })
  })

  it('returns multiple placeholders in order with correct start/end', () => {
    const text = '{{host}}/{{token}}'
    expect(scanVariables(text, { part: 'url' })).toEqual([
      ref({
        kind: 'env',
        name: 'host',
        raw: '{{host}}',
        start: 0,
        end: 8,
      }),
      ref({
        kind: 'env',
        name: 'token',
        raw: '{{token}}',
        start: 9,
        end: 18,
      }),
    ])
  })

  it('trims inner whitespace: {{ host }} → name host', () => {
    expect(scanVariables('{{ host }}', { part: 'url' })).toEqual([
      ref({
        kind: 'env',
        name: 'host',
        raw: '{{ host }}',
        start: 0,
        end: 10,
      }),
    ])
  })

  it('does not emit for OAuth, unknown, or OUT dynamics', () => {
    const noEmit = [
      '{{$oauth.token}}',
      '{{not valid!}}',
      '{{$isoTimestamp}}',
      '{{$random.integer(1,10)}}',
      '{{$randomInt(0,5)}}',
      '{{$dotenv}}',
      '{{}}',
    ]
    for (const text of noEmit) {
      expect(scanVariables(text, { part: 'url' })).toEqual([])
    }
  })
})

describe('collectRequestVariables', () => {
  it('scans url, header values, and body without cross-field dedupe', () => {
    const request = parseHttpFile(`GET https://{{host}}/api?id={{$uuid}}
Authorization: Bearer {{token}}
X-Secret: {{$dotenv API_TOKEN}}

{"user":"{{name}}"}`).requests[0]!

    const refs = collectRequestVariables(request)

    expect(refs).toEqual([
      ref({
        kind: 'env',
        name: 'host',
        raw: '{{host}}',
        start: 8,
        end: 16,
        location: { part: 'url' },
      }),
      ref({
        kind: 'uuid',
        name: 'uuid',
        raw: '{{$uuid}}',
        start: 24,
        end: 33,
        location: { part: 'url' },
      }),
      ref({
        kind: 'env',
        name: 'token',
        raw: '{{token}}',
        start: 7,
        end: 16,
        location: { part: 'header', index: 0 },
      }),
      ref({
        kind: 'dotenv',
        name: 'API_TOKEN',
        raw: '{{$dotenv API_TOKEN}}',
        start: 0,
        end: 21,
        location: { part: 'header', index: 1 },
      }),
      ref({
        kind: 'env',
        name: 'name',
        raw: '{{name}}',
        start: 9,
        end: 17,
        location: { part: 'body' },
      }),
    ])
  })

  it('distinguishes same offset in url and header by location', () => {
    const request = parseHttpFile(`GET {{host}}
X-Host: {{host}}`).requests[0]!

    const refs = collectRequestVariables(request)
    expect(refs).toHaveLength(2)
    expect(refs[0]).toMatchObject({
      kind: 'env',
      name: 'host',
      start: 0,
      location: { part: 'url' },
    })
    expect(refs[1]).toMatchObject({
      kind: 'env',
      name: 'host',
      start: 0,
      location: { part: 'header', index: 0 },
    })
  })

  it('does not scan header names, comments, or separator titles', () => {
    const request = parseHttpFile(`### Title with {{host}}
# Comment with {{token}}
GET https://example.com
{{name}}: literal-value`).requests[0]!

    expect(request.headers.some((h) => h.name.includes('{{'))).toBe(true)
    expect(collectRequestVariables(request)).toEqual([])
  })
})

describe('parseHttpFile integration', () => {
  it('preserves literals while collectRequestVariables recognizes placeholders', () => {
    const content = `GET https://{{host}}/api?id={{$uuid}}
Authorization: Bearer {{token}}
X-Secret: {{$dotenv API_TOKEN}}

{"user":"{{name}}"}`

    const result = parseHttpFile(content)
    const request = result.requests[0]!

    expect(request.url).toContain('{{host}}')
    expect(request.url).toContain('{{$uuid}}')
    expect(request.headers[0]!.value).toBe('Bearer {{token}}')
    expect(request.body?.content).toBe('{"user":"{{name}}"}')

    const refs = collectRequestVariables(request)
    expect(refs.map((r) => r.kind)).toEqual([
      'env',
      'uuid',
      'env',
      'dotenv',
      'env',
    ])
  })
})
