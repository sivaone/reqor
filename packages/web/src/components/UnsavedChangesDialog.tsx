import { useEffect, useRef } from 'react'

type UnsavedChangesDialogProps = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({ open, onConfirm, onCancel }: UnsavedChangesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
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
      onCancel()
    }

    dialog.addEventListener('cancel', onCancelEvent)
    return () => dialog.removeEventListener('cancel', onCancelEvent)
  }, [onCancel])

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      className="rounded-lg border border-border bg-surface p-inset text-foreground shadow-lg backdrop:bg-black/40"
    >
      <h2 id="unsaved-changes-title" className="text-heading text-foreground">
        Discard unsaved changes?
      </h2>
      <p className="mt-inset-sm text-body text-foreground-muted">
        Your edits have not been saved to disk.
      </p>
      <div className="mt-inset flex justify-end gap-inset-sm">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-background px-inset py-inset-sm text-body"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-primary px-inset py-inset-sm text-body text-primary-foreground"
        >
          Discard
        </button>
      </div>
    </dialog>
  )
}
