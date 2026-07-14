import {
  classifyBodyKind,
  isHttpMethod,
  normalizeMethod,
  type Diagnostic,
  type ParseOptions,
  type ParseResult,
  type ParsedBody,
  type ParsedHeader,
  type ParsedRequest,
} from './ast.js'
import { parseError, unsupportedConstruct } from './diagnostics.js'

interface RequestBlock {
  lines: string[]
  startLine: number
  separatorComment?: string
}

const OAUTH_PATTERN = /\{\{\s*\$oauth/i

function isFileInclusionLine(trimmed: string): boolean {
  return /^<\s+\S/.test(trimmed)
}

function isResponseRefLine(trimmed: string): boolean {
  return /^<>\s+\S/.test(trimmed)
}

function isInlineScriptLine(trimmed: string): boolean {
  return /^>\s*(\{%|\{)/.test(trimmed)
}

function isResponseHandlerLine(trimmed: string): boolean {
  return /^>\s+\S/.test(trimmed)
}

function isPostRequestOutLine(trimmed: string): boolean {
  return (
    isFileInclusionLine(trimmed) ||
    isResponseRefLine(trimmed) ||
    isResponseHandlerLine(trimmed)
  )
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart()
  return trimmed.startsWith('#') || trimmed.startsWith('//')
}

function isBlankLine(line: string): boolean {
  return line.trim() === ''
}

function isIndentedContinuation(line: string): boolean {
  return /^\s+\S/.test(line)
}

function scanOutConstructs(
  lines: string[],
  startLine: number,
  options?: ParseOptions,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const requestLineIdx = findRequestLineIndex(lines)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNo = startLine + i
    const trimmed = line.trimStart()

    if (/^@[\w-]+/.test(trimmed)) {
      diagnostics.push(
        unsupportedConstruct(lineNo, '@name request reference', options),
      )
    }

    if (isInlineScriptLine(trimmed)) {
      const construct =
        requestLineIdx >= 0 && i < requestLineIdx
          ? 'pre-request script'
          : 'response handler script'
      diagnostics.push(unsupportedConstruct(lineNo, construct, options))
    } else if (
      isResponseHandlerLine(trimmed) &&
      requestLineIdx >= 0 &&
      i >= requestLineIdx
    ) {
      diagnostics.push(
        unsupportedConstruct(lineNo, 'response handler script', options),
      )
    }

    if (isFileInclusionLine(trimmed)) {
      diagnostics.push(
        unsupportedConstruct(lineNo, 'file inclusion (< path)', options),
      )
    }

    if (isResponseRefLine(trimmed)) {
      diagnostics.push(
        unsupportedConstruct(lineNo, 'response reference (<> path)', options),
      )
    }

    if (OAUTH_PATTERN.test(line)) {
      diagnostics.push(
        unsupportedConstruct(lineNo, 'OAuth2 helper variable', options),
      )
    }
  }

  return diagnostics
}

function isValidRequestTarget(url: string): boolean {
  if (!url) return false
  if (url === '*') return true
  if (url.startsWith('/')) return true
  if (/^https?:\/\//i.test(url)) return true
  if (url.includes('://')) return true
  if (url.startsWith('{{')) return true
  if (url.startsWith('[')) return true
  // schemeless absolute-form (authority/path per JetBrains spec)
  if (/[/:?#]/.test(url) || url.includes('.')) return true
  return false
}

function joinUrlLines(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .join('')
}

function findRequestLineIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (isBlankLine(line) || isCommentLine(line)) continue
    if (/^@[\w-]+/.test(line.trimStart())) continue
    if (/^>\s*(\{%|\{)/.test(line.trimStart())) continue
    return i
  }
  return -1
}

function parseRequestLine(
  line: string,
  lineNo: number,
  continuationLines: string[],
  continuationStartLine: number,
): { request: Partial<ParsedRequest> } | { error: Diagnostic } {
  const fullLine = line.trim()
  const tokens = fullLine.split(/\s+/)

  let method = 'GET'
  let rest: string[]

  if (tokens.length === 0 || tokens[0] === '') {
    return { error: parseError(lineNo, 'Empty request line') }
  }

  if (isHttpMethod(tokens[0]!)) {
    method = normalizeMethod(tokens[0]!)
    rest = tokens.slice(1)
  } else {
    rest = tokens
  }

  if (rest.length === 0) {
    return { error: parseError(lineNo, 'Missing request target in request line') }
  }

  let httpVersion: string | undefined
  const last = rest[rest.length - 1]!
  if (/^HTTP\/\d+(\.\d+)?$/i.test(last)) {
    httpVersion = last.toUpperCase()
    rest = rest.slice(0, -1)
  }

  if (rest.length === 0) {
    return { error: parseError(lineNo, 'Missing request target in request line') }
  }

  const urlParts = [rest.join(' ')]
  for (const cont of continuationLines) {
    urlParts.push(cont.trimStart())
  }

  const url = joinUrlLines(urlParts)

  if (!url || !isValidRequestTarget(url)) {
    return {
      error: parseError(lineNo, 'Malformed request line: invalid request target'),
    }
  }

  return {
    request: {
      method,
      url,
      httpVersion,
    },
  }
}

function parseHeaderField(
  line: string,
  lineNo: number,
  continuationLines: string[],
): ParsedHeader | Diagnostic {
  const colonIdx = line.indexOf(':')
  if (colonIdx < 0) {
    return parseError(lineNo, 'Malformed header: missing colon')
  }

  const name = line.slice(0, colonIdx).trim()
  let value = line.slice(colonIdx + 1).trimStart()

  if (!name) {
    return parseError(lineNo, 'Malformed header: empty field name')
  }

  for (const cont of continuationLines) {
    value += ' ' + cont.trimStart()
  }

  return { name, value, line: lineNo }
}

function parseRequestBlock(
  block: RequestBlock,
  options?: ParseOptions,
): { request?: ParsedRequest; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [
    ...scanOutConstructs(block.lines, block.startLine, options),
  ]

  let idx = 0
  while (idx < block.lines.length) {
    const line = block.lines[idx]!
    if (isBlankLine(line) || isCommentLine(line)) {
      idx++
      continue
    }
    const trimmed = line.trimStart()
    if (
      /^@[\w-]+/.test(trimmed) ||
      /^>\s*(\{%|\{)/.test(trimmed)
    ) {
      idx++
      continue
    }
    break
  }

  if (idx >= block.lines.length) {
    return { diagnostics }
  }

  const requestStartLine = block.startLine + idx
  const requestLine = block.lines[idx]!
  idx++

  const urlContinuations: string[] = []
  while (idx < block.lines.length && isIndentedContinuation(block.lines[idx]!)) {
    urlContinuations.push(block.lines[idx]!)
    idx++
  }

  const requestLineResult = parseRequestLine(
    requestLine,
    requestStartLine,
    urlContinuations,
    block.startLine + idx,
  )

  if ('error' in requestLineResult) {
    diagnostics.push({ ...requestLineResult.error, file: options?.file })
    return { diagnostics }
  }

  const headers: ParsedHeader[] = []

  while (idx < block.lines.length) {
    const line = block.lines[idx]!

    if (isBlankLine(line)) {
      idx++
      break
    }

    if (isCommentLine(line)) {
      idx++
      continue
    }

    const headerStartLine = block.startLine + idx
    const headerLine = line
    idx++

    const continuations: string[] = []
    while (idx < block.lines.length && isIndentedContinuation(block.lines[idx]!)) {
      continuations.push(block.lines[idx]!)
      idx++
    }

    const headerResult = parseHeaderField(headerLine, headerStartLine, continuations)
    if ('code' in headerResult && headerResult.code === 'PARSE_ERROR') {
      diagnostics.push({ ...headerResult, file: options?.file })
      continue
    }

    headers.push(headerResult as ParsedHeader)
  }

  const bodyLines: string[] = []
  let bodyStartLine = block.startLine + idx

  while (idx < block.lines.length) {
    const line = block.lines[idx]!
    if (isCommentLine(line)) {
      idx++
      continue
    }
    if (isPostRequestOutLine(line.trimStart())) {
      break
    }
    bodyLines.push(line)
    idx++
  }

  let body: ParsedBody | undefined
  if (bodyLines.length > 0) {
    const content = bodyLines.join('\n').replace(/\s+$/, '')
    if (content.length > 0) {
      body = {
        kind: classifyBodyKind(headers, content),
        content,
        line: bodyStartLine,
      }
    }
  }

  const endLine = block.startLine + block.lines.length - 1

  const request: ParsedRequest = {
    method: requestLineResult.request.method!,
    url: requestLineResult.request.url!,
    httpVersion: requestLineResult.request.httpVersion,
    headers,
    body,
    span: { startLine: requestStartLine, endLine },
  }

  return { request, diagnostics }
}

function splitIntoBlocks(content: string): RequestBlock[] {
  const lines = content.split(/\r?\n/)
  const blocks: RequestBlock[] = []
  let currentLines: string[] = []
  let blockStartLine = 1
  let separatorComment: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trimStart()

    if (trimmed.startsWith('###')) {
      if (currentLines.length > 0 || blocks.length > 0) {
        blocks.push({
          lines: currentLines,
          startLine: blockStartLine,
          separatorComment,
        })
      }
      currentLines = []
      const commentPart = trimmed.slice(3).trim()
      separatorComment = commentPart || undefined
      blockStartLine = i + 2
      continue
    }

    if (currentLines.length === 0 && blocks.length === 0 && i === 0) {
      blockStartLine = 1
    }

    currentLines.push(line)
  }

  if (currentLines.length > 0 || blocks.length === 0) {
    blocks.push({
      lines: currentLines,
      startLine: blockStartLine,
      separatorComment,
    })
  }

  return blocks
}

export function parseHttpFile(
  content: string,
  options?: ParseOptions,
): ParseResult {
  if (content === '') {
    return { requests: [], diagnostics: [] }
  }

  const blocks = splitIntoBlocks(content)
  const requests: ParsedRequest[] = []
  const diagnostics: Diagnostic[] = []

  for (const block of blocks) {
    if (block.lines.every((l) => isBlankLine(l) || isCommentLine(l))) {
      continue
    }

    const result = parseRequestBlock(block, options)
    diagnostics.push(...result.diagnostics)
    if (result.request) {
      requests.push(result.request)
    }
  }

  return { requests, diagnostics }
}
