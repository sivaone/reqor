import type { DotenvStore } from './dotenv-store.js'
import type { EnvironmentStore } from './environment-store.js'

/**
 * Server-side secret/variable resolver.
 *
 * Merge order for `env` kind: active JetBrains environment → repo `.env` variants.
 * Never expose plaintext dotenv / isSecret values via HTTP APIs.
 */
export class EnvResolver {
  constructor(
    private readonly dotenvStore: DotenvStore,
    private readonly environmentStore: EnvironmentStore,
  ) {}

  /** Resolve a `{{$dotenv KEY}}` reference from merged repo `.env` variants. */
  resolveDotenv(key: string): string | undefined {
    const trimmed = key.trim()
    if (!trimmed) {
      return undefined
    }
    return this.dotenvStore.get(trimmed)
  }

  /**
   * Resolve an `{{name}}` env placeholder: active environment file first, then dotenv fallback.
   * Requires a non-null environment name; returns undefined when missing/absent.
   */
  resolveEnv(
    name: string,
    environmentName: string | null | undefined,
  ): string | undefined {
    if (!environmentName) {
      return undefined
    }

    const environment = this.environmentStore.get(environmentName)
    // Invalid/unknown environment name → treat as no active environment (no dotenv fallback).
    if (!environment) {
      return undefined
    }

    const match = environment.variables.find((variable) => variable.key === name)
    if (match !== undefined) {
      return match.value
    }

    return this.resolveDotenv(name)
  }

  /** Fresh builtin value per call — no active environment required. */
  resolveBuiltin(kind: 'uuid' | 'timestamp' | 'randomInt'): string {
    switch (kind) {
      case 'uuid':
        return crypto.randomUUID()
      case 'timestamp':
        return String(Date.now())
      case 'randomInt':
        return String(Math.floor(Math.random() * 1000))
    }
  }

  /**
   * Plaintext secret values for redaction — server-internal only.
   * Union of all dotenv values + JetBrains `isSecret` plaintext for the named environment.
   * Empty/null environment name → dotenv values only.
   */
  getSecretValuesForRedaction(environmentName?: string | null): string[] {
    const values: string[] = []

    for (const value of this.dotenvStore.getAllValues().values()) {
      if (value.length > 0) {
        values.push(value)
      }
    }

    if (environmentName) {
      const environment = this.environmentStore.get(environmentName)
      if (environment) {
        for (const variable of environment.variables) {
          if (variable.isSecret && variable.value.length > 0) {
            values.push(variable.value)
          }
        }
      }
    }

    return values
  }
}
