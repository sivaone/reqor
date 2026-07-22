import type { ImportCurlResponseType } from '@reqor/shared-types'
import { useEffect, useRef, useState } from 'react'
import { ImportCurlError, useImportCurl } from '../hooks/useImportCurl.js'

type CurlImportDialogProps = {
  open: boolean
  onClose: () => void
  onImported: (result: ImportCurlResponseType) => void
}

export function CurlImportDialog({ open, onClose, onImported }: CurlImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [curlText, setCurlText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const importMutation = useImportCurl()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      setCurlText('')
      setError(null)
      queueMicrotask(() => textareaRef.current?.focus())
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onCancelEvent = (event: Event) => {
      event.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', onCancelEvent)
    return () => dialog.removeEventListener('cancel', onCancelEvent)
  }, [onClose])

  const handleImport = async () => {
    setError(null)
    try {
      const result = await importMutation.mutateAsync({ curl: curlText })
      onImported(result)
      onClose()
    } catch (err) {
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
      <div className="mt-inset flex justify-end gap-inset-sm">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-background px-inset py-inset-sm text-body"
        >
          Cancel
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
