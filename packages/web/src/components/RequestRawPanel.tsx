import type { DiagnosticDtoType } from '@reqor/shared-types'
import { highlightHttpHtml } from '../utils/highlightHttp.js'
import { formatParseDiagnostic } from '../utils/syncOnTabSwitch.js'

type RequestRawPanelProps = {
  content: string
  onContentChange: (content: string) => void
  onBlur?: () => void
  diagnostics?: DiagnosticDtoType[]
  syncPending?: boolean
}

export function RequestRawPanel({
  content,
  onContentChange,
  onBlur,
  diagnostics = [],
  syncPending = false,
}: RequestRawPanelProps) {
  const highlighted = highlightHttpHtml(content)
  const firstError = diagnostics[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col px-inset py-inset-sm">
      <div className="relative min-h-[12rem] flex-1 overflow-hidden rounded-sm border border-border bg-surface">
        <pre
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-inset-sm text-mono text-[13px] leading-5"
          dangerouslySetInnerHTML={{ __html: highlighted || ' ' }}
        />
        <textarea
          aria-label="Raw HTTP file"
          className="absolute inset-0 z-10 h-full w-full resize-none overflow-auto bg-transparent p-inset-sm text-mono text-[13px] leading-5 text-transparent caret-foreground outline-none"
          value={content}
          spellCheck={false}
          onChange={(event) => onContentChange(event.target.value)}
          onBlur={onBlur}
        />
      </div>
      {syncPending ? (
        <p className="mt-inset-sm text-caption text-foreground-muted">Syncing…</p>
      ) : null}
      {firstError ? (
        <p role="alert" className="mt-inset-sm text-body text-error">
          {formatParseDiagnostic(firstError)}
        </p>
      ) : null}
    </div>
  )
}
