import { useQueryClient } from '@tanstack/react-query'
import type { CollectionDetailDtoType } from '@reqor/shared-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCollections } from '../hooks/useCollections.js'
import { useRefreshCollections } from '../hooks/useRefreshCollections.js'
import type { SelectedRequest } from '../types/selection.js'
import { filterCollections } from '../utils/filterCollections.js'
import { CollectionTree } from './CollectionTree.js'
import { CollectionsEmptyState } from './CollectionsEmptyState.js'
import { RefreshCollectionsButton } from './RefreshCollectionsButton.js'
import { SidebarSearch } from './SidebarSearch.js'
import { SidebarSkeleton } from './SidebarSkeleton.js'
import { SidebarTabs, type SidebarTab } from './SidebarTabs.js'

type SidebarShellProps = {
  selectedRequest: SelectedRequest
  onSelectRequest: (selection: NonNullable<SelectedRequest>) => void
  onClearSelection: () => void
}

export function SidebarShell({
  selectedRequest,
  onSelectRequest,
  onClearSelection,
}: SidebarShellProps) {
  const queryClient = useQueryClient()
  const { data, isPending, isError, isRefetchError } = useCollections()
  const refreshMutation = useRefreshCollections()
  const showError = isError || isRefetchError

  const [activeTab, setActiveTab] = useState<SidebarTab>('collections')
  const [collectionsSearch, setCollectionsSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [detailCacheVersion, setDetailCacheVersion] = useState(0)
  const collectionsScrollRef = useRef<HTMLDivElement>(null)
  const historyScrollRef = useRef<HTMLDivElement>(null)
  const collectionsScrollTop = useRef(0)
  const historyScrollTop = useRef(0)

  const collections = data?.collections ?? []

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
      // `success` covers fetch resolves and `setQueryData`; ignore observer-only noise.
      if (event.action.type !== 'success') return
      // Defer — cache updates can fire while child queries are rendering.
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

  const showCollectionsContent = !isPending && !showError

  return (
    <aside
      role="complementary"
      aria-label="Sidebar"
      className="flex h-full w-sidebar-width shrink-0 flex-col border-r border-border bg-surface"
    >
      {isPending ? <SidebarSkeleton /> : null}
      {showError ? (
        <p
          role="alert"
          aria-live="assertive"
          className="px-inset py-inset-sm text-foreground-muted text-body"
        >
          Could not load collections
        </p>
      ) : null}
      {showCollectionsContent ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <SidebarTabs activeTab={activeTab} onTabChange={handleTabChange} />
          {activeTab === 'collections' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-inset-sm p-inset-sm">
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
                {collections.length === 0 ? (
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
            <div
              ref={historyScrollRef}
              className="flex min-h-0 flex-1 flex-col gap-inset-sm overflow-y-auto p-inset-sm"
            >
              <SidebarSearch
                value={historySearch}
                onChange={setHistorySearch}
                placeholder="Filter history…"
              />
              <p className="text-foreground-muted text-body">No sent requests yet.</p>
            </div>
          )}
        </div>
      ) : null}
    </aside>
  )
}
