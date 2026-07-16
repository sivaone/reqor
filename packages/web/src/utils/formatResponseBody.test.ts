import { describe, expect, it } from 'vitest'
import {
  detectResponseFormat,
  escapeHtml,
  escapeJsonStringDisplay,
  formatStatusBar,
  prettyPrintJson,
  tokenizeXml,
} from './formatResponseBody.js'

describe('formatResponseBody', () => {
  it('detects JSON from content type and body sniffing', () => {
    expect(detectResponseFormat('application/json', '{"a":1}')).toBe('json')
    expect(detectResponseFormat(undefined, '{"a":1}')).toBe('json')
    expect(detectResponseFormat(undefined, '<root/>')).toBe('xml')
    expect(detectResponseFormat('text/plain', 'hello')).toBe('plain')
  })

  it('pretty prints JSON', () => {
    expect(prettyPrintJson('{"a":1}')).toBe('{\n  "a": 1\n}')
  })

  it('escapes HTML for plain rendering', () => {
    expect(escapeHtml('<script>&"\'</script>')).toBe(
      '&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;',
    )
  })

  it('tokenizes XML tags and attributes without duplicating attr text', () => {
    const tokens = tokenizeXml('<root id="1">text</root>')
    expect(tokens.filter((token) => token.type === 'attr')).toEqual([
      { type: 'attr', value: 'id="1"' },
    ])
    expect(tokens.map((token) => token.value).join('')).toBe('<root id="1">text</root>')
  })

  it('escapes JSON string display characters', () => {
    expect(escapeJsonStringDisplay('a"b\nc')).toBe('a\\"b\\nc')
  })

  it('formats status bar and omits empty statusText token', () => {
    expect(formatStatusBar(200, 'OK', 98.4, 897)).toBe('200 OK · 98 ms · 897 B')
    expect(formatStatusBar(200, '', 98.4, 897)).toBe('200 · 98 ms · 897 B')
  })
})
