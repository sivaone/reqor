import { classifyBodyKind, isHttpMethod, normalizeMethod, type BodyKind } from './ast.js'

export type ParsedCurlHeader = {
  name: string
  value: string
}

export type ParsedCurlBody = {
  kind: BodyKind
  content: string
}

export type ParseCurlResult = {
  method: string
  url: string
  headers: ParsedCurlHeader[]
  body?: ParsedCurlBody
  warnings: string[]
}

const SUPPORTED_FLAGS = new Set([
  '-X',
  '--request',
  '-H',
  '--header',
  '-d',
  '--data',
  '--data-raw',
  '--data-binary',
  '--json',
  '-u',
  '--user',
])

const DATA_FLAGS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--json'])

function tokenizeCurl(input: string): string[] {
  const tokens: string[] = []
  let i = 0
  const text = input.trim()

  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i]!)) i++
    if (i >= text.length) break

    const ch = text[i]!
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      let value = ''
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\' && i + 1 < text.length) {
          value += text[i + 1]
          i += 2
        } else {
          value += text[i]
          i++
        }
      }
      if (i < text.length) i++
      tokens.push(value)
      continue
    }

    let token = ''
    while (i < text.length && !/\s/.test(text[i]!)) {
      token += text[i]
      i++
    }
    tokens.push(token)
  }

  return tokens
}

function looksLikeUrl(token: string): boolean {
  return /^https?:\/\//i.test(token) || token.startsWith('{{') || token.startsWith('$')
}

function parseHeaderValue(raw: string): ParsedCurlHeader | null {
  const colon = raw.indexOf(':')
  if (colon <= 0) return null
  const name = raw.slice(0, colon).trim()
  const value = raw.slice(colon + 1).trim()
  if (!name) return null
  return { name, value }
}

function encodeBasicAuth(userPass: string): string {
  const encoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(userPass, 'utf8').toString('base64')
      : btoa(userPass)
  return `Basic ${encoded}`
}

function addHeader(headers: ParsedCurlHeader[], header: ParsedCurlHeader): void {
  const existing = headers.findIndex((h) => h.name.toLowerCase() === header.name.toLowerCase())
  if (existing >= 0) {
    headers[existing] = header
  } else {
    headers.push(header)
  }
}

function finalizeBody(
  headers: ParsedCurlHeader[],
  content: string,
  forceJson = false,
): ParsedCurlBody {
  if (forceJson) {
    addHeader(headers, { name: 'Content-Type', value: 'application/json' })
  }
  const kind = forceJson
    ? 'json'
    : classifyBodyKind(
        headers.map((h) => ({ ...h, line: 1 })),
        content,
      )
  return { kind, content }
}

export function parseCurl(input: string): ParseCurlResult {
  const warnings: string[] = []
  let trimmed = input.trim().replace(/\\\s*\r?\n/g, ' ')
  if (!trimmed) {
    return { method: 'GET', url: '', headers: [], warnings: ['Empty cURL command'] }
  }

  if (/^curl\b/i.test(trimmed)) {
    trimmed = trimmed.replace(/^curl\b/i, '').trim()
  }

  const tokens = tokenizeCurl(trimmed)
  let method = 'GET'
  let url = ''
  const headers: ParsedCurlHeader[] = []
  let bodyContent: string | undefined
  let forceJson = false
  let hasDataFlag = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (!token.startsWith('-')) {
      if (looksLikeUrl(token)) {
        url = token
      } else if (!url) {
        url = token
      }
      continue
    }

    const eqIndex = token.indexOf('=')
    const flag = eqIndex > 0 ? token.slice(0, eqIndex) : token
    const inlineValue = eqIndex > 0 ? token.slice(eqIndex + 1) : undefined

    if (!SUPPORTED_FLAGS.has(flag)) {
      warnings.push(`Unsupported flag: ${flag}`)
      if (inlineValue === undefined && i + 1 < tokens.length && !tokens[i + 1]!.startsWith('-')) {
        i++
      }
      continue
    }

    const value = inlineValue ?? tokens[++i]
    if (value === undefined || (!inlineValue && value.startsWith('-'))) {
      warnings.push(`Missing value for flag: ${flag}`)
      if (!inlineValue && value?.startsWith('-')) i--
      continue
    }

    switch (flag) {
      case '-X':
      case '--request':
        if (!isHttpMethod(value)) {
          warnings.push(`Unknown HTTP method: ${value}`)
        }
        method = normalizeMethod(value)
        break
      case '-H':
      case '--header': {
        const header = parseHeaderValue(value)
        if (header) addHeader(headers, header)
        else warnings.push(`Invalid header: ${value}`)
        break
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
        if (hasDataFlag) {
          warnings.push('Multiple data flags; using last value')
        }
        if (value.startsWith('@')) {
          warnings.push('File references in -d are not supported')
        }
        bodyContent = value
        forceJson = false
        hasDataFlag = true
        break
      case '--json':
        if (hasDataFlag) {
          warnings.push('Multiple data flags; using last value')
        }
        bodyContent = value
        forceJson = true
        hasDataFlag = true
        break
      case '-u':
      case '--user':
        addHeader(headers, { name: 'Authorization', value: encodeBasicAuth(value) })
        break
    }
  }

  if (hasDataFlag && method === 'GET') {
    method = 'POST'
  }

  const body = bodyContent !== undefined ? finalizeBody(headers, bodyContent, forceJson) : undefined

  return {
    method: normalizeMethod(method),
    url,
    headers,
    body,
    warnings,
  }
}
