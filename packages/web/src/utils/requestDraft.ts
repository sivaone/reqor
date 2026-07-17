import type {
  RequestBodyDtoType,
  RequestDtoType,
  RequestHeaderDtoType,
} from '@reqor/shared-types'

export type RequestDraft = {
  method: string
  url: string
  headers: RequestHeaderDtoType[]
  body?: RequestBodyDtoType
}

export type UrlParam = {
  key: string
  value: string
}

export type DraftValidation = {
  valid: boolean
  message?: string
}

const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function draftFromRequest(req: RequestDtoType): RequestDraft {
  return {
    method: req.method.toUpperCase(),
    url: req.url,
    headers: req.headers.map((header) => ({ name: header.name, value: header.value })),
    ...(req.body
      ? { body: { kind: req.body.kind, content: req.body.content } }
      : {}),
  }
}

function bodyEquals(
  a: RequestBodyDtoType | undefined,
  b: RequestBodyDtoType | undefined,
): boolean {
  if (a === undefined && b === undefined) return true
  if (a === undefined || b === undefined) return false
  return a.kind === b.kind && a.content === b.content
}

export function draftEquals(a: RequestDraft, b: RequestDraft): boolean {
  if (a.method !== b.method || a.url !== b.url) return false
  if (a.headers.length !== b.headers.length) return false
  for (let i = 0; i < a.headers.length; i++) {
    const left = a.headers[i]!
    const right = b.headers[i]!
    if (left.name !== right.name || left.value !== right.value) return false
  }
  return bodyEquals(a.body, b.body)
}

/** Split on first `?` — never throws for template or relative URLs. */
export function parseUrlParams(url: string): UrlParam[] {
  const qIndex = url.indexOf('?')
  if (qIndex === -1) return []
  const query = url.slice(qIndex + 1)
  const params = new URLSearchParams(query)
  const rows: UrlParam[] = []
  params.forEach((value, key) => {
    rows.push({ key, value })
  })
  return rows
}

/** Rebuild URL preserving base (including `{{...}}`) exactly; omit `?` when empty. */
export function applyUrlParams(url: string, params: UrlParam[]): string {
  const qIndex = url.indexOf('?')
  const base = qIndex === -1 ? url : url.slice(0, qIndex)
  if (params.length === 0) return base
  const search = new URLSearchParams()
  for (const param of params) {
    search.append(param.key, param.value)
  }
  const serialized = search.toString()
  return serialized ? `${base}?${serialized}` : base
}

export function validateRequestDraft(draft: RequestDraft): DraftValidation {
  const method = draft.method.toUpperCase().trim()
  const bodyContent = draft.body?.content?.trim() ?? ''
  const hasBodyContent = bodyContent.length > 0
  const hasContentType = draft.headers.some(
    (header) => header.name.trim().toLowerCase() === 'content-type',
  )

  if (BODYLESS_METHODS.has(method) && hasBodyContent) {
    return {
      valid: false,
      message: `${method} requests should not include a body`,
    }
  }

  if (BODYLESS_METHODS.has(method) && hasContentType && !hasBodyContent) {
    return {
      valid: false,
      message: 'Content-Type header requires a request body',
    }
  }

  for (const header of draft.headers) {
    if (header.name.trim() === '') {
      return {
        valid: false,
        message: 'Header name is required',
      }
    }
  }

  return { valid: true }
}
