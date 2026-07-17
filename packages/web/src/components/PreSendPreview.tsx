import { SECRET_MASK, type PreviewResponseType } from '@reqor/shared-types'
import { SecretField } from './SecretField.js'

type PreSendPreviewProps = {
  preview: PreviewResponseType
}

function isSecretMasked(value: string): boolean {
  return value === SECRET_MASK || value.includes(SECRET_MASK)
}

/**
 * Inline collapsible pre-send preview (UX-DR20).
 * Render only when `preview.hasVariables === true` (caller gate).
 */
export function PreSendPreview({ preview }: PreSendPreviewProps) {
  return (
    <details className="rounded-md border border-border-subtle bg-surface-muted px-inset-sm py-inset-sm">
      <summary className="cursor-pointer text-label text-foreground-muted">
        Preview resolved request
      </summary>
      <div className="mt-inset-sm grid gap-inset-sm text-body">
        <div>
          <p className="text-label text-foreground-muted">URL</p>
          <p className="break-all font-mono">
            {isSecretMasked(preview.url) ? (
              <SecretField value={preview.url} />
            ) : (
              <span className="text-foreground">{preview.url}</span>
            )}
          </p>
        </div>
        {preview.headers.length > 0 ? (
          <div>
            <p className="mb-inset-sm text-label text-foreground-muted">Headers</p>
            <dl className="grid gap-inset-sm">
              {preview.headers.map((header, index) => (
                <div
                  key={`${header.name}-${index}`}
                  className="grid grid-cols-[minmax(0,8rem)_1fr] gap-inset-sm"
                >
                  <dt className="truncate font-mono text-foreground-muted">{header.name}</dt>
                  <dd className="min-w-0 break-all font-mono">
                    {isSecretMasked(header.value) ? (
                      <SecretField value={header.value} />
                    ) : (
                      <span className="text-foreground">{header.value}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </details>
  )
}
