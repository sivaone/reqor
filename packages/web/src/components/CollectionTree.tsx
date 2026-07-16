import { useQueryClient } from '@tanstack/react-query'
import type {
  CollectionDetailDtoType,
  CollectionSummaryDtoType,
} from '@reqor/shared-types'
import { useEffect, useRef, useState } from 'react'
import { useCollectionDetail } from '../hooks/useCollectionDetail.js'
import type { SelectedRequest } from '../types/selection.js'
import type { FilteredCollection } from '../utils/filterCollections.js'
import { MethodBadge } from './MethodBadge.js'

type CollectionTreeProps = {
  items: FilteredCollection[]
  selectedRequest: SelectedRequest
  onSelectRequest: (selection: NonNullable<SelectedRequest>) => void
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
    >
      ▶
    </span>
  )
}

type CollectionFileNodeProps = {
  summary: CollectionSummaryDtoType
  autoExpand: boolean
  isExpanded: boolean
  onToggleExpand: (collectionId: string) => void
  selectedRequest: SelectedRequest
  onSelectRequest: (selection: NonNullable<SelectedRequest>) => void
  registerRow: (key: string, element: HTMLButtonElement | null) => void
  focusedKey: string | null
  onRowFocus: (key: string) => void
}

function CollectionFileNode({
  summary,
  autoExpand,
  isExpanded,
  onToggleExpand,
  selectedRequest,
  onSelectRequest,
  registerRow,
  focusedKey,
  onRowFocus,
}: CollectionFileNodeProps) {
  const needsDetail =
    isExpanded || selectedRequest?.collectionId === summary.id || autoExpand
  const { data: detail } = useCollectionDetail(needsDetail ? summary.id : undefined)

  useEffect(() => {
    if (autoExpand && !isExpanded) {
      onToggleExpand(summary.id)
    }
  }, [autoExpand, isExpanded, onToggleExpand, summary.id])

  const fileKey = `file:${summary.id}`
  const hasParseError = summary.parseStatus === 'error'

  return (
    <>
      <button
        type="button"
        ref={(element) => registerRow(fileKey, element)}
        tabIndex={focusedKey === fileKey ? 0 : -1}
        aria-label={summary.id}
        onFocus={() => onRowFocus(fileKey)}
        onClick={() => onToggleExpand(summary.id)}
        className="flex w-full items-center gap-inset-sm px-inset py-inset-sm text-left text-body hover:bg-surface-muted"
      >
        <ChevronIcon expanded={isExpanded} />
        <span className="min-w-0 flex-1 truncate" title={summary.id}>
          {summary.id}
        </span>
        {hasParseError ? (
          <span className="shrink-0 rounded-sm bg-error px-inset-sm text-label text-white">
            error
          </span>
        ) : null}
      </button>
      {isExpanded ? (
        <CollectionFileChildren
          summary={summary}
          detail={detail}
          selectedRequest={selectedRequest}
          onSelectRequest={onSelectRequest}
          registerRow={registerRow}
          focusedKey={focusedKey}
          onRowFocus={onRowFocus}
        />
      ) : null}
    </>
  )
}

type CollectionFileChildrenProps = {
  summary: CollectionSummaryDtoType
  detail: CollectionDetailDtoType | undefined
  selectedRequest: SelectedRequest
  onSelectRequest: (selection: NonNullable<SelectedRequest>) => void
  registerRow: (key: string, element: HTMLButtonElement | null) => void
  focusedKey: string | null
  onRowFocus: (key: string) => void
}

function CollectionFileChildren({
  summary,
  detail,
  selectedRequest,
  onSelectRequest,
  registerRow,
  focusedKey,
  onRowFocus,
}: CollectionFileChildrenProps) {
  if (summary.parseStatus === 'error') {
    const diagnostics = detail?.diagnostics ?? summary.diagnostics
    return (
      <div className="pl-inset">
        {diagnostics.map((diagnostic) => (
          <p
            key={`diagnostic:${summary.id}:${diagnostic.line}`}
            className="px-inset py-inset-sm text-foreground-muted text-body"
          >
            Line {diagnostic.line}: {diagnostic.message}
          </p>
        ))}
      </div>
    )
  }

  if (!detail) {
    return (
      <p className="px-inset py-inset-sm text-foreground-muted text-body">Loading…</p>
    )
  }

  return (
    <>
      {detail.requests.map((request) => {
        const requestKey = `request:${summary.id}:${request.requestIndex}`
        const isSelected =
          selectedRequest?.collectionId === summary.id &&
          selectedRequest.requestIndex === request.requestIndex

        return (
          <button
            key={requestKey}
            type="button"
            ref={(element) => registerRow(requestKey, element)}
            tabIndex={focusedKey === requestKey ? 0 : -1}
            aria-label={`${request.method} ${request.url}`}
            onFocus={() => onRowFocus(requestKey)}
            onClick={() =>
              onSelectRequest({
                collectionId: summary.id,
                requestIndex: request.requestIndex,
                fingerprint: request.fingerprint,
              })
            }
            className={`flex w-full items-center gap-inset-sm px-inset py-inset-sm text-left hover:bg-surface-muted ${
              isSelected ? 'border-l-2 border-primary bg-surface-muted' : 'pl-inset'
            }`}
          >
            <MethodBadge method={request.method} />
            <span className="min-w-0 flex-1 truncate text-body" title={request.url}>
              {request.url}
            </span>
          </button>
        )
      })}
    </>
  )
}

function parseRequestKey(key: string): { collectionId: string; requestIndex: number } | null {
  if (!key.startsWith('request:')) return null
  const parts = key.slice('request:'.length).split(':')
  if (parts.length < 2) return null
  const requestIndex = Number(parts[parts.length - 1])
  const collectionId = parts.slice(0, -1).join(':')
  if (Number.isNaN(requestIndex)) return null
  return { collectionId, requestIndex }
}

export function CollectionTree({
  items,
  selectedRequest,
  onSelectRequest,
}: CollectionTreeProps) {
  const queryClient = useQueryClient()
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const focusedKeyRef = useRef<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const toggleExpand = (collectionId: string) => {
    setExpandedIds((current) => ({
      ...current,
      [collectionId]: !current[collectionId],
    }))
  }

  const registerRow = (key: string, element: HTMLButtonElement | null) => {
    if (element) {
      rowRefs.current.set(key, element)
    } else {
      rowRefs.current.delete(key)
    }
  }

  const focusRow = (key: string) => {
    focusedKeyRef.current = key
    setFocusedKey(key)
    rowRefs.current.get(key)?.focus()
  }

  const handleRowFocus = (key: string) => {
    focusedKeyRef.current = key
    setFocusedKey(key)
  }

  const getFocusableKeys = (): string[] => {
    const keys: string[] = []
    for (const { summary, autoExpand } of items) {
      const isExpanded = expandedIds[summary.id] ?? autoExpand
      keys.push(`file:${summary.id}`)
      if (isExpanded && summary.parseStatus !== 'error') {
        const detail = queryClient.getQueryData<CollectionDetailDtoType>([
          'collection',
          summary.id,
        ])
        if (detail) {
          for (const request of detail.requests) {
            keys.push(`request:${summary.id}:${request.requestIndex}`)
          }
        } else {
          for (let index = 0; index < summary.requestCount; index += 1) {
            keys.push(`request:${summary.id}:${index}`)
          }
        }
      }
    }
    return keys
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const focusableKeys = getFocusableKeys()
    if (focusableKeys.length === 0) return

    const currentFocused = focusedKeyRef.current
    const currentIndex = currentFocused ? focusableKeys.indexOf(currentFocused) : -1

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex =
        currentIndex < focusableKeys.length - 1 ? currentIndex + 1 : 0
      focusRow(focusableKeys[nextIndex]!)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prevIndex =
        currentIndex > 0 ? currentIndex - 1 : focusableKeys.length - 1
      focusRow(focusableKeys[prevIndex]!)
      return
    }

    if (!currentFocused) return

    if (event.key === 'Enter') {
      event.preventDefault()
      const parsed = parseRequestKey(currentFocused)
      if (parsed) {
        const detail = queryClient.getQueryData<CollectionDetailDtoType>([
          'collection',
          parsed.collectionId,
        ])
        const request = detail?.requests.find(
          (item) => item.requestIndex === parsed.requestIndex,
        )
        if (request) {
          onSelectRequest({
            collectionId: parsed.collectionId,
            requestIndex: request.requestIndex,
            fingerprint: request.fingerprint,
          })
        }
      } else if (currentFocused.startsWith('file:')) {
        toggleExpand(currentFocused.slice('file:'.length))
      }
      return
    }

    if (event.key === 'ArrowRight' && currentFocused.startsWith('file:')) {
      event.preventDefault()
      const collectionId = currentFocused.slice('file:'.length)
      setExpandedIds((current) => ({ ...current, [collectionId]: true }))
      return
    }

    if (event.key === 'ArrowLeft' && currentFocused.startsWith('file:')) {
      event.preventDefault()
      const collectionId = currentFocused.slice('file:'.length)
      setExpandedIds((current) => ({ ...current, [collectionId]: false }))
    }
  }

  useEffect(() => {
    if (focusedKeyRef.current === null && items.length > 0) {
      focusRow(`file:${items[0]!.summary.id}`)
    }
  }, [items])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="tree"
      aria-label="Collections"
      onKeyDown={handleKeyDown}
      onFocus={() => {
        if (focusedKeyRef.current) {
          focusRow(focusedKeyRef.current)
        } else if (items.length > 0) {
          focusRow(`file:${items[0]!.summary.id}`)
        }
      }}
      className="min-h-0 flex-1 overflow-y-auto outline-none"
    >
      {items.map(({ summary, autoExpand }) => (
        <CollectionFileNode
          key={summary.id}
          summary={summary}
          autoExpand={autoExpand}
          isExpanded={expandedIds[summary.id] ?? autoExpand}
          onToggleExpand={toggleExpand}
          selectedRequest={selectedRequest}
          onSelectRequest={onSelectRequest}
          registerRow={registerRow}
          focusedKey={focusedKey}
          onRowFocus={handleRowFocus}
        />
      ))}
    </div>
  )
}
