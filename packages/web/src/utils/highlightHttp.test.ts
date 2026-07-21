import { describe, expect, it } from 'vitest'
import { highlightHttpHtml, tokenizeHttp } from './highlightHttp.js'

describe('tokenizeHttp / highlightHttpHtml', () => {
  it('tokenizes method, url placeholders, headers, separators, and comments', () => {
    const content = `# comment
GET {{host}}/users
Accept: application/json

###

POST https://example.com
`

    const types = tokenizeHttp(content).map((token) => token.type)
    expect(types).toContain('comment')
    expect(types).toContain('method')
    expect(types).toContain('placeholder')
    expect(types).toContain('header-name')
    expect(types).toContain('separator')

    const html = highlightHttpHtml(content)
    expect(html).toContain('text-primary')
    expect(html).toContain('text-success')
  })

  it('highlights every request after ### separators and blank lines', () => {
    const content = `GET https://{{host}}/get
Accept: application/json
###

POST https://{{host}}/post
Content-Type: application/json

{
  "name": "reqor"
}

###

PUT https://{{host}}/put
Accept: application/json
`

    const tokens = tokenizeHttp(content)
    const methods = tokens.filter((token) => token.type === 'method').map((t) => t.value)
    expect(methods).toEqual(['GET', 'POST', 'PUT'])

    const placeholders = tokens
      .filter((token) => token.type === 'placeholder')
      .map((t) => t.value)
    expect(placeholders).toEqual(['{{host}}', '{{host}}', '{{host}}'])

    const bodyTokens = tokens.filter((token) => token.type === 'body')
    expect(bodyTokens.some((t) => t.value.includes('"name"'))).toBe(true)
    expect(bodyTokens.some((t) => t.value.startsWith('POST'))).toBe(false)
    expect(bodyTokens.some((t) => t.value.startsWith('PUT'))).toBe(false)
  })

  it('escapes HTML in highlighted output', () => {
    const html = highlightHttpHtml('GET /<script>\n')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})
