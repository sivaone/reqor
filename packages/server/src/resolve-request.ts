import { scanVariables, type VariableReference } from '@reqor/http-parser'
import type { EnvResolver } from './env-resolver.js'

export interface ResolveRequestFieldHeaders {
  name: string
  value: string
}

export interface ResolveRequestBody {
  kind: 'raw' | 'json' | 'form'
  content: string
}

export interface ResolveRequestInput {
  method: string
  url: string
  headers: ResolveRequestFieldHeaders[]
  body?: ResolveRequestBody
  environmentName?: string | null
}

export interface ResolveRequestResult {
  resolved: {
    method: string
    url: string
    headers: ResolveRequestFieldHeaders[]
    body?: ResolveRequestBody
  }
  unresolved: { name: string; raw: string } | null
  secrets: string[]
  hasVariables: boolean
}

function collectRefs(input: ResolveRequestInput): VariableReference[] {
  const refs: VariableReference[] = []
  refs.push(...scanVariables(input.url, { part: 'url' }))
  input.headers.forEach((header, index) => {
    refs.push(...scanVariables(header.value, { part: 'header', index }))
  })
  if (input.body) {
    refs.push(...scanVariables(input.body.content, { part: 'body' }))
  }
  return refs
}

function resolveReference(
  ref: VariableReference,
  resolver: EnvResolver,
  environmentName: string | null | undefined,
): string | undefined {
  switch (ref.kind) {
    case 'env':
      return resolver.resolveEnv(ref.name, environmentName)
    case 'dotenv':
      return resolver.resolveDotenv(ref.name)
    case 'uuid':
    case 'timestamp':
    case 'randomInt':
      return resolver.resolveBuiltin(ref.kind)
  }
}

function applyReplacements(
  text: string,
  replacements: Array<{ start: number; end: number; value: string }>,
): string {
  const ordered = [...replacements].sort((a, b) => b.start - a.start)
  let result = text
  for (const replacement of ordered) {
    result =
      result.slice(0, replacement.start) +
      replacement.value +
      result.slice(replacement.end)
  }
  return result
}

/**
 * Single-pass send-time resolution shared by preview and execute (AD-8).
 * Does not recursively resolve values pulled from env/dotenv files.
 */
export function resolveRequest(
  input: ResolveRequestInput,
  resolver: EnvResolver,
): ResolveRequestResult {
  const environmentName = input.environmentName
  const secrets = resolver.getSecretValuesForRedaction(environmentName)
  const refs = collectRefs(input)
  const hasVariables = refs.length > 0

  const urlReplacements: Array<{ start: number; end: number; value: string }> = []
  const headerReplacements = new Map<
    number,
    Array<{ start: number; end: number; value: string }>
  >()
  const bodyReplacements: Array<{ start: number; end: number; value: string }> = []

  let unresolved: { name: string; raw: string } | null = null

  for (const ref of refs) {
    const value = resolveReference(ref, resolver, environmentName)
    if (value === undefined) {
      unresolved = { name: ref.name, raw: ref.raw }
      break
    }

    const replacement = { start: ref.start, end: ref.end, value }
    if (ref.location.part === 'url') {
      urlReplacements.push(replacement)
    } else if (ref.location.part === 'header') {
      const list = headerReplacements.get(ref.location.index) ?? []
      list.push(replacement)
      headerReplacements.set(ref.location.index, list)
    } else {
      bodyReplacements.push(replacement)
    }
  }

  const resolvedUrl = applyReplacements(input.url, urlReplacements)
  const resolvedHeaders = input.headers.map((header, index) => ({
    name: header.name,
    value: applyReplacements(header.value, headerReplacements.get(index) ?? []),
  }))

  const resolvedBody =
    input.body === undefined
      ? undefined
      : {
          kind: input.body.kind,
          content: applyReplacements(input.body.content, bodyReplacements),
        }

  return {
    resolved: {
      method: input.method,
      url: resolvedUrl,
      headers: resolvedHeaders,
      ...(resolvedBody !== undefined ? { body: resolvedBody } : {}),
    },
    unresolved,
    secrets,
    hasVariables,
  }
}
