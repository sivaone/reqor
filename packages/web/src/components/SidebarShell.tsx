import { useQueryClient } from '@tanstack/react-query'
import type {
  CollectionDetailDtoType,
  HistoryEntrySummaryDtoType,
} from '@reqor/shared-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCollections } from '../hooks/useCollections.js'
import { useHistory } from '../hooks/useHistory.js'
import { useRefreshCollections } from '../hooks/useRefreshCollections.js'
import type { SelectedRequest } from '../types/selection.js'
import { filterCollections } from '../utils/filterCollections.js'
import { filterHistory } from '../utils/filterHistory.js'
import { CollectionTree } from './CollectionTree.js'
import { CollectionsEmptyState } from './CollectionsEmptyState.js'
import { HistoryList } from './HistoryList.js'
import { RefreshCollectionsButton } from './RefreshCollectionsButton.js'
import { SidebarSearch } from './SidebarSearch.js'
import { SidebarSkeleton } from './SidebarSkeleton.js'
import { SidebarTabs, type SidebarTab } from './SidebarTabs.js'

type SidebarShellProps = {
  selectedRequest: SelectedRequest
  onSelectRequest: (selection: NonNullable<SelectedRequest>) => void
  onClearSelection: () => void
  selectedHistoryId: number | null
  onReplayHistory: (entry: HistoryEntrySummaryDtoType) => void
}

export function SidebarShell({
  selectedRequest,
  onSelectRequest,
  onClearSelection,
  selectedHistoryId,
  onReplayHistory,
}: SidebarShellProps) {
  const queryClient = useQueryClient()
  const { data, isPending, isError, isRefetchError } = useCollections()
  const {
    data: historyData,
    isPending: isHistoryPending,
    isError: isHistoryError,
  } = useHistory()
  const refreshMutation = useRefreshCollections()
  const showCollectionsError = isError || isRefetchError

  const [activeTab, setActiveTab] = useState<SidebarTab>('collections')
  const [collectionsSearch, setCollectionsSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [detailCacheVersion, setDetailCacheVersion] = useState(0)
  const collectionsScrollRef = useRef<HTMLDivElement>(null)
  const historyScrollRef = useRef<HTMLDivElement>(null)
  const collectionsScrollTop = useRef(0)
  const historyScrollTop = useRef(0)

  const collections = data?.collections ?? []
  const historyEntries = historyData?.entries ?? []

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (!event || event.query.queryKey[0] !== 'collection') return
      if (event.type === 'removed') {
        queueMicrotask(() => {
          setDetailCacheVersion((version) => version + 1)
        })
        return
      }
      if (event.type !== 'updated') return
      if (event.action.type !== 'success') return
      queueMicrotask(() => {
        setDetailCacheVersion((version) => version + 1)
      })
    })
  }, [queryClient])

  const detailById = useMemo(() => {
    const map: Record<string, CollectionDetailDtoType> = {}
    for (const summary of collections) {
      const cached = queryClient.getQueryData<CollectionDetailDtoType>([
        'collection',
        summary.id,
      ])
      if (cached) {
        map[summary.id] = cached
      }
    }
    return map
  }, [collections, queryClient, data, detailCacheVersion])

  const filteredItems = useMemo(
    () => filterCollections(collections, detailById, collectionsSearch),
    [collections, detailById, collectionsSearch],
  )

  const filteredHistoryEntries = useMemo(
    () => filterHistory(historyEntries, historySearch),
    [historyEntries, historySearch],
  )

  useEffect(() => {
    if (!selectedRequest) return
    const stillExists = collections.some(
      (summary) => summary.id === selectedRequest.collectionId,
    )
    if (!stillExists) {
      onClearSelection()
    }
  }, [collections, selectedRequest, onClearSelection])

  const handleRefresh = () => {
    refreshMutation.mutate({})
  }

  const handleTabChange = (tab: SidebarTab) => {
    if (tab === activeTab) return
    if (activeTab === 'collections' && collectionsScrollRef.current) {
      collectionsScrollTop.current = collectionsScrollRef.current.scrollTop
    }
    if (activeTab === 'history' && historyScrollRef.current) {
      historyScrollTop.current = historyScrollRef.current.scrollTop
    }
    setActiveTab(tab)
    requestAnimationFrame(() => {
      if (tab === 'collections' && collectionsScrollRef.current) {
        collectionsScrollRef.current.scrollTop = collectionsScrollTop.current
      }
      if (tab === 'history' && historyScrollRef.current) {
        historyScrollRef.current.scrollTop = historyScrollTop.current
      }
    })
  }

  const showInitialSkeleton = isPending && !data

  return (
    <aside
      role="complementary"
      aria-label="Sidebar"
      className="flex h-full w-sidebar-width shrink-0 flex-col border-r border-border bg-surface"
    >
      {showInitialSkeleton ? <SidebarSkeleton /> : null}
      {!showInitialSkeleton ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <SidebarTabs activeTab={activeTab} onTabChange={handleTabChange} />
          {activeTab === 'collections' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-inset-sm p-inset-sm">
              {showCollectionsError ? (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-foreground-muted text-body"
                >
                  Could not load collections
                </p>
              ) : null}
              <div className="flex flex-col gap-inset-sm">
                <SidebarSearch
                  value={collectionsSearch}
                  onChange={setCollectionsSearch}
                  placeholder="Filter collections…"
                />
                <RefreshCollectionsButton
                  onRefresh={handleRefresh}
                  isPending={refreshMutation.isPending}
                  error={refreshMutation.error}
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {showCollectionsError ? null : isPending ? (
                  <p className="px-inset py-inset-sm text-foreground-muted text-body">
                    Loading collections…
                  </p>
                ) : collections.length === 0 ? (
                  <CollectionsEmptyState
                    onRefresh={handleRefresh}
                    isRefreshing={refreshMutation.isPending}
                  />
                ) : filteredItems.length === 0 ? (
                  <p className="px-inset py-inset-sm text-foreground-muted text-body">
                    No matching collections
                  </p>
                ) : (
                  <CollectionTree
                    items={filteredItems}
                    selectedRequest={selectedRequest}
                    onSelectRequest={onSelectRequest}
                    scrollContainerRef={collectionsScrollRef}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-inset-sm p-inset-sm">
              <SidebarSearch
                value={historySearch}
                onChange={setHistorySearch}
                placeholder="Filter history…"
              />
              <HistoryList
                filteredEntries={filteredHistoryEntries}
                selectedHistoryId={selectedHistoryId}
                onReplay={onReplayHistory}
                scrollContainerRef={historyScrollRef}
                isLoading={isHistoryPending}
                isError={isHistoryError}
                emptyMessage={
                  historyEntries.length === 0 && !isHistoryPending && !isHistoryError
                    ? 'No sent requests yet.'
                    : historyEntries.length > 0 && filteredHistoryEntries.length === 0
                      ? 'No matching history'
                      : null
                }
              />
            </div>
          )}
        </div>
      ) : null}
    </aside>
  )
}
