import type { DotenvStore } from './dotenv-store.js'

/**
 * Server-side secret/variable resolver.
 *
 * Story 2.4 scope: dotenv-only (`resolveDotenv` from repo `.env` variants).
 * Story 2.5: extend this class for full glossary merge
 * (active `http-client.env.json` → dotenv) — do not invent a second resolver.
 *
 * Never expose plaintext dotenv values via HTTP APIs.
 */
export class EnvResolver {
  constructor(private readonly dotenvStore: DotenvStore) {}

  /** Resolve a `{{$dotenv KEY}}` reference from merged repo `.env` variants. */
  resolveDotenv(key: string): string | undefined {
    const trimmed = key.trim()
    if (!trimmed) {
      return undefined
    }
    return this.dotenvStore.get(trimmed)
  }

  /** Plaintext secret values for redaction — server-internal only (Story 2.5 log/preview wiring). */
  getSecretValuesForRedaction(): string[] {
    const values: string[] = []
    for (const value of this.dotenvStore.getAllValues().values()) {
      if (value.length > 0) {
        values.push(value)
      }
    }
    return values
  }
}
