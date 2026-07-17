import { SECRET_MASK } from '@reqor/shared-types'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replace known secret substrings with the standard mask. Longest values first to avoid partial leaks.
 *
 * Story 2.4: unit-tested scaffold for NFR6. Wire into Pino / preview / execute paths in Story 2.5.
 */
export function redactSecrets(text: string, secrets: readonly string[]): string {
  if (!text || secrets.length === 0) {
    return text
  }

  const unique = [...new Set(secrets.filter((secret) => secret.length > 0))].sort(
    (a, b) => b.length - a.length,
  )

  let result = text
  for (const secret of unique) {
    result = result.replace(new RegExp(escapeRegExp(secret), 'g'), SECRET_MASK)
  }
  return result
}

/** Deep-redact string values in a plain object for safe logging/serialization. */
export function redactObject<T extends Record<string, unknown>>(
  value: T,
  secrets: readonly string[],
): T {
  if (secrets.length === 0) {
    return value
  }

  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      result[key] = redactSecrets(entry, secrets)
    } else if (Array.isArray(entry)) {
      result[key] = entry.map((item) =>
        typeof item === 'string' ? redactSecrets(item, secrets) : item,
      )
    } else if (entry && typeof entry === 'object') {
      result[key] = redactObject(entry as Record<string, unknown>, secrets)
    } else {
      result[key] = entry
    }
  }
  return result as T
}
