import type {
  RequestBodyDtoType,
  RequestDtoType,
  RequestHeaderDtoType,
} from '@reqor/shared-types'

export type RequestDraft = {
  content: string
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

type UrlParts = {
  base: string
  query: string
  fragment: string
}

function splitUrlParts(url: string): UrlParts {
  const hashIndex = url.indexOf('#')
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex)
  const qIndex = withoutHash.indexOf('?')
  if (qIndex === -1) {
    return { base: withoutHash, query: '', fragment }
  }
  return {
    base: withoutHash.slice(0, qIndex),
    query: withoutHash.slice(qIndex + 1),
    fragment,
  }
}

export function draftFromRequest(
  req: RequestDtoType,
  content: string = '',
): RequestDraft {
  return {
    content,
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

/** Empty body on bodyless methods has no wire effect — ignore for dirty comparison. */
function normalizeDraftForCompare(draft: RequestDraft): RequestDraft {
  const method = draft.method.toUpperCase().trim()
  const bodyContent = draft.body?.content?.trim() ?? ''
  if (BODYLESS_METHODS.has(method) && !bodyContent) {
    const { body: _removed, ...rest } = draft
    return rest
  }
  return draft
}

export function draftEquals(a: RequestDraft, b: RequestDraft): boolean {
  const left = normalizeDraftForCompare(a)
  const right = normalizeDraftForCompare(b)
  if (left.content !== right.content) return false
  return structuredFieldsEqual(left, right)
}

function structuredFieldsEqual(a: RequestDraft, b: RequestDraft): boolean {
  if (a.method !== b.method || a.url !== b.url) return false
  if (a.headers.length !== b.headers.length) return false
  for (let index = 0; index < a.headers.length; index++) {
    const leftHeader = a.headers[index]!
    const rightHeader = b.headers[index]!
    if (leftHeader.name !== rightHeader.name || leftHeader.value !== rightHeader.value) {
      return false
    }
  }
  return bodyEquals(a.body, b.body)
}

export function structuredFieldsDifferFromBaseline(
  draft: RequestDraft,
  baseline: RequestDraft,
): boolean {
  return !structuredFieldsEqual(
    normalizeDraftForCompare(draft),
    normalizeDraftForCompare(baseline),
  )
}

/** Split on first `?` and preserve `#fragment` — never throws for template or relative URLs. */
export function parseUrlParams(url: string): UrlParam[] {
  const { query } = splitUrlParts(url)
  if (!query) return []
  const params = new URLSearchParams(query)
  const rows: UrlParam[] = []
  params.forEach((value, key) => {
    rows.push({ key, value })
  })
  return rows
}

/** Rebuild URL preserving base (including `{{...}}`) and fragment exactly; omit `?` when empty. */
export function applyUrlParams(url: string, params: UrlParam[]): string {
  const { base, fragment } = splitUrlParts(url)
  if (params.length === 0) return `${base}${fragment}`
  const search = new URLSearchParams()
  for (const param of params) {
    search.append(param.key, param.value)
  }
  const serialized = search.toString()
  return serialized ? `${base}?${serialized}${fragment}` : `${base}${fragment}`
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

  for (const param of parseUrlParams(draft.url)) {
    if (param.key.trim() === '') {
      return {
        valid: false,
        message: 'Query parameter name is required',
      }
    }
  }

  return { valid: true }
}
