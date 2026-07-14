import { describe, expect, it } from 'vitest'
import { astEquivalent, parseHttpFile, serializeHttpFile } from './index.js'

const snippets: Array<{ name: string; content: string }> = [
  {
    name: 'simple GET',
    content: 'GET https://api.example.com/users',
  },
  {
    name: 'GET with query',
    content: 'GET https://api.example.com/users?page=1&limit=10',
  },
  {
    name: 'POST JSON',
    content: `POST https://api.example.com/users
Content-Type: application/json

{"name":"bob"}`,
  },
  {
    name: 'PUT',
    content: `PUT https://api.example.com/users/1
Content-Type: application/json

{"name":"carol"}`,
  },
  {
    name: 'PATCH',
    content: 'PATCH https://api.example.com/users/1',
  },
  {
    name: 'DELETE',
    content: 'DELETE https://api.example.com/users/1',
  },
  {
    name: 'HEAD',
    content: 'HEAD https://api.example.com/users/1',
  },
  {
    name: 'OPTIONS',
    content: 'OPTIONS https://api.example.com',
  },
  {
    name: 'default GET',
    content: 'https://api.example.com/health',
  },
  {
    name: 'HTTP/2',
    content: 'GET https://api.example.com HTTP/2',
  },
  {
    name: 'multi-line URL',
    content: `GET https://api.example.com
    /v1/search
    ?q=test`,
  },
  {
    name: 'multi-line header',
    content: `GET https://api.example.com
X-Trace: abc
    def`,
  },
  {
    name: 'form body',
    content: `POST https://api.example.com/login
Content-Type: application/x-www-form-urlencoded

a=1&b=2`,
  },
  {
    name: 'variables preserved',
    content: `GET https://{{host}}/api
Authorization: {{token}}`,
  },
  {
    name: 'multi-request',
    content: `GET https://a.test/one

###

POST https://a.test/two`,
  },
]

describe('round-trip', () => {
  it.each(snippets)('$name: parse → serialize → parse is equivalent', ({ content }) => {
    const first = parseHttpFile(content)
    const serialized = serializeHttpFile(first)
    const second = parseHttpFile(serialized)
    expect(astEquivalent(first, second)).toBe(true)
  })
})
