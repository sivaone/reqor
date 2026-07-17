import type { ExecuteResponseType, RequestDtoType } from '@reqor/shared-types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollectionDetail } from '../hooks/useCollectionDetail.js'
import { useConfig } from '../hooks/useConfig.js'
import { useEnvironments } from '../hooks/useEnvironments.js'
import { useExecuteRequest, ExecuteRequestError } from '../hooks/useExecuteRequest.js'
import { usePreviewRequest } from '../hooks/usePreviewRequest.js'
import type { SelectedRequest } from '../types/selection.js'
import { SidebarShell } from './SidebarShell.js'
import { WorkspaceShell } from './WorkspaceShell.js'

function deriveCanSend(options: {
  isSending: boolean
  hasActiveRequest: boolean
  previewPending: boolean
  previewFetching: boolean
  previewError: boolean
  hasVariables: boolean | undefined
  unresolved: { name: string; raw: string } | null | undefined
}): boolean {
  const {
    isSending,
    hasActiveRequest,
    previewPending,
    previewFetching,
    previewError,
    hasVariables,
    unresolved,
  } = options

  if (isSending || !hasActiveRequest) return false

  // Waiting for first preview result — gate Send (unknown hasVariables).
  if (hasVariables === undefined) return false

  if (hasVariables === false) return true

  // hasVariables === true
  if (previewPending || previewFetching || previewError) return false
  return unresolved == null
}

export function AppLayout() {
  const [selectedRequest, setSelectedRequest] = useState<SelectedRequest>(null)
  const [followRedirects, setFollowRedirects] = useState(true)
  const [lineMethod, setLineMethod] = useState('GET')
  const [lineUrl, setLineUrl] = useState('')
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

  const previewQuery = usePreviewRequest({
    collectionId: selectedRequest?.collectionId ?? null,
    requestIndex: selectedRequest?.requestIndex ?? null,
    environment: activeEnvironment,
    method: lineMethod,
    url: lineUrl,
    enabled: Boolean(activeRequest),
    selectionIdentity,
  })

  const canSend = deriveCanSend({
    isSending: executeMutation.isPending,
    hasActiveRequest: Boolean(activeRequest),
    previewPending: previewQuery.isPending,
    previewFetching: previewQuery.isFetching,
    previewError: previewQuery.isError,
    hasVariables: previewQuery.data?.hasVariables,
    unresolved: previewQuery.data?.unresolved,
  })

  const unresolvedError =
    previewQuery.data?.hasVariables && previewQuery.data.unresolved
      ? `Unresolved variable: ${previewQuery.data.unresolved.raw}`
      : null

  useEffect(() => {
    setExecuteResult(null)
    setExecuteError(null)
  }, [selectionIdentity])

  useEffect(() => {
    if (!activeRequest) return
    setLineMethod(activeRequest.method.toUpperCase())
    setLineUrl(activeRequest.url)
  }, [activeRequest])

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
    (overrides: { method: string; url: string }) => {
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey
      if (!isMeta) return

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        return
      }

      if (event.key === 'Enter' && activeRequest && canSend) {
        event.preventDefault()
        handleSend({
          method: lineMethod,
          url: lineUrl,
        })
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeRequest, canSend, handleSend, lineMethod, lineUrl])

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
        activeEnvironment={activeEnvironment}
        environmentVariables={activeEnvironmentVariables}
        isDetailPending={Boolean(selectedRequest) && isDetailPending}
        isDetailError={isDetailError}
        collectionId={selectedRequest?.collectionId ?? null}
        requestIndex={selectedRequest?.requestIndex ?? null}
        lineMethod={lineMethod}
        lineUrl={lineUrl}
        onMethodChange={setLineMethod}
        onUrlChange={setLineUrl}
        followRedirects={followRedirects}
        onFollowRedirectsChange={setFollowRedirects}
        onSend={handleSend}
        isSending={isSending}
        canSend={canSend}
        preview={previewQuery.data ?? null}
        unresolvedError={unresolvedError}
        executeResult={executeResult}
        executeError={executeError}
      />
    </div>
  )
}
