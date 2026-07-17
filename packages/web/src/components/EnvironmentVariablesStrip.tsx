import type { EnvironmentVariableDtoType } from '@reqor/shared-types'
import { SecretField } from './SecretField.js'

type EnvironmentVariablesStripProps = {
  environmentName: string
  /** JetBrains env-file DTOs from `GET /api/environments` — not repo dotenv keys. */
  variables: EnvironmentVariableDtoType[]
}

/**
 * Active-environment variable strip (UX-DR14).
 * Shows JetBrains `http-client.env.json` variables only — never repo `.env` / dotenv values.
 */
export function EnvironmentVariablesStrip({
  environmentName,
  variables,
}: EnvironmentVariablesStripProps) {
  if (variables.length === 0) {
    return null
  }

  return (
    <div
      className="rounded-md border border-border-subtle bg-surface-muted px-inset-sm py-inset-sm"
      aria-label={`Environment variables for ${environmentName}`}
    >
      <p className="mb-inset-sm text-label text-foreground-muted">Variables</p>
      <dl className="grid gap-inset-sm">
        {variables.map((variable, index) => (
          <div
            key={`${variable.key}-${index}`}
            className="grid grid-cols-[minmax(0,8rem)_1fr] gap-inset-sm text-body"
          >
            <dt className="truncate font-mono text-foreground-muted">{variable.key}</dt>
            <dd className="min-w-0 truncate font-mono">
              {variable.isSecret !== false ? (
                <SecretField value={variable.value} />
              ) : (
                <span className="text-foreground">{variable.value || '—'}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
