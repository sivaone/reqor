import type { SnippetLanguageType } from '@reqor/shared-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ExportSnippetError } from '../hooks/useExportSnippet.js'
import { copyToClipboard, CopyToClipboardError } from '../utils/copyToClipboard.js'

const SNIPPET_TABS: Array<{ id: SnippetLanguageType; label: string }> = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'curl', label: 'cURL' },
]

type SnippetExportPopoverProps = {
  open: boolean
  onClose: () => void
  sessionGeneration: number
  onFetchSnippet: (language: SnippetLanguageType) => Promise<string>
}

export function SnippetExportPopover({
  open,
  onClose,
  sessionGeneration,
  onFetchSnippet,
}: SnippetExportPopoverProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const tabGenerationRef = useRef(0)
  const onFetchSnippetRef = useRef(onFetchSnippet)
  onFetchSnippetRef.current = onFetchSnippet
  const [activeTab, setActiveTab] = useState<SnippetLanguageType>('javascript')
  const [snippets, setSnippets] = useState<Partial<Record<SnippetLanguageType, string>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<{
    kind: 'success' | 'error'
    message: string
  } | null>(null)

  const handleClose = useCallback(() => {
    tabGenerationRef.current += 1
    onClose()
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      setActiveTab('javascript')
      setSnippets({})
      setError(null)
      setCopyStatus(null)
      tabGenerationRef.current += 1
    }
    if (!open && dialog.open) {
      tabGenerationRef.current += 1
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

  useEffect(() => {
    if (!open) return

    const tabGeneration = ++tabGenerationRef.current
    const session = sessionGeneration
    let cancelled = false

    setLoading(true)
    setError(null)
    setCopyStatus(null)
    setSnippets((current) => {
      const next = { ...current }
      delete next[activeTab]
      return next
    })

    void onFetchSnippetRef.current(activeTab)
      .then((snippet) => {
        if (cancelled || session !== sessionGeneration || tabGeneration !== tabGenerationRef.current) {
          return
        }
        setSnippets((current) => ({ ...current, [activeTab]: snippet }))
      })
      .catch((err: unknown) => {
        if (cancelled || session !== sessionGeneration || tabGeneration !== tabGenerationRef.current) {
          return
        }
        if (err instanceof ExportSnippetError && err.code === 'STALE') {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to export snippet'
        setError(message)
        setSnippets((current) => {
          const next = { ...current }
          delete next[activeTab]
          return next
        })
      })
      .finally(() => {
        if (!cancelled && session === sessionGeneration && tabGeneration === tabGenerationRef.current) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, open, sessionGeneration])

  const handleTabChange = (language: SnippetLanguageType) => {
    if (language === activeTab) return
    tabGenerationRef.current += 1
    setActiveTab(language)
    setCopyStatus(null)
  }

  const handleCopy = async () => {
    const snippet = snippets[activeTab]
    if (!snippet) return

    const tabGeneration = tabGenerationRef.current
    const session = sessionGeneration
    setCopyStatus(null)

    try {
      await copyToClipboard(snippet)
      if (session !== sessionGeneration || tabGeneration !== tabGenerationRef.current) {
        return
      }
      setCopyStatus({ kind: 'success', message: 'Snippet copied to clipboard' })
    } catch (err) {
      if (session !== sessionGeneration || tabGeneration !== tabGenerationRef.current) {
        return
      }
      const message =
        err instanceof CopyToClipboardError ? err.message : 'Failed to copy snippet'
      setCopyStatus({ kind: 'error', message })
    }
  }

  const activeSnippet = snippets[activeTab] ?? ''

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="snippet-export-title"
      className="w-full max-w-2xl rounded-lg border border-border bg-surface p-inset text-foreground backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-inset">
        <h2 id="snippet-export-title" className="text-heading text-foreground">
          Export code snippet
        </h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close snippet export"
          className="rounded-md border border-border bg-background px-inset-sm py-inset-sm text-body"
        >
          Close
        </button>
      </div>

      <div role="tablist" aria-label="Snippet language" className="mt-inset flex gap-inset-sm">
        {SNIPPET_TABS.map((tab) => {
          const selected = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`snippet-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`snippet-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => handleTabChange(tab.id)}
              className={`rounded-md border px-inset py-inset-sm text-body ${
                selected
                  ? 'border-primary bg-background text-foreground'
                  : 'border-border bg-surface text-foreground-muted'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {SNIPPET_TABS.map((tab) => {
        const selected = tab.id === activeTab
        const tabSnippet = snippets[tab.id] ?? ''
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`snippet-panel-${tab.id}`}
            aria-labelledby={`snippet-tab-${tab.id}`}
            hidden={!selected}
            className="mt-inset"
          >
            {selected && error ? (
              <p className="text-body text-error" role="alert">
                {error}
              </p>
            ) : null}
            <pre
              aria-label="Exported code snippet"
              aria-busy={selected && loading}
              className="max-h-80 overflow-auto rounded-md border border-border bg-background p-inset-sm font-mono text-[13px] whitespace-pre-wrap"
            >
              {selected && loading ? 'Generating snippet…' : tabSnippet}
            </pre>
          </div>
        )
      })}

      <div className="mt-inset flex items-center justify-end gap-inset-sm">
        {copyStatus ? (
          <p
            className={`mr-auto text-body ${copyStatus.kind === 'error' ? 'text-error' : 'text-foreground'}`}
            role={copyStatus.kind === 'error' ? 'alert' : 'status'}
          >
            {copyStatus.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={loading || !activeSnippet || Boolean(error)}
          aria-label={`Copy ${activeTab} snippet`}
          className="rounded-md bg-primary px-inset py-inset-sm text-body text-primary-foreground disabled:opacity-60"
        >
          Copy
        </button>
      </div>
    </dialog>
  )
}
