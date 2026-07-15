import crypto from 'node:crypto'
import {
  DIAG_PARSE_ERROR,
  type Diagnostic,
  type ParseResult,
  type ParsedRequest,
} from '@reqor/http-parser'
import type {
  CollectionDetailDtoType,
  CollectionSummaryDtoType,
  DiagnosticDtoType,
  ParseStatusType,
  RequestDtoType,
} from '@reqor/shared-types'

export function computeFingerprint(method: string, urlTemplate: string): string {
  return crypto
    .createHash('sha256')
    .update(`${method}:${urlTemplate}`)
    .digest('hex')
}

function toDiagnosticDto(diagnostic: Diagnostic): DiagnosticDtoType {
  return {
    line: diagnostic.line,
    message: diagnostic.message,
    ...(diagnostic.code !== undefined ? { code: diagnostic.code } : {}),
  }
}

function deriveParseStatus(diagnostics: Diagnostic[]): ParseStatusType {
  return diagnostics.some((d) => d.code === DIAG_PARSE_ERROR) ? 'error' : 'ok'
}

export function toRequestDto(
  parsed: ParsedRequest,
  requestIndex: number,
): RequestDtoType {
  return {
    requestIndex,
    fingerprint: computeFingerprint(parsed.method, parsed.url),
    method: parsed.method,
    url: parsed.url,
    ...(parsed.httpVersion !== undefined
      ? { httpVersion: parsed.httpVersion }
      : {}),
    headers: parsed.headers.map((header) => ({
      name: header.name,
      value: header.value,
    })),
    ...(parsed.body !== undefined
      ? {
          body: {
            kind: parsed.body.kind,
            content: parsed.body.content,
          },
        }
      : {}),
  }
}

export function toCollectionDetail(
  id: string,
  content: string,
  parseResult: ParseResult,
): CollectionDetailDtoType {
  const diagnostics = parseResult.diagnostics.map(toDiagnosticDto)

  return {
    id,
    content,
    parseStatus: deriveParseStatus(parseResult.diagnostics),
    requests: parseResult.requests.map((request, index) =>
      toRequestDto(request, index),
    ),
    diagnostics,
  }
}

export function toCollectionSummary(
  detail: CollectionDetailDtoType,
): CollectionSummaryDtoType {
  return {
    id: detail.id,
    parseStatus: detail.parseStatus,
    requestCount: detail.requests.length,
    diagnostics: detail.diagnostics,
  }
}

export function createErrorCollectionDetail(
  id: string,
  content: string,
  message: string,
): CollectionDetailDtoType {
  return {
    id,
    content,
    parseStatus: 'error',
    requests: [],
    diagnostics: [{ line: 1, message, code: DIAG_PARSE_ERROR }],
  }
}
