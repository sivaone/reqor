export interface SourceSpan {
  startLine: number
  endLine: number
}

export interface ParsedHeader {
  name: string
  value: string
  line: number
}

export type BodyKind = 'raw' | 'json' | 'form'

export interface ParsedBody {
  kind: BodyKind
  content: string
  line: number
}

export interface ParsedRequest {
  method: string
  url: string
  httpVersion?: string
  headers: ParsedHeader[]
  body?: ParsedBody
  span: SourceSpan
}

export interface Diagnostic {
  file?: string
  line: number
  message: string
  code?: string
}

export interface ParseOptions {
  file?: string
}

export interface ParseResult {
  requests: ParsedRequest[]
  diagnostics: Diagnostic[]
}

const HTTP_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'CONNECT',
  'PATCH',
  'OPTIONS',
  'TRACE',
])

export function normalizeMethod(method: string): string {
  return method.toUpperCase()
}

export function isHttpMethod(token: string): boolean {
  return HTTP_METHODS.has(token.toUpperCase())
}

export function classifyBodyKind(
  headers: ParsedHeader[],
  bodyContent: string,
): BodyKind {
  const contentType = headers.find(
    (h) => h.name.toLowerCase() === 'content-type',
  )?.value

  if (contentType?.includes('application/json')) {
    return 'json'
  }

  if (contentType?.includes('application/x-www-form-urlencoded')) {
    return 'form'
  }

  const trimmed = bodyContent.trim()
  if (trimmed && /^&/.test(trimmed) && trimmed.includes('=')) {
    return 'form'
  }

  return 'raw'
}

function normalizeHeader(header: ParsedHeader): ParsedHeader {
  return {
    name: header.name.trim(),
    value: header.value,
    line: header.line,
  }
}

function normalizeRequest(request: ParsedRequest): ParsedRequest {
  return {
    method: normalizeMethod(request.method),
    url: request.url,
    httpVersion: request.httpVersion,
    headers: request.headers.map(normalizeHeader),
    body: request.body,
    span: request.span,
  }
}

function normalizeDiagnostic(d: Diagnostic): Diagnostic {
  return {
    line: d.line,
    message: d.message,
    code: d.code,
  }
}

export function astEquivalent(a: ParseResult, b: ParseResult): boolean {
  if (a.requests.length !== b.requests.length) {
    return false
  }

  for (let i = 0; i < a.requests.length; i++) {
    const ra = normalizeRequest(a.requests[i]!)
    const rb = normalizeRequest(b.requests[i]!)

    if (ra.method !== rb.method || ra.url !== rb.url) {
      return false
    }

    if (ra.httpVersion !== rb.httpVersion) {
      return false
    }

    if (ra.headers.length !== rb.headers.length) {
      return false
    }

    for (let j = 0; j < ra.headers.length; j++) {
      const ha = ra.headers[j]!
      const hb = rb.headers[j]!
      if (ha.name !== hb.name || ha.value !== hb.value) {
        return false
      }
    }

    if (Boolean(ra.body) !== Boolean(rb.body)) {
      return false
    }

    if (ra.body && rb.body) {
      if (
        ra.body.kind !== rb.body.kind ||
        ra.body.content !== rb.body.content
      ) {
        return false
      }
    }
  }

  const diagA = a.diagnostics.map(normalizeDiagnostic)
  const diagB = b.diagnostics.map(normalizeDiagnostic)

  if (diagA.length !== diagB.length) {
    return false
  }

  for (let i = 0; i < diagA.length; i++) {
    const da = diagA[i]!
    const db = diagB[i]!
    if (
      da.line !== db.line ||
      da.message !== db.message ||
      da.code !== db.code
    ) {
      return false
    }
  }

  return true
}
