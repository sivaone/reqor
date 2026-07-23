import type { RedactedExportRequest } from './load-export-request.js'

const NO_BODY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const METHOD_TO_REQUESTS_FN: Record<string, string> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
  HEAD: 'head',
  OPTIONS: 'options',
}

function escapePythonSingleQuote(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function jsonToPythonLiteral(value: unknown): string {
  if (value === null) {
    return 'None'
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return "float('nan')"
    }
    if (value === Infinity) {
      return "float('inf')"
    }
    if (value === -Infinity) {
      return "float('-inf')"
    }
    return String(value)
  }
  if (typeof value === 'string') {
    return `'${escapePythonSingleQuote(value)}'`
  }
  if (Array.isArray(value)) {
    const items = value.map((entry) => jsonToPythonLiteral(entry)).join(', ')
    return `[${items}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(
        ([key, entry]) =>
          `'${escapePythonSingleQuote(key)}': ${jsonToPythonLiteral(entry)}`,
      )
      .join(', ')
    return `{${entries}}`
  }
  return `'${escapePythonSingleQuote(String(value))}'`
}

function parseFormFields(content: string): Record<string, string> | null {
  if (!content || content.includes('\n')) {
    return null
  }

  const result: Record<string, string> = {}
  for (const pair of content.split('&')) {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex <= 0) {
      return null
    }
    const key = pair.slice(0, separatorIndex)
    const value = pair.slice(separatorIndex + 1)
    result[key] = value
  }
  return result
}

function formatPythonBody(body: RedactedExportRequest['body']): string | null {
  if (!body) {
    return null
  }

  if (body.kind === 'json') {
    try {
      const parsed = JSON.parse(body.content) as unknown
      return `    json=${jsonToPythonLiteral(parsed)},`
    } catch {
      return `    data='${escapePythonSingleQuote(body.content)}',`
    }
  }

  if (body.kind === 'form') {
    const fields = parseFormFields(body.content)
    if (fields) {
      return `    data=${jsonToPythonLiteral(fields)},`
    }
  }

  return `    data='${escapePythonSingleQuote(body.content)}',`
}

function formatPythonHeaders(headers: RedactedExportRequest['headers']): string[] {
  if (headers.length === 0) {
    return []
  }

  const lines = ['    headers=[']
  for (const header of headers) {
    lines.push(
      `        ('${escapePythonSingleQuote(header.name)}', '${escapePythonSingleQuote(header.value)}'),`,
    )
  }
  lines.push('    ],')
  return lines
}

export function serializeSnippetPython(request: RedactedExportRequest): string {
  const method = request.method.toUpperCase()
  const lines: string[] = ['import requests', '']

  const requestsFn = METHOD_TO_REQUESTS_FN[method]
  const callStart = requestsFn
    ? `response = requests.${requestsFn}(`
    : `response = requests.request('${method}', `

  lines.push(callStart)
  lines.push(`    '${escapePythonSingleQuote(request.url)}',`)
  lines.push(...formatPythonHeaders(request.headers))

  if (request.body && !NO_BODY_METHODS.has(method)) {
    const bodyLine = formatPythonBody(request.body)
    if (bodyLine) {
      lines.push(bodyLine)
    }
  }

  lines.push(')')
  return lines.join('\n')
}
