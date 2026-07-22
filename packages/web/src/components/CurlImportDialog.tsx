import type { ImportCurlResponseType } from '@reqor/shared-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ImportCurlError, useImportCurl } from '../hooks/useImportCurl.js'

type CurlImportDialogProps = {
  open: boolean
  onClose: () => void
  onImported: (result: ImportCurlResponseType) => void
}

export function CurlImportDialog({ open, onClose, onImported }: CurlImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const importGenerationRef = useRef(0)
  const [curlText, setCurlText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const importMutation = useImportCurl()

  const handleClose = useCallback(() => {
    importGenerationRef.current += 1
    onClose()
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      setCurlText('')
      setError(null)
      setImportWarnings([])
      queueMicrotask(() => textareaRef.current?.focus())
    }
    if (!open && dialog.open) {
      importGenerationRef.current += 1
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onCancelEvent = (event: Event) => {
      event.preventDefault()
      handleClose()
    }

    dialog.addEventListener('cancel', onCancelEvent)
    return () => dialog.removeEventListener('cancel', onCancelEvent)
  }, [handleClose])

  const handleImport = async () => {
    setError(null)
    setImportWarnings([])
    const generation = importGenerationRef.current
    try {
      const result = await importMutation.mutateAsync({ curl: curlText })
      if (generation !== importGenerationRef.current) {
        return
      }
      onImported(result)
      if (result.warnings.length > 0) {
        setImportWarnings(result.warnings)
        return
      }
      onClose()
    } catch (err) {
      if (generation !== importGenerationRef.current) {
        return
      }
      const message =
        err instanceof ImportCurlError ? err.message : 'Failed to import cURL command'
      setError(message)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="curl-import-title"
      className="w-full max-w-xl rounded-lg border border-border bg-surface p-inset text-foreground backdrop:bg-black/40"
    >
      <h2 id="curl-import-title" className="text-heading text-foreground">
        Import cURL
      </h2>
      <p className="mt-inset-sm text-body text-foreground-muted">
        Paste a cURL command from API documentation. Supported flags: -X, -H, -d, --data-raw,
        --json, -u.
      </p>
      <textarea
        ref={textareaRef}
        aria-label="cURL command"
        value={curlText}
        onChange={(event) => setCurlText(event.target.value)}
        rows={8}
        className="mt-inset w-full rounded-md border border-border bg-background px-inset-sm py-inset-sm font-mono text-body"
        placeholder="curl -X POST https://api.example.com ..."
      />
      {error ? (
        <p className="mt-inset-sm text-body text-error" role="alert">
          {error}
        </p>
      ) : null}
      {importWarnings.length > 0 ? (
        <ul className="mt-inset-sm text-body text-warning" role="status">
          {importWarnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-inset flex justify-end gap-inset-sm">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md border border-border bg-background px-inset py-inset-sm text-body"
        >
          {importWarnings.length > 0 ? 'Close' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={!curlText.trim() || importMutation.isPending}
          aria-busy={importMutation.isPending}
          className="rounded-md bg-primary px-inset py-inset-sm text-body text-primary-foreground disabled:opacity-60"
        >
          Import
        </button>
      </div>
    </dialog>
  )
}
