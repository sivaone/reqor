import type { HistoryEntrySummaryDtoType } from '@reqor/shared-types'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { statusTone } from '../utils/formatResponseBody.js'
import { formatHistoryTimestamp } from '../utils/formatHistoryTimestamp.js'
import { MethodBadge } from './MethodBadge.js'

type HistoryListProps = {
  entries: HistoryEntrySummaryDtoType[]
  filteredEntries: HistoryEntrySummaryDtoType[]
  selectedHistoryId: number | null
  onReplay: (entry: HistoryEntrySummaryDtoType) => void
  scrollContainerRef?: MutableRefObject<HTMLDivElement | null>
  isLoading: boolean
  isError: boolean
}

function statusClass(statusCode: number): string {
  const tone = statusTone(statusCode)
  if (tone === 'success') return 'text-success'
  if (tone === 'error') return 'text-error'
  return 'text-foreground-muted'
}

export function HistoryList({
  filteredEntries,
  selectedHistoryId,
  onReplay,
  scrollContainerRef,
  isLoading,
  isError,
}: HistoryListProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const focusedIndexRef = useRef(0)
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const setContainerRef = (element: HTMLDivElement | null) => {
    if (scrollContainerRef) {
      scrollContainerRef.current = element
    }
  }

  const registerRow = (id: number, element: HTMLButtonElement | null) => {
    if (element) {
      rowRefs.current.set(id, element)
    } else {
      rowRefs.current.delete(id)
    }
  }

  const focusRow = (index: number) => {
    if (filteredEntries.length === 0) return
    const clamped = ((index % filteredEntries.length) + filteredEntries.length) % filteredEntries.length
    focusedIndexRef.current = clamped
    setFocusedIndex(clamped)
    const entry = filteredEntries[clamped]
    if (entry) {
      rowRefs.current.get(entry.id)?.focus()
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (filteredEntries.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusRow(focusedIndexRef.current + 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusRow(focusedIndexRef.current - 1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const entry = filteredEntries[focusedIndexRef.current]
      if (entry) {
        onReplay(entry)
      }
    }
  }

  useEffect(() => {
    if (filteredEntries.length === 0) {
      focusedIndexRef.current = 0
      setFocusedIndex(0)
      return
    }
    if (focusedIndexRef.current >= filteredEntries.length) {
      focusRow(filteredEntries.length - 1)
    }
  }, [filteredEntries])

  if (isLoading) {
    return (
      <p className="px-inset py-inset-sm text-foreground-muted text-body">Loading history…</p>
    )
  }

  if (isError) {
    return (
      <p role="alert" className="px-inset py-inset-sm text-error text-body">
        Could not load history
      </p>
    )
  }

  if (filteredEntries.length === 0) {
    return null
  }

  return (
    <div
      ref={setContainerRef}
      role="listbox"
      aria-label="History"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="min-h-0 flex-1 overflow-y-auto outline-none"
    >
      {filteredEntries.map((entry, index) => {
        const isSelected = selectedHistoryId === entry.id
        const isFocused = index === focusedIndex
        return (
          <button
            key={entry.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            ref={(element) => registerRow(entry.id, element)}
            tabIndex={isFocused ? 0 : -1}
            onFocus={() => {
              focusedIndexRef.current = index
              setFocusedIndex(index)
            }}
            onClick={() => onReplay(entry)}
            className={`flex w-full flex-col gap-inset-sm px-inset py-inset-sm text-left hover:bg-surface-muted ${
              isSelected ? 'bg-surface-muted' : ''
            }`}
          >
            <div className="flex min-w-0 items-center gap-inset-sm">
              <MethodBadge method={entry.method} />
              <span className="min-w-0 flex-1 truncate font-mono text-body" title={entry.url}>
                {entry.url}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-inset gap-y-inset-sm text-label text-foreground-muted">
              <span>{formatHistoryTimestamp(entry.sentAt)}</span>
              <span className={statusClass(entry.statusCode)}>{entry.statusCode}</span>
              <span>{Math.round(entry.durationMs)} ms</span>
              <span>{entry.environmentName ?? '—'}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
