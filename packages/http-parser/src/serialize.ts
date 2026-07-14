import type { ParseResult, ParsedRequest } from './ast.js'

function serializeRequest(request: ParsedRequest): string {
  const lines: string[] = []

  let requestLine = request.method
  requestLine += ` ${request.url}`
  if (request.httpVersion) {
    requestLine += ` ${request.httpVersion}`
  }
  lines.push(requestLine)

  for (const header of request.headers) {
    lines.push(`${header.name}: ${header.value}`)
  }

  if (request.body) {
    lines.push('')
    lines.push(request.body.content)
  }

  return lines.join('\n')
}

export function serializeHttpFile(result: ParseResult): string {
  if (result.requests.length === 0) {
    return ''
  }

  return result.requests
    .map((req, i) => {
      const body = serializeRequest(req)
      return i === 0 ? body : `###\n${body}`
    })
    .join('\n')
}
