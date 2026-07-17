import { useId } from 'react'
import { useEnvironments } from '../hooks/useEnvironments.js'
import { ConfigUpdateError, useConfig, useUpdateConfig } from '../hooks/useConfig.js'

/** Sentinel select value for a persisted env missing from the list (not a real env name). */
const UNAVAILABLE_SENTINEL = '__reqor_unavailable__'

export function AppHeader() {
  const { data: envData, isLoading: envLoading, isError: envError } = useEnvironments()
  const { data: config, isLoading: configLoading, isError: configError } = useConfig()
  const updateConfig = useUpdateConfig()

  const environments = envData?.environments
  const selectId = useId()

  const isEmpty = !envLoading && !envError && (environments?.length ?? 0) === 0
  const hasEnvironments = !envLoading && !envError && (environments?.length ?? 0) > 0

  const persistedName = config?.activeEnvironment ?? null
  const nameInList =
    persistedName !== null &&
    environments?.some((environment) => environment.name === persistedName)

  const selectValue = (() => {
    if (!hasEnvironments || configLoading) return ''
    if (persistedName === null) return ''
    if (nameInList) return persistedName
    return UNAVAILABLE_SENTINEL
  })()

  const isSelectDisabled =
    envLoading ||
    configLoading ||
    isEmpty ||
    envError ||
    configError ||
    updateConfig.isPending

  const handleChange = (value: string) => {
    if (value === UNAVAILABLE_SENTINEL) return
    updateConfig.mutate({ activeEnvironment: value || null })
  }

  return (
    <header
      role="banner"
      className="flex min-h-header-height shrink-0 items-center justify-between bg-header-background px-inset py-inset-sm text-header-foreground"
    >
      <h1 className="text-app-title">Reqor</h1>
      <div className="ml-auto flex flex-col items-end gap-1">
        <label htmlFor={selectId} className="sr-only">
          Environment
        </label>
        <select
          id={selectId}
          className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          disabled={isSelectDisabled}
          value={selectValue}
          onChange={(event) => handleChange(event.target.value)}
        >
          {envLoading || configLoading ? (
            <option value="">Loading…</option>
          ) : envError ? (
            <option value="">Failed to load environments</option>
          ) : configError ? (
            <option value="">Failed to load config</option>
          ) : isEmpty ? (
            <option value="">No environments</option>
          ) : (
            <>
              <option value="">Select environment…</option>
              {persistedName !== null && !nameInList ? (
                <option value={UNAVAILABLE_SENTINEL} disabled>
                  Environment unavailable
                </option>
              ) : null}
              {environments?.map((environment) => (
                <option key={environment.name} value={environment.name}>
                  {environment.name}
                </option>
              ))}
            </>
          )}
        </select>
        {updateConfig.isError ? (
          <p className="text-xs text-destructive" role="alert">
            {updateConfig.error instanceof ConfigUpdateError
              ? updateConfig.error.message
              : 'Failed to update environment'}
          </p>
        ) : null}
      </div>
    </header>
  )
}
