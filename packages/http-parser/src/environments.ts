import type { Diagnostic } from './ast.js'
import { createDiagnostic, DIAG_UNSUPPORTED_VALUE, parseError } from './diagnostics.js'

export interface EnvVariable {
  key: string
  /** Canonical string form for later resolution; numbers/bools stringified at parse */
  value: string
  /** true when value originates from http-client.private.env.json (JetBrains private file) */
  isSecret: boolean
}

export interface ParsedEnvironment {
  name: string
  /** Repo-relative POSIX path of the public file when present, else private file */
  sourceFile: string
  variables: EnvVariable[]
}

export interface ParseEnvironmentsResult {
  environments: ParsedEnvironment[]
  diagnostics: Diagnostic[]
}

type EnvMap = Record<string, Record<string, unknown>>

function parseJsonFile(
  content: string | undefined,
  sourceFile: string | undefined,
): { data: EnvMap | null; diagnostics: Diagnostic[] } {
  if (content === undefined) {
    return { data: null, diagnostics: [] }
  }

  try {
    const text = content.replace(/^\uFEFF/, '')
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        data: null,
        diagnostics: [
          parseError(1, 'Environment file must be a JSON object', { file: sourceFile }),
        ],
      }
    }
    return { data: parsed as EnvMap, diagnostics: [] }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON'
    return {
      data: null,
      diagnostics: [parseError(1, message, { file: sourceFile })],
    }
  }
}

function coerceVariableValue(
  key: string,
  value: unknown,
  envName: string,
  sourceFile: string | undefined,
): { value: string } | { skip: true; diagnostic: Diagnostic } {
  if (typeof value === 'string') {
    return { value }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { value: String(value) }
  }

  const typeLabel =
    value === null
      ? 'null'
      : Array.isArray(value)
        ? 'array'
        : typeof value === 'object'
          ? 'object'
          : typeof value

  return {
    skip: true,
    diagnostic: createDiagnostic(
      1,
      `Skipping variable "${key}" in environment "${envName}": unsupported value type (${typeLabel})`,
      DIAG_UNSUPPORTED_VALUE,
      { file: sourceFile },
    ),
  }
}

function parseEnvMap(
  data: EnvMap,
  sourceFile: string | undefined,
  isPrivate: boolean,
): {
  environments: Map<string, Map<string, { value: string; isSecret: boolean }>>
  diagnostics: Diagnostic[]
} {
  const environments = new Map<string, Map<string, { value: string; isSecret: boolean }>>()
  const diagnostics: Diagnostic[] = []

  for (const [envName, variables] of Object.entries(data)) {
    if (!envName) {
      diagnostics.push(
        createDiagnostic(
          1,
          'Skipping environment with empty name',
          DIAG_UNSUPPORTED_VALUE,
          { file: sourceFile },
        ),
      )
      continue
    }

    if (variables === null || typeof variables !== 'object' || Array.isArray(variables)) {
      diagnostics.push(
        createDiagnostic(
          1,
          `Skipping environment "${envName}": expected object of variables`,
          DIAG_UNSUPPORTED_VALUE,
          { file: sourceFile },
        ),
      )
      continue
    }

    const varMap = new Map<string, { value: string; isSecret: boolean }>()

    for (const [key, rawValue] of Object.entries(variables)) {
      const coerced = coerceVariableValue(key, rawValue, envName, sourceFile)
      if ('skip' in coerced) {
        diagnostics.push(coerced.diagnostic)
        continue
      }
      varMap.set(key, { value: coerced.value, isSecret: isPrivate })
    }

    environments.set(envName, varMap)
  }

  return { environments, diagnostics }
}

function mergeEnvMaps(
  publicEnvs: Map<string, Map<string, { value: string; isSecret: boolean }>>,
  privateEnvs: Map<string, Map<string, { value: string; isSecret: boolean }>>,
): Map<string, Map<string, { value: string; isSecret: boolean }>> {
  const merged = new Map<string, Map<string, { value: string; isSecret: boolean }>>()

  for (const [envName, vars] of publicEnvs) {
    merged.set(envName, new Map(vars))
  }

  for (const [envName, privateVars] of privateEnvs) {
    const existing = merged.get(envName) ?? new Map<string, { value: string; isSecret: boolean }>()
    const next = new Map(existing)

    for (const [key, entry] of privateVars) {
      next.set(key, entry)
    }

    merged.set(envName, next)
  }

  return merged
}

function toParsedEnvironments(
  merged: Map<string, Map<string, { value: string; isSecret: boolean }>>,
  sourceFile: string,
): ParsedEnvironment[] {
  const environments: ParsedEnvironment[] = []

  for (const [name, varMap] of merged) {
    const variables: EnvVariable[] = [...varMap.entries()]
      .map(([key, entry]) => ({
        key,
        value: entry.value,
        isSecret: entry.isSecret,
      }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

    environments.push({ name, sourceFile, variables })
  }

  environments.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  return environments
}

/**
 * Parse JetBrains public + optional private env JSON text.
 * Merge rule (JetBrains): private overrides public for same env name + key.
 * Keys present in (or overridden by) private file → isSecret: true.
 */
export function parseHttpClientEnvironments(input: {
  publicContent?: string
  privateContent?: string
  publicSourceFile?: string
  privateSourceFile?: string
}): ParseEnvironmentsResult {
  const {
    publicContent,
    privateContent,
    publicSourceFile,
    privateSourceFile,
  } = input

  const publicParse = parseJsonFile(publicContent, publicSourceFile)
  const privateParse = parseJsonFile(privateContent, privateSourceFile)

  const diagnostics = [...publicParse.diagnostics, ...privateParse.diagnostics]

  if (publicParse.data === null && privateParse.data === null) {
    if (publicContent !== undefined || privateContent !== undefined) {
      return { environments: [], diagnostics }
    }
    return { environments: [], diagnostics: [] }
  }

  const publicEnvs = publicParse.data
    ? parseEnvMap(publicParse.data, publicSourceFile, false)
    : { environments: new Map(), diagnostics: [] }
  const privateEnvs = privateParse.data
    ? parseEnvMap(privateParse.data, privateSourceFile, true)
    : { environments: new Map(), diagnostics: [] }

  diagnostics.push(...publicEnvs.diagnostics, ...privateEnvs.diagnostics)

  const merged = mergeEnvMaps(publicEnvs.environments, privateEnvs.environments)

  const sourceFile =
    publicSourceFile ??
    privateSourceFile ??
    'http-client.env.json'

  return {
    environments: toParsedEnvironments(merged, sourceFile),
    diagnostics,
  }
}
