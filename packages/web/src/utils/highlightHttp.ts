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

type LineState = {
  inBody: boolean
  /** True once a request-line was seen since the last `###` separator. */
  seenMethod: boolean
}

function tokenizeLine(
  line: string,
  state: LineState,
): { tokens: HttpToken[]; state: LineState } {
  if (state.inBody) {
    if (SEPARATOR.test(line)) {
      return {
        tokens: [{ type: 'separator', value: line }],
        state: { inBody: false, seenMethod: false },
      }
    }
    return {
      tokens: [{ type: 'body', value: line }],
      state: { inBody: true, seenMethod: state.seenMethod },
    }
  }

  if (SEPARATOR.test(line)) {
    return {
      tokens: [{ type: 'separator', value: line }],
      state: { inBody: false, seenMethod: false },
    }
  }
  if (COMMENT.test(line)) {
    return {
      tokens: [{ type: 'comment', value: line }],
      state: { inBody: false, seenMethod: state.seenMethod },
    }
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
    return { tokens, state: { inBody: false, seenMethod: true } }
  }

  const headerMatch = HEADER.exec(line)
  if (headerMatch) {
    return {
      tokens: [
        { type: 'header-name', value: headerMatch[1]! },
        { type: 'plain', value: headerMatch[2]! },
        { type: 'header-value', value: headerMatch[3]! },
      ],
      state: { inBody: false, seenMethod: state.seenMethod },
    }
  }

  // Blank lines start the body only after a request-line in this section.
  // Leading blanks after `###` (or at file start) must not swallow the next method.
  if (line.trim() === '') {
    return {
      tokens: [{ type: 'plain', value: line }],
      state: {
        inBody: state.seenMethod,
        seenMethod: state.seenMethod,
      },
    }
  }

  return {
    tokens: [{ type: 'plain', value: line }],
    state: { inBody: false, seenMethod: state.seenMethod },
  }
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
  let state: LineState = { inBody: false, seenMethod: false }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const result = tokenizeLine(line, state)
    state = result.state
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
