import type {
  ExecuteRequestType,
  PreviewRequestType,
  RequestBodyDtoType,
  RequestHeaderDtoType,
} from '@reqor/shared-types'

type DiskRequest = {
  method: string
  url: string
  headers: RequestHeaderDtoType[]
  body?: RequestBodyDtoType
}

type DraftOverrideBody = Pick<ExecuteRequestType | PreviewRequestType, 'method' | 'url' | 'headers' | 'body'>

export type MergedRequestFields = {
  method: string
  url: string
  headers: Array<{ name: string; value: string }>
  body?: { kind: RequestBodyDtoType['kind']; content: string }
}

/**
 * Merge preview/execute draft overrides onto the disk request (Story 3.1).
 * - `headers` present → replace; omit → disk headers
 * - `body === null` → clear; object → override; omit → disk body
 */
export function mergeDraftOverrides(
  req: DiskRequest,
  body: DraftOverrideBody,
): MergedRequestFields {
  const method = (body.method ?? req.method).toUpperCase().trim()
  const url = body.url ?? req.url

  const headers =
    body.headers !== undefined
      ? body.headers.map((header) => ({ name: header.name, value: header.value }))
      : req.headers.map((header) => ({ name: header.name, value: header.value }))

  const resolvedBody =
    body.body === null
      ? undefined
      : body.body !== undefined
        ? { kind: body.body.kind, content: body.body.content }
        : req.body
          ? { kind: req.body.kind, content: req.body.content }
          : undefined

  return {
    method,
    url,
    headers,
    ...(resolvedBody ? { body: resolvedBody } : {}),
  }
}
