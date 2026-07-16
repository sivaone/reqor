import type { RequestDtoType } from '@reqor/shared-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCollectionDetail } from '../hooks/useCollectionDetail.js'
import type { SelectedRequest } from '../types/selection.js'
import { SidebarShell } from './SidebarShell.js'
import { WorkspaceShell } from './WorkspaceShell.js'

export function AppLayout() {
  const [selectedRequest, setSelectedRequest] = useState<SelectedRequest>(null)
  const collectionId = selectedRequest?.collectionId
  const {
    data: detail,
    isPending: isDetailPending,
    isError: isDetailError,
  } = useCollectionDetail(collectionId)

  const activeRequest = useMemo((): RequestDtoType | null => {
    if (!selectedRequest || !detail) return null
    const byIndex = detail.requests.find(
      (request) => request.requestIndex === selectedRequest.requestIndex,
    )
    if (byIndex?.fingerprint === selectedRequest.fingerprint) return byIndex
    const byFingerprint = detail.requests.find(
      (request) => request.fingerprint === selectedRequest.fingerprint,
    )
    return byFingerprint ?? null
  }, [selectedRequest, detail])

  useEffect(() => {
    if (!selectedRequest || !detail || detail.id !== selectedRequest.collectionId) return

    const byIndex = detail.requests.find(
      (request) => request.requestIndex === selectedRequest.requestIndex,
    )
    if (byIndex?.fingerprint === selectedRequest.fingerprint) return

    const byFingerprint = detail.requests.find(
      (request) => request.fingerprint === selectedRequest.fingerprint,
    )
    if (byFingerprint) {
      setSelectedRequest({
        collectionId: selectedRequest.collectionId,
        requestIndex: byFingerprint.requestIndex,
        fingerprint: byFingerprint.fingerprint,
      })
      return
    }

    setSelectedRequest(null)
  }, [detail, selectedRequest])

  const handleSelectRequest = useCallback((selection: NonNullable<SelectedRequest>) => {
    setSelectedRequest(selection)
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedRequest(null)
  }, [])

  return (
    <div className="flex min-h-0 flex-1">
      <SidebarShell
        selectedRequest={selectedRequest}
        onSelectRequest={handleSelectRequest}
        onClearSelection={handleClearSelection}
      />
      <WorkspaceShell
        activeRequest={activeRequest}
        isDetailPending={Boolean(selectedRequest) && isDetailPending}
        isDetailError={isDetailError}
      />
    </div>
  )
}
