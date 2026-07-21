import { escapeHtml } from './formatResponseBody.js'

export type HttpTokenType =
  | 'method'
  | 'url'
  | 'placeholder'
  | 'header-name'
  | 'header-value'
  | 'separator'
  | 'comment'
  | 'body'
  | 'plain'

export type HttpToken = {
  type: HttpTokenType
  value: string
}

const METHODS =
  /^(GET|HEAD|POST|PUT|DELETE|CONNECT|PATCH|OPTIONS|TRACE)(\s+)(\S+)(.*)$/i
const HEADER = /^([^:#\s][^:]*)(:)(.*)$/
const SEPARATOR = /^###(.*)$/
const COMMENT = /^#(.*)$/

function tokenizeLine(line: string, inBody: boolean): { tokens: HttpToken[]; inBody: boolean } {
  if (inBody) {
    if (SEPARATOR.test(line)) {
      return { tokens: [{ type: 'separator', value: line }], inBody: false }
    }
    return { tokens: [{ type: 'body', value: line }], inBody: true }
  }

  if (SEPARATOR.test(line)) {
    return { tokens: [{ type: 'separator', value: line }], inBody: false }
  }
  if (COMMENT.test(line)) {
    return { tokens: [{ type: 'comment', value: line }], inBody: false }
  }

  const methodMatch = METHODS.exec(line)
  if (methodMatch) {
    const [, method, spaces, url, rest] = methodMatch
    const tokens: HttpToken[] = [
      { type: 'method', value: method! },
      { type: 'plain', value: spaces! },
    ]
    tokens.push(...tokenizeUrl(url!))
    if (rest) tokens.push({ type: 'plain', value: rest })
    return { tokens, inBody: false }
  }

  const headerMatch = HEADER.exec(line)
  if (headerMatch) {
    return {
      tokens: [
        { type: 'header-name', value: headerMatch[1]! },
        { type: 'plain', value: headerMatch[2]! },
        { type: 'header-value', value: headerMatch[3]! },
      ],
      inBody: false,
    }
  }

  if (line.trim() === '') {
    return { tokens: [{ type: 'plain', value: line }], inBody: true }
  }

  return { tokens: [{ type: 'plain', value: line }], inBody: false }
}

function tokenizeUrl(url: string): HttpToken[] {
  const tokens: HttpToken[] = []
  const pattern = /(\{\{[^}]*\}\})/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(url)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'url', value: url.slice(last, match.index) })
    }
    tokens.push({ type: 'placeholder', value: match[1]! })
    last = match.index + match[1]!.length
  }
  if (last < url.length) {
    tokens.push({ type: 'url', value: url.slice(last) })
  }
  if (tokens.length === 0) {
    tokens.push({ type: 'url', value: url })
  }
  return tokens
}

export function tokenizeHttp(content: string): HttpToken[] {
  const lines = content.split(/\r?\n/)
  const tokens: HttpToken[] = []
  let inBody = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const result = tokenizeLine(line, inBody)
    inBody = result.inBody
    tokens.push(...result.tokens)
    if (i < lines.length - 1) {
      tokens.push({ type: 'plain', value: '\n' })
    }
  }
  return tokens
}

const TOKEN_CLASS: Record<HttpTokenType, string> = {
  method: 'text-primary',
  url: 'text-foreground',
  placeholder: 'text-success',
  'header-name': 'text-primary',
  'header-value': 'text-foreground',
  separator: 'text-foreground-muted',
  comment: 'text-foreground-muted',
  body: 'text-foreground',
  plain: 'text-foreground',
}

export function highlightHttpHtml(content: string): string {
  return tokenizeHttp(content)
    .map((token) => {
      const cls = TOKEN_CLASS[token.type]
      return `<span class="${cls}">${escapeHtml(token.value)}</span>`
    })
    .join('')
}
