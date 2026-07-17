import type { ConfigStore } from './config-store.js'
import type { EnvironmentStore } from './environment-store.js'

/** Resolve active environment from request body override or config; null when none/invalid. */
export function resolveEnvironmentName(
  requested: string | null | undefined,
  configStore: ConfigStore,
  environmentStore: EnvironmentStore,
): string | null {
  const candidate =
    requested !== undefined ? requested : configStore.get().activeEnvironment
  if (!candidate) return null
  return environmentStore.get(candidate) ? candidate : null
}
