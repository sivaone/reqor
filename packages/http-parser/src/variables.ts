import type { ParsedRequest } from './ast.js'

export type VariableKind =
  | 'env'
  | 'uuid'
  | 'timestamp'
  | 'randomInt'
  | 'dotenv'

/** Which ParsedRequest field the placeholder was scanned from */
export type VariableLocation =
  | { part: 'url' }
  | { part: 'header'; index: number }
  | { part: 'body' }

export interface VariableReference {
  kind: VariableKind
  /** Env var name or dotenv KEY; for builtins use 'uuid' | 'timestamp' | 'randomInt' */
  name: string
  /** Exact matched placeholder substring, e.g. "{{host}}" or "{{$dotenv API_KEY}}" */
  raw: string
  /** 0-based start index within the scanned field string (url / header value / body content) */
  start: number
  /** 0-based end index (exclusive) within that same field string */
  end: number
  /** Field provenance — required so Story 2.5 can replace by offset without colliding across fields */
  location: VariableLocation
}

/** Must match parse.ts OAUTH_PATTERN = /\{\{\s*\$oauth/i (inner form after trim) */
const OAUTH_INNER_PATTERN = /^\$oauth/i

/** Must match Task 2.2 classification order exactly */
function classifyInner(
  inner: string,
): Pick<VariableReference, 'kind' | 'name'> | null {
  if (/^\$uuid$/i.test(inner)) return { kind: 'uuid', name: 'uuid' }
  if (/^\$timestamp$/i.test(inner)) return { kind: 'timestamp', name: 'timestamp' }
  if (/^\$randomInt$/i.test(inner)) return { kind: 'randomInt', name: 'randomInt' }
  const dotenv = inner.match(/^\$dotenv\s+(.+)$/i)
  if (dotenv) return { kind: 'dotenv', name: dotenv[1]!.trim() }
  if (OAUTH_INNER_PATTERN.test(inner)) return null
  if (/^[\w.-]+$/.test(inner)) return { kind: 'env', name: inner }
  return null
}

/**
 * Find all recognized `{{…}}` placeholders in one field string.
 * `VariableReference.raw` is the exact substring to replace within the field
 * identified by `location` at send time (Story 2.5).
 */
export function scanVariables(
  text: string,
  location: VariableLocation,
): VariableReference[] {
  const refs: VariableReference[] = []
  const re = /\{\{([^}]*)\}\}/g
  for (const match of text.matchAll(re)) {
    const raw = match[0]
    const inner = match[1]!.trim()
    if (!inner) continue
    const start = match.index!
    const end = start + raw.length
    const classified = classifyInner(inner)
    if (classified) {
      refs.push({ ...classified, raw, start, end, location: { ...location } })
    }
  }
  return refs
}

export function collectRequestVariables(
  request: ParsedRequest,
): VariableReference[] {
  const out: VariableReference[] = []
  out.push(...scanVariables(request.url, { part: 'url' }))
  request.headers.forEach((h, index) => {
    out.push(...scanVariables(h.value, { part: 'header', index }))
  })
  if (request.body) {
    out.push(...scanVariables(request.body.content, { part: 'body' }))
  }
  return out
}
