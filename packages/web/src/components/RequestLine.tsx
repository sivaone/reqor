import type {
  EnvironmentVariableDtoType,
  PreviewResponseType,
} from '@reqor/shared-types'
import type { DraftSendOverrides } from '../types/draftSend.js'
import { getMethodColorClass } from '../utils/methodColorClass.js'
import { EnvironmentVariablesStrip } from './EnvironmentVariablesStrip.js'
import { PreSendPreview } from './PreSendPreview.js'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

type SaveStatus = {
  kind: 'success' | 'warning' | 'error'
  message: string
  successMessage?: string
}

type RequestLineProps = {
  activeEnvironment?: string | null
  environmentVariables?: EnvironmentVariableDtoType[]
  method: string
  url: string
  headers: DraftSendOverrides['headers']
  body: DraftSendOverrides['body']
  onMethodChange: (method: string) => void
  onUrlChange: (url: string) => void
  followRedirects: boolean
  onFollowRedirectsChange: (value: boolean) => void
  onSend: (overrides: DraftSendOverrides) => void
  isSending: boolean
  canSend: boolean
  isDraftDirty?: boolean
  canSave?: boolean
  validationError?: string | null
  onSave?: () => void
  saveStatus?: SaveStatus | null
  savePending?: boolean
  syncPending?: boolean
  preview?: PreviewResponseType | null
  unresolvedError?: string | null
  previewError?: string | null
}

export function RequestLine({
  activeEnvironment,
  environmentVariables = [],
  method,
  url,
  headers,
  body,
  onMethodChange,
  onUrlChange,
  followRedirects,
  onFollowRedirectsChange,
  onSend,
  isSending,
  canSend,
  isDraftDirty = false,
  canSave = false,
  validationError = null,
  onSave,
  saveStatus = null,
  savePending = false,
  syncPending = false,
  preview = null,
  unresolvedError = null,
  previewError = null,
}: RequestLineProps) {
  const showPreview = preview?.hasVariables === true
  const showSave = isDraftDirty
  const saveDisabled = !canSave || savePending || syncPending

  return (
    <div className="flex flex-col gap-inset px-inset py-inset">
      {activeEnvironment ? (
        <p className="text-label text-foreground-muted" aria-live="polite">
          Environment: {activeEnvironment}
        </p>
      ) : null}
      {activeEnvironment && environmentVariables.length > 0 ? (
        <EnvironmentVariablesStrip
          environmentName={activeEnvironment}
          variables={environmentVariables}
        />
      ) : null}
      <div className="flex min-w-0 items-center gap-inset-sm">
        <select
          aria-label="HTTP method"
          value={method}
          onChange={(event) => onMethodChange(event.target.value)}
          className={`rounded-md border border-border bg-background px-inset-sm py-inset-sm text-label text-white ${getMethodColorClass(method)}`}
        >
          {HTTP_METHODS.map((option) => (
            <option key={option} value={option} className="bg-background text-foreground">
              {option}
            </option>
          ))}
        </select>
        <input
          aria-label="Request URL"
          type="text"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-inset-sm py-inset-sm text-mono"
        />
        <button
          type="button"
          onClick={() => onSend({ method, url, headers, body })}
          disabled={!canSend}
          aria-busy={isSending}
          className="inline-flex shrink-0 items-center gap-inset-sm rounded-md bg-primary px-inset py-inset-sm text-body text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {isSending ? (
            <span
              aria-hidden="true"
              className="inline-block size-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent motion-reduce:animate-none"
            />
          ) : null}
          Send
        </button>
        {showSave ? (
          <button
            type="button"
            onClick={() => onSave?.()}
            disabled={saveDisabled}
            aria-disabled={saveDisabled}
            aria-busy={savePending}
            className="inline-flex shrink-0 items-center rounded-md border border-border bg-surface px-inset py-inset-sm text-body text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-60"
          >
            Save
          </button>
        ) : null}
      </div>
      {saveStatus?.successMessage ? (
        <p className="text-body text-foreground" role="status">
          {saveStatus.successMessage}
        </p>
      ) : null}
      {saveStatus ? (
        <p
          className={`text-body ${
            saveStatus.kind === 'error'
              ? 'text-error'
              : saveStatus.kind === 'warning'
                ? 'text-warning'
                : 'text-foreground'
          }`}
          role={saveStatus.kind === 'error' ? 'alert' : 'status'}
        >
          {saveStatus.message}
        </p>
      ) : null}
      {validationError ? (
        <p className="text-body text-error" role="alert">
          {validationError}
        </p>
      ) : null}
      {unresolvedError ? (
        <p className="text-body text-error" role="alert">
          {unresolvedError}
        </p>
      ) : null}
      {previewError ? (
        <p className="text-body text-foreground-muted" role="status">
          {previewError}
        </p>
      ) : null}
      {showPreview && preview ? <PreSendPreview preview={preview} /> : null}
      <label className="inline-flex items-center gap-inset-sm text-body text-foreground">
        <input
          type="checkbox"
          aria-label="Follow redirects"
          checked={followRedirects}
          onChange={(event) => onFollowRedirectsChange(event.target.checked)}
        />
        Follow redirects
      </label>
    </div>
  )
}
