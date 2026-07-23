import type { RedactedExportRequest } from './load-export-request.js'

const NO_BODY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function escapeJsSingleQuote(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function isSimpleFormContent(content: string): boolean {
  if (!content || content.includes('\n')) {
    return false
  }
  return content.split('&').every((pair) => /^[^=&]+=/.test(pair))
}

function formatJsBody(body: RedactedExportRequest['body']): string | null {
  if (!body) {
    return null
  }

  if (body.kind === 'json') {
    try {
      const parsed = JSON.parse(body.content) as unknown
      return `body: JSON.stringify(${JSON.stringify(parsed)})`
    } catch {
      return `body: '${escapeJsSingleQuote(body.content)}'`
    }
  }

  if (body.kind === 'form' && isSimpleFormContent(body.content)) {
    return `body: new URLSearchParams('${escapeJsSingleQuote(body.content)}')`
  }

  return `body: '${escapeJsSingleQuote(body.content)}'`
}

function formatJsHeaders(headers: RedactedExportRequest['headers']): string[] {
  if (headers.length === 0) {
    return []
  }

  const lines = ['  headers: [']
  for (const header of headers) {
    lines.push(
      `    ['${escapeJsSingleQuote(header.name)}', '${escapeJsSingleQuote(header.value)}'],`,
    )
  }
  lines.push('  ],')
  return lines
}

export function serializeSnippetJavaScript(request: RedactedExportRequest): string {
  const method = request.method.toUpperCase()
  const lines: string[] = []

  lines.push(`fetch('${escapeJsSingleQuote(request.url)}', {`)
  lines.push(`  method: '${method}',`)
  lines.push(...formatJsHeaders(request.headers))

  if (request.body && !NO_BODY_METHODS.has(method)) {
    const bodyLine = formatJsBody(request.body)
    if (bodyLine) {
      lines.push(`  ${bodyLine},`)
    }
  }

  lines.push('})')
  return lines.join('\n')
}
