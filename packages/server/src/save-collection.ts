import {
  DIAG_PARSE_ERROR,
  parseHttpFile,
  serializeHttpFile,
  serializeRequest,
  type ParseResult,
  type ParsedRequest,
} from '@reqor/http-parser'
import type { SaveCollectionWarningType } from '@reqor/shared-types'
import { spliceRequestSpan } from './splice-request-span.js'

const FULL_REWRITE_WARNING: SaveCollectionWarningType = {
  code: 'FULL_REWRITE',
  message: 'File rewritten with formatting changes. Review git diff.',
}

function normalizeRequest(request: ParsedRequest): ParsedRequest {
  return {
    method: request.method.toUpperCase(),
    url: request.url,
    httpVersion: request.httpVersion,
    headers: request.headers.map((header) => ({
      name: header.name.trim(),
      value: header.value,
      line: header.line,
    })),
    body: request.body,
    span: request.span,
  }
}

function requestsEquivalent(a: ParsedRequest, b: ParsedRequest): boolean {
  const left = normalizeRequest(a)
  const right = normalizeRequest(b)

  if (left.method !== right.method || left.url !== right.url) return false
  if (left.httpVersion !== right.httpVersion) return false
  if (left.headers.length !== right.headers.length) return false

  for (let index = 0; index < left.headers.length; index++) {
    const leftHeader = left.headers[index]!
    const rightHeader = right.headers[index]!
    if (leftHeader.name !== rightHeader.name || leftHeader.value !== rightHeader.value) {
      return false
    }
  }

  if (Boolean(left.body) !== Boolean(right.body)) return false
  if (left.body && right.body) {
    if (left.body.kind !== right.body.kind || left.body.content !== right.body.content) {
      return false
    }
  }

  return true
}

function hasParseError(parseResult: ParseResult): boolean {
  return parseResult.diagnostics.some((diagnostic) => diagnostic.code === DIAG_PARSE_ERROR)
}

function firstParseError(parseResult: ParseResult): { line: number; message: string } {
  const diagnostic =
    parseResult.diagnostics.find((entry) => entry.code === DIAG_PARSE_ERROR) ??
    parseResult.diagnostics[0]
  return {
    line: diagnostic?.line ?? 1,
    message: diagnostic?.message ?? 'Failed to parse HTTP file',
  }
}

export type MinimalDiffSaveResult =
  | {
      ok: true
      content: string
      parseResult: ParseResult
      warning?: SaveCollectionWarningType
    }
  | {
      ok: false
      code: 'PARSE_ERROR'
      message: string
      line: number
    }

function fullRewrite(
  incomingParse: ParseResult,
  warning = FULL_REWRITE_WARNING,
): MinimalDiffSaveResult {
  return {
    ok: true,
    content: serializeHttpFile(incomingParse),
    parseResult: incomingParse,
    warning,
  }
}

export function minimalDiffSave(
  diskContent: string,
  incomingContent: string,
): MinimalDiffSaveResult {
  const incomingParse = parseHttpFile(incomingContent)
  if (hasParseError(incomingParse)) {
    const error = firstParseError(incomingParse)
    return {
      ok: false,
      code: 'PARSE_ERROR',
      message: error.message,
      line: error.line,
    }
  }

  const diskParse = parseHttpFile(diskContent)
  if (hasParseError(diskParse)) {
    return fullRewrite(incomingParse)
  }

  if (diskParse.requests.length !== incomingParse.requests.length) {
    return fullRewrite(incomingParse)
  }

  let patchedContent = diskContent
  let usedFallback = false

  for (let index = 0; index < incomingParse.requests.length; index++) {
    const diskRequest = diskParse.requests[index]!
    const incomingRequest = incomingParse.requests[index]!
    if (requestsEquivalent(diskRequest, incomingRequest)) continue

    const serializedBlock = serializeRequest(incomingRequest)
    const spliced = spliceRequestSpan(patchedContent, diskRequest.span, serializedBlock)
    if (!spliced.ok) {
      usedFallback = true
      break
    }
    patchedContent = spliced.content
  }

  if (usedFallback) {
    return fullRewrite(incomingParse)
  }

  const verifyParse = parseHttpFile(patchedContent)
  if (hasParseError(verifyParse)) {
    return fullRewrite(incomingParse)
  }

  return {
    ok: true,
    content: patchedContent,
    parseResult: verifyParse,
  }
}
