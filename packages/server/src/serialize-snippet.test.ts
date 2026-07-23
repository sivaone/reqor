import { SECRET_SNIPPET_PLACEHOLDER } from '@reqor/shared-types'
import { describe, expect, it } from 'vitest'
import type { RedactedExportRequest } from './load-export-request.js'
import { serializeSnippetJavaScript } from './serialize-snippet-javascript.js'
import { serializeSnippetPython } from './serialize-snippet-python.js'
import { serializeCurl } from '@reqor/http-parser'

function baseRequest(overrides: Partial<RedactedExportRequest> = {}): RedactedExportRequest {
  return {
    method: 'GET',
    url: 'https://example.com/api',
    headers: [],
    ...overrides,
  }
}

describe('serializeSnippetJavaScript', () => {
  it('serializes POST with JSON body and headers', () => {
    const snippet = serializeSnippetJavaScript(
      baseRequest({
        method: 'POST',
        url: 'https://example.com/api/users',
        headers: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: `Bearer ${SECRET_SNIPPET_PLACEHOLDER}` },
        ],
        body: { kind: 'json', content: '{"name":"test"}' },
      }),
    )

    expect(snippet).toContain("fetch('https://example.com/api/users', {")
    expect(snippet).toContain("method: 'POST',")
    expect(snippet).toContain("['Authorization', 'Bearer /* SECRET */'],")
    expect(snippet).toContain('body: JSON.stringify({"name":"test"})')
  })

  it('preserves duplicate header names', () => {
    const snippet = serializeSnippetJavaScript(
      baseRequest({
        method: 'GET',
        headers: [
          { name: 'Set-Cookie', value: 'a=1' },
          { name: 'Set-Cookie', value: 'b=2' },
        ],
      }),
    )

    expect(snippet).toContain("['Set-Cookie', 'a=1'],")
    expect(snippet).toContain("['Set-Cookie', 'b=2'],")
  })

  it('escapes control characters in string values', () => {
    const snippet = serializeSnippetJavaScript(
      baseRequest({
        url: 'https://example.com/a\nb',
      }),
    )

    expect(snippet).toContain("fetch('https://example.com/a\\nb', {")
  })

  it('omits body for GET requests', () => {
    const snippet = serializeSnippetJavaScript(
      baseRequest({
        body: { kind: 'json', content: '{"ignored":true}' },
      }),
    )

    expect(snippet).not.toContain('body:')
  })

  it('serializes form body with URLSearchParams for simple key=value pairs', () => {
    const snippet = serializeSnippetJavaScript(
      baseRequest({
        method: 'POST',
        body: { kind: 'form', content: 'a=b&c=d' },
      }),
    )

    expect(snippet).toContain("body: new URLSearchParams('a=b&c=d')")
  })

  it('serializes raw body as a string', () => {
    const snippet = serializeSnippetJavaScript(
      baseRequest({
        method: 'POST',
        body: { kind: 'raw', content: 'plain text' },
      }),
    )

    expect(snippet).toContain("body: 'plain text'")
  })
})

describe('serializeSnippetPython', () => {
  it('serializes POST with JSON body and headers', () => {
    const snippet = serializeSnippetPython(
      baseRequest({
        method: 'POST',
        url: 'https://example.com/api/users',
        headers: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: `Bearer ${SECRET_SNIPPET_PLACEHOLDER}` },
        ],
        body: { kind: 'json', content: '{"name":"test"}' },
      }),
    )

    expect(snippet).toContain('import requests')
    expect(snippet).toContain('response = requests.post(')
    expect(snippet).toContain("('Authorization', 'Bearer /* SECRET */'),")
    expect(snippet).toContain("json={'name': 'test'},")
  })

  it('preserves duplicate header names', () => {
    const snippet = serializeSnippetPython(
      baseRequest({
        method: 'GET',
        headers: [
          { name: 'Set-Cookie', value: 'a=1' },
          { name: 'Set-Cookie', value: 'b=2' },
        ],
      }),
    )

    expect(snippet).toContain("('Set-Cookie', 'a=1'),")
    expect(snippet).toContain("('Set-Cookie', 'b=2'),")
  })

  it('omits body for HEAD requests', () => {
    const snippet = serializeSnippetPython(
      baseRequest({
        method: 'HEAD',
        body: { kind: 'raw', content: 'ignored' },
      }),
    )

    expect(snippet).toContain('response = requests.head(')
    expect(snippet).not.toContain('data=')
    expect(snippet).not.toContain('json=')
  })

  it('serializes form body as dict when parseable', () => {
    const snippet = serializeSnippetPython(
      baseRequest({
        method: 'POST',
        body: { kind: 'form', content: 'a=b&c=d' },
      }),
    )

    expect(snippet).toContain("data={'a': 'b', 'c': 'd'},")
  })

  it('serializes raw body as data string', () => {
    const snippet = serializeSnippetPython(
      baseRequest({
        method: 'POST',
        body: { kind: 'raw', content: 'plain text' },
      }),
    )

    expect(snippet).toContain("data='plain text',")
  })
})

describe('snippet cURL tab redaction', () => {
  it('uses SECRET_SNIPPET_PLACEHOLDER instead of SECRET_MASK', () => {
    const curl = serializeCurl(
      baseRequest({
        method: 'POST',
        headers: [{ name: 'Authorization', value: `Bearer ${SECRET_SNIPPET_PLACEHOLDER}` }],
        body: { kind: 'json', content: '{"token":"/* SECRET */"}' },
      }),
    )

    expect(curl).toContain('/* SECRET */')
    expect(curl).not.toContain('••••••')
  })
})
