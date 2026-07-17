import { useEffect, useId, useState } from 'react'
import { useEnvironments } from '../hooks/useEnvironments.js'

export function AppHeader() {
  const { data, isLoading, isError } = useEnvironments()
  const environments = data?.environments
  const selectId = useId()
  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    if (!environments || environments.length === 0) {
      setSelectedName('')
      return
    }

    setSelectedName((current) => {
      if (current && environments.some((env) => env.name === current)) {
        return current
      }
      return environments[0]?.name ?? ''
    })
  }, [environments])

  const isEmpty = !isLoading && !isError && (environments?.length ?? 0) === 0
  const hasEnvironments = !isLoading && !isError && (environments?.length ?? 0) > 0
  const selectValue = hasEnvironments
    ? selectedName || environments?.[0]?.name || ''
    : ''

  return (
    <header
      role="banner"
      className="flex h-header-height shrink-0 items-center justify-between bg-header-background px-inset text-header-foreground"
    >
      <h1 className="text-app-title">Reqor</h1>
      <div className="ml-auto">
        <label htmlFor={selectId} className="sr-only">
          Environment
        </label>
        <select
          id={selectId}
          className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          disabled={isLoading || isEmpty || isError}
          value={selectValue}
          onChange={(event) => setSelectedName(event.target.value)}
        >
          {isLoading ? (
            <option value="">Loading…</option>
          ) : isError ? (
            <option value="">Failed to load environments</option>
          ) : isEmpty ? (
            <option value="">No environments</option>
          ) : (
            environments?.map((environment) => (
              <option key={environment.name} value={environment.name}>
                {environment.name}
              </option>
            ))
          )}
        </select>
      </div>
    </header>
  )
}
