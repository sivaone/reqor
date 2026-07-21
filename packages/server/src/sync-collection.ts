import {
  normalizeMethod,
  parseHttpFile,
  serializeRequest,
  type ParseResult,
  type ParsedRequest,
} from '@reqor/http-parser'
import type {
  SyncCollectionPatchType,
  SyncCollectionResponseType,
} from '@reqor/shared-types'
import { spliceRequestSpan } from './splice-request-span.js'
import { toCollectionDetail } from './to-dto.js'

export type VisualPatchInput = {
  content: string
  requestIndex: number
  patch: SyncCollectionPatchType
}

export type ApplyVisualPatchResult =
  | { ok: true; content: string }
  | { ok: false; code: 'INVALID_REQUEST_INDEX'; message: string }

export function applyVisualPatch(input: VisualPatchInput): ApplyVisualPatchResult {
  const { content, requestIndex, patch } = input
  const parsed = parseHttpFile(content)
  const existing = parsed.requests[requestIndex]
  if (!existing) {
    return {
      ok: false,
      code: 'INVALID_REQUEST_INDEX',
      message: `Request index ${requestIndex} not found`,
    }
  }

  const updated: ParsedRequest = {
    method: normalizeMethod(patch.method),
    url: patch.url,
    ...(existing.httpVersion !== undefined ? { httpVersion: existing.httpVersion } : {}),
    headers: patch.headers.map((header, index) => ({
      name: header.name,
      value: header.value,
      line: existing.headers[index]?.line ?? existing.span.startLine,
    })),
    span: existing.span,
  }

  if (patch.body === null) {
    // cleared
  } else if (patch.body !== undefined) {
    updated.body = {
      kind: patch.body.kind,
      content: patch.body.content,
      line: existing.body?.line ?? existing.span.endLine,
    }
  } else if (existing.body) {
    updated.body = existing.body
  }

  const serializedBlock = serializeRequest(updated)
  const spliced = spliceRequestSpan(content, existing.span, serializedBlock)
  if (!spliced.ok) {
    return {
      ok: false,
      code: 'INVALID_REQUEST_INDEX',
      message: `Request index ${requestIndex} span is invalid`,
    }
  }
  return {
    ok: true,
    content: spliced.content,
  }
}

export type SyncCollectionInput = {
  content: string
  requestIndex?: number
  patch?: SyncCollectionPatchType
}

export type SyncCollectionResult =
  | { ok: true; response: SyncCollectionResponseType }
  | { ok: false; code: 'INVALID_REQUEST_INDEX'; message: string }

export function syncCollection(
  id: string,
  input: SyncCollectionInput,
): SyncCollectionResult {
  let content = input.content

  if (input.patch !== undefined) {
    if (input.requestIndex === undefined) {
      return {
        ok: false,
        code: 'INVALID_REQUEST_INDEX',
        message: 'requestIndex is required when patch is provided',
      }
    }
    const patched = applyVisualPatch({
      content,
      requestIndex: input.requestIndex,
      patch: input.patch,
    })
    if (!patched.ok) return patched
    content = patched.content
  }

  const parseResult: ParseResult = parseHttpFile(content)
  const detail = toCollectionDetail(id, content, parseResult)
  return {
    ok: true,
    response: {
      content: detail.content,
      parseStatus: detail.parseStatus,
      requests: detail.requests,
      diagnostics: detail.diagnostics,
    },
  }
}
