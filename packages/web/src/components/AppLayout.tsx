import type {
  ExecuteResponseType,
  PreviewResponseType,
  RequestDtoType,
  RequestHeaderDtoType,
} from '@reqor/shared-types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollectionDetail } from '../hooks/useCollectionDetail.js'
import { useConfig } from '../hooks/useConfig.js'
import { useEnvironments } from '../hooks/useEnvironments.js'
import { useExecuteRequest, ExecuteRequestError } from '../hooks/useExecuteRequest.js'
import { usePreviewRequest } from '../hooks/usePreviewRequest.js'
import { useRequestDraft } from '../hooks/useRequestDraft.js'
import type { DraftSendOverrides } from '../types/draftSend.js'
import type { SelectedRequest } from '../types/selection.js'
import { deriveCanSend } from '../utils/deriveCanSend.js'
import { SidebarShell } from './SidebarShell.js'
import { WorkspaceShell } from './WorkspaceShell.js'

const EMPTY_HEADERS: RequestHeaderDtoType[] = []

export function AppLayout() {
  const [selectedRequest, setSelectedRequest] = useState<SelectedRequest>(null)
  const [followRedirects, setFollowRedirects] = useState(true)
  const [executeResult, setExecuteResult] = useState<ExecuteResponseType | null>(null)
  const [executeError, setExecuteError] = useState<{ code?: string; message: string } | null>(
    null,
  )

  const collectionId = selectedRequest?.collectionId
  const {
    data: detail,
    isPending: isDetailPending,
    isError: isDetailError,
  } = useCollectionDetail(collectionId)

  const executeMutation = useExecuteRequest()

  const { data: config } = useConfig()
  const { data: envData } = useEnvironments()

  const activeEnvironment = useMemo((): string | null => {
    const name = config?.activeEnvironment
    if (!name) return null
    const exists = envData?.environments?.some((environment) => environment.name === name)
    return exists ? name : null
  }, [config?.activeEnvironment, envData?.environments])

  // JetBrains env-file vars (already redacted by API) — not repo dotenv.
  const activeEnvironmentVariables = useMemo(() => {
    if (!activeEnvironment || !envData?.environments) return []
    return (
      envData.environments.find((environment) => environment.name === activeEnvironment)
        ?.variables ?? []
    )
  }, [activeEnvironment, envData?.environments])

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

  const selectionIdentity = selectedRequest
    ? `${selectedRequest.collectionId}:${selectedRequest.requestIndex}:${selectedRequest.fingerprint}`
    : null
  const selectionIdentityRef = useRef(selectionIdentity)
  selectionIdentityRef.current = selectionIdentity
  const lastPreviewRef = useRef<PreviewResponseType | null>(null)

  const {
    draft,
    isDirty,
    validation,
    canSave,
    setMethod,
    setUrl,
    setHeaders,
    setBody,
    addBody,
    clearBody,
  } = useRequestDraft(activeRequest, selectionIdentity)

  const draftMethod = draft?.method ?? 'GET'
  const draftUrl = draft?.url ?? ''
  const draftHeaders = draft?.headers ?? EMPTY_HEADERS
  const draftBody = draft?.body ?? null

  const previewQuery = usePreviewRequest({
    collectionId: selectedRequest?.collectionId ?? null,
    requestIndex: selectedRequest?.requestIndex ?? null,
    environment: activeEnvironment,
    method: draftMethod,
    url: draftUrl,
    headers: draftHeaders,
    body: draftBody,
    enabled: Boolean(activeRequest && draft),
    selectionIdentity,
  })

  useEffect(() => {
    lastPreviewRef.current = null
  }, [selectionIdentity])

  useEffect(() => {
    if (previewQuery.data) {
      lastPreviewRef.current = previewQuery.data
    }
  }, [previewQuery.data])

  const previewData =
    previewQuery.data ?? (previewQuery.isError ? lastPreviewRef.current : null)

  const canSend = deriveCanSend({
    isSending: executeMutation.isPending,
    hasActiveRequest: Boolean(activeRequest),
    previewPending: previewQuery.isPending,
    previewFetching: previewQuery.isFetching,
    hasVariables: previewData?.hasVariables,
    unresolved: previewData?.unresolved,
  })

  const unresolvedError =
    previewData?.hasVariables && previewData.unresolved
      ? `Unresolved variable: ${previewData.unresolved.raw}`
      : null

  const previewError =
    previewQuery.isError && previewQuery.error instanceof Error
      ? previewQuery.error.message
      : previewQuery.isError
        ? 'Failed to preview request'
        : null

  useEffect(() => {
    setExecuteResult(null)
    setExecuteError(null)
  }, [selectionIdentity])

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

  const handleSend = useCallback(
    (overrides: DraftSendOverrides) => {
      if (!selectedRequest || !selectionIdentity) return

      const sentIdentity = selectionIdentity
      setExecuteResult(null)
      setExecuteError(null)

      executeMutation.mutate(
        {
          collectionId: selectedRequest.collectionId,
          requestIndex: selectedRequest.requestIndex,
          followRedirects,
          method: overrides.method,
          url: overrides.url,
          headers: overrides.headers,
          body: overrides.body,
          environment: activeEnvironment,
        },
        {
          onSuccess: (result) => {
            if (selectionIdentityRef.current !== sentIdentity) return
            setExecuteResult(result)
            setExecuteError(null)
          },
          onError: (error) => {
            if (selectionIdentityRef.current !== sentIdentity) return
            setExecuteResult(null)
            setExecuteError({
              code: error instanceof ExecuteRequestError ? error.code : undefined,
              message: error instanceof Error ? error.message : 'Failed to execute request',
            })
          },
        },
      )
    },
    [activeEnvironment, executeMutation, followRedirects, selectedRequest, selectionIdentity],
  )

  const handleSave = useCallback(() => {
    // Story 3.3 wires disk persistence; stub keeps Save UX gated in 3.1.
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey
      if (!isMeta) return

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        return
      }

      if (event.key === 'Enter' && activeRequest && draft && canSend) {
        event.preventDefault()
        handleSend({
          method: draft.method,
          url: draft.url,
          headers: draft.headers,
          body: draft.body ?? null,
        })
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeRequest, canSend, draft, handleSend])

  const isSending = executeMutation.isPending

  return (
    <div className="flex min-h-0 flex-1">
      <SidebarShell
        selectedRequest={selectedRequest}
        onSelectRequest={handleSelectRequest}
        onClearSelection={handleClearSelection}
      />
      <WorkspaceShell
        activeRequest={activeRequest}
        draft={draft}
        activeEnvironment={activeEnvironment}
        environmentVariables={activeEnvironmentVariables}
        isDetailPending={Boolean(selectedRequest) && isDetailPending}
        isDetailError={isDetailError}
        collectionId={selectedRequest?.collectionId ?? null}
        requestIndex={selectedRequest?.requestIndex ?? null}
        selectionIdentity={selectionIdentity}
        onMethodChange={setMethod}
        onUrlChange={setUrl}
        onHeadersChange={setHeaders}
        onBodyChange={setBody}
        onAddBody={addBody}
        onClearBody={clearBody}
        followRedirects={followRedirects}
        onFollowRedirectsChange={setFollowRedirects}
        onSend={handleSend}
        isSending={isSending}
        canSend={canSend}
        isDraftDirty={isDirty}
        canSave={canSave}
        validationError={validation.message ?? null}
        onSave={handleSave}
        preview={previewData}
        unresolvedError={unresolvedError}
        previewError={previewError}
        executeResult={executeResult}
        executeError={executeError}
      />
    </div>
  )
}
