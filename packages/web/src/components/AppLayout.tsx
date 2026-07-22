import type {
  CollectionDetailDtoType,
  DiagnosticDtoType,
  ExecuteResponseType,
  HistoryEntrySummaryDtoType,
  PreviewResponseType,
  RequestDtoType,
  RequestHeaderDtoType,
  SaveCollectionResponseType,
  SyncCollectionResponseType,
} from '@reqor/shared-types'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollectionDetail } from '../hooks/useCollectionDetail.js'
import { useConfig } from '../hooks/useConfig.js'
import { useEnvironments } from '../hooks/useEnvironments.js'
import { useExecuteRequest, ExecuteRequestError } from '../hooks/useExecuteRequest.js'
import { usePreviewRequest } from '../hooks/usePreviewRequest.js'
import { useRequestDraft } from '../hooks/useRequestDraft.js'
import { SaveCollectionError, useSaveCollection } from '../hooks/useSaveCollection.js'
import { useSyncCollection } from '../hooks/useSyncCollection.js'
import type { DraftSendOverrides } from '../types/draftSend.js'
import type { SelectedRequest } from '../types/selection.js'
import { deriveCanSend } from '../utils/deriveCanSend.js'
import {
  buildSyncPayload,
  formatParseDiagnostic,
  matchRequestAfterSync,
} from '../utils/syncOnTabSwitch.js'
import { structuredFieldsDifferFromBaseline } from '../utils/requestDraft.js'
import { historyToExecuteResponse } from '../utils/historyToExecuteResponse.js'
import { findByFingerprint } from '../utils/rematchRequest.js'
import { SidebarShell } from './SidebarShell.js'
import { UnsavedChangesDialog } from './UnsavedChangesDialog.js'
import { WorkspaceShell } from './WorkspaceShell.js'

type SaveStatus = {
  kind: 'success' | 'warning' | 'error'
  message: string
  successMessage?: string
}

const EMPTY_HEADERS: RequestHeaderDtoType[] = []

export function AppLayout() {
  const queryClient = useQueryClient()
  const [selectedRequest, setSelectedRequest] = useState<SelectedRequest>(null)
  const [followRedirects, setFollowRedirects] = useState(true)
  const [executeResult, setExecuteResult] = useState<ExecuteResponseType | null>(null)
  const [executeError, setExecuteError] = useState<{ code?: string; message: string } | null>(
    null,
  )
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null)
  const [historyResponse, setHistoryResponse] = useState<ExecuteResponseType | null>(null)
  const [historyBodyTruncated, setHistoryBodyTruncated] = useState(false)
  const [historyReplayError, setHistoryReplayError] = useState<string | null>(null)
  const [isExpandingBody, setIsExpandingBody] = useState(false)
  const [parseDiagnostics, setParseDiagnostics] = useState<DiagnosticDtoType[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)
  const pendingNavigationRef = useRef<(() => void) | null>(null)
  const savingRef = useRef(false)
  const isReplayingRef = useRef(false)

  const collectionId = selectedRequest?.collectionId
  const {
    data: detail,
    isPending: isDetailPending,
    isError: isDetailError,
  } = useCollectionDetail(collectionId)

  const executeMutation = useExecuteRequest()
  const { mutateAsync: syncMutateAsync, isPending: syncPending } = useSyncCollection()
  const saveMutation = useSaveCollection()
  const savePending = saveMutation.isPending

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
    return findByFingerprint(
      detail,
      selectedRequest.fingerprint,
      selectedRequest.requestIndex,
    )
  }, [selectedRequest, detail])

  // Draft resets on collection+index only — fingerprint updates after sync must not wipe edits.
  const draftSelectionKey = selectedRequest
    ? `${selectedRequest.collectionId}:${selectedRequest.requestIndex}`
    : null
  const selectionIdentity = selectedRequest
    ? `${selectedRequest.collectionId}:${selectedRequest.requestIndex}:${selectedRequest.fingerprint}`
    : null
  const selectionIdentityRef = useRef(selectionIdentity)
  selectionIdentityRef.current = selectionIdentity
  const lastPreviewRef = useRef<PreviewResponseType | null>(null)

  const {
    draft,
    baseline,
    isDirty,
    validation,
    canSave,
    setMethod,
    setUrl,
    setHeaders,
    setBody,
    addBody,
    clearBody,
    setContent,
    applySyncResult,
    applySaveResult,
    setParseBlockingSave,
  } = useRequestDraft(activeRequest, draftSelectionKey, detail?.content ?? '')

  const effectiveCanSave = canSave && !syncPending && !savePending

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
    draftSelectionKey,
  })

  useEffect(() => {
    lastPreviewRef.current = null
    setParseDiagnostics([])
    setParseBlockingSave(false)
    setSaveStatus(null)
  }, [draftSelectionKey, setParseBlockingSave])

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
    if (isReplayingRef.current) return
    setExecuteResult(null)
    setExecuteError(null)
    setSelectedHistoryId(null)
    setHistoryResponse(null)
    setHistoryBodyTruncated(false)
    setHistoryReplayError(null)
  }, [selectionIdentity])

  useEffect(() => {
    if (!selectedRequest || !detail || detail.id !== selectedRequest.collectionId) return

    // Prefer requestIndex after sync (fingerprint may change when method/url edits).
    const byIndex = detail.requests.find(
      (request) => request.requestIndex === selectedRequest.requestIndex,
    )
    if (byIndex) {
      if (byIndex.fingerprint !== selectedRequest.fingerprint) {
        setSelectedRequest({
          collectionId: selectedRequest.collectionId,
          requestIndex: byIndex.requestIndex,
          fingerprint: byIndex.fingerprint,
        })
      }
      return
    }

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

    // Do not clear selection while the collection detail is in a parse-error state
    // (raw editor may temporarily produce zero requests during sync).
    if (detail.parseStatus === 'error') return

    setSelectedRequest(null)
  }, [detail, selectedRequest])

  const runPendingNavigation = useCallback(() => {
    if (savingRef.current || savePending) {
      pendingNavigationRef.current = null
      setUnsavedDialogOpen(false)
      return
    }
    const action = pendingNavigationRef.current
    pendingNavigationRef.current = null
    setUnsavedDialogOpen(false)
    action?.()
  }, [savePending])

  const guardNavigation = useCallback(
    (action: () => void) => {
      if (savingRef.current || savePending) {
        return
      }
      if (isDirty) {
        pendingNavigationRef.current = action
        setUnsavedDialogOpen(true)
        return
      }
      action()
    },
    [isDirty, savePending],
  )

  const handleSelectRequest = useCallback(
    (selection: NonNullable<SelectedRequest>) => {
      guardNavigation(() => setSelectedRequest(selection))
    },
    [guardNavigation],
  )

  const handleClearSelection = useCallback(() => {
    guardNavigation(() => setSelectedRequest(null))
  }, [guardNavigation])

  const fetchCollectionDetail = useCallback(
    async (collectionId: string): Promise<CollectionDetailDtoType> => {
      return queryClient.fetchQuery({
        queryKey: ['collection', collectionId],
        queryFn: async ({ signal }) => {
          const res = await fetch(`/api/collections/${collectionId}`, { signal })
          if (!res.ok) {
            const body = await res.json().catch(() => null)
            if (body?.error?.code === 'NOT_FOUND') {
              throw new Error('NOT_FOUND')
            }
            throw new Error('Failed to load collection detail')
          }
          return res.json()
        },
      })
    },
    [queryClient],
  )

  const fetchHistoryDetail = useCallback(
    async (historyId: number) => {
      return queryClient.fetchQuery({
        queryKey: ['history', historyId],
        queryFn: async ({ signal }) => {
          const res = await fetch(`/api/history/${historyId}`, { signal })
          if (!res.ok) throw new Error('Failed to load history detail')
          return res.json()
        },
      })
    },
    [queryClient],
  )

  const handleReplayHistory = useCallback(
    (entry: HistoryEntrySummaryDtoType) => {
      guardNavigation(() => {
        void (async () => {
          isReplayingRef.current = true
          setHistoryReplayError(null)
          setSelectedHistoryId(entry.id)

          try {
            let collectionDetail: CollectionDetailDtoType
            try {
              collectionDetail = await fetchCollectionDetail(entry.collectionId)
            } catch {
              setHistoryReplayError(
                'Could not find request in collection for this history entry.',
              )
              return
            }

            const matched = findByFingerprint(collectionDetail, entry.fingerprint)
            if (!matched) {
              setHistoryReplayError(
                'Could not find request in collection for this history entry.',
              )
              return
            }

            setSelectedRequest({
              collectionId: entry.collectionId,
              requestIndex: matched.requestIndex,
              fingerprint: matched.fingerprint,
            })

            const detailDto = await fetchHistoryDetail(entry.id)
            setHistoryResponse(historyToExecuteResponse(detailDto))
            setHistoryBodyTruncated(entry.bodyTruncated)
          } finally {
            isReplayingRef.current = false
          }
        })()
      })
    },
    [fetchCollectionDetail, fetchHistoryDetail, guardNavigation],
  )

  const handleExpandBody = useCallback(async () => {
    if (selectedHistoryId == null) return
    setIsExpandingBody(true)
    try {
      const detailDto = await fetchHistoryDetail(selectedHistoryId)
      setHistoryResponse(historyToExecuteResponse(detailDto))
      setHistoryBodyTruncated(false)
    } finally {
      setIsExpandingBody(false)
    }
  }, [fetchHistoryDetail, selectedHistoryId])

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
            setSelectedHistoryId(null)
            setHistoryResponse(null)
            setHistoryBodyTruncated(false)
            setHistoryReplayError(null)
            void queryClient.invalidateQueries({ queryKey: ['history'] })
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
    [activeEnvironment, executeMutation, followRedirects, queryClient, selectedRequest, selectionIdentity],
  )

  const handleSave = useCallback(async () => {
    if (
      !effectiveCanSave ||
      !selectedRequest ||
      !draft ||
      !baseline ||
      !selectionIdentity ||
      savingRef.current
    ) {
      return
    }

    savingRef.current = true
    const saveIdentity = selectionIdentity
    const saveSelection = selectedRequest
    setSaveStatus(null)
    let contentToSave = draft.content

    try {
      if (structuredFieldsDifferFromBaseline(draft, baseline)) {
        try {
          const syncResponse = await syncMutateAsync({
            collectionId: saveSelection.collectionId,
            body: buildSyncPayload('to-raw', draft, saveSelection.requestIndex),
          })
          if (selectionIdentityRef.current !== saveIdentity) return

          setParseDiagnostics(syncResponse.diagnostics)
          setParseBlockingSave(syncResponse.parseStatus === 'error')
          if (syncResponse.parseStatus === 'error') {
            const diagnostic = syncResponse.diagnostics[0]
            setSaveStatus({
              kind: 'error',
              message: diagnostic
                ? formatParseDiagnostic(diagnostic)
                : 'Parse error before save',
            })
            return
          }

          const matched = matchRequestAfterSync(
            syncResponse,
            saveSelection.requestIndex,
            saveSelection.fingerprint,
            'to-raw',
          )
          if (!matched) {
            setSaveStatus({
              kind: 'error',
              message: 'Could not rematch request after sync',
            })
            return
          }

          applySyncResult({ content: syncResponse.content, request: matched })
          contentToSave = syncResponse.content
        } catch (error) {
          if (selectionIdentityRef.current !== saveIdentity) return
          setSaveStatus({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Failed to sync before save',
          })
          return
        }
      }

      try {
        const response: SaveCollectionResponseType = await saveMutation.mutateAsync({
          collectionId: saveSelection.collectionId,
          content: contentToSave,
        })
        if (selectionIdentityRef.current !== saveIdentity) return

        const matched =
          response.requests.find(
            (request) => request.requestIndex === saveSelection.requestIndex,
          ) ??
          response.requests.find(
            (request) => request.fingerprint === saveSelection.fingerprint,
          )
        if (!matched) {
          setSaveStatus({
            kind: 'error',
            message: 'Saved on disk but could not rematch the active request',
          })
          return
        }

        applySaveResult({ content: response.content, request: matched })
        if (matched.fingerprint !== saveSelection.fingerprint) {
          setSelectedRequest({
            collectionId: saveSelection.collectionId,
            requestIndex: matched.requestIndex,
            fingerprint: matched.fingerprint,
          })
        }

        const basename =
          saveSelection.collectionId.split('/').pop() ?? saveSelection.collectionId
        const successMessage = `Saved to ${basename}`

        if (response.warning?.code === 'FULL_REWRITE') {
          setSaveStatus({
            kind: 'warning',
            message: response.warning.message,
            successMessage,
          })
        } else {
          setSaveStatus({ kind: 'success', message: successMessage })
        }
      } catch (error) {
        if (selectionIdentityRef.current !== saveIdentity) return
        const collectionPath = saveSelection.collectionId
        if (error instanceof SaveCollectionError && error.code === 'WRITE_FAILED') {
          setSaveStatus({
            kind: 'error',
            message: `Cannot write to ${collectionPath}. File may be read-only.`,
          })
          return
        }
        if (error instanceof SaveCollectionError && error.code === 'PARSE_ERROR') {
          setSaveStatus({
            kind: 'error',
            message: error.line
              ? `Parse error at line ${error.line}`
              : error.message,
          })
          return
        }
        setSaveStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Failed to save collection',
        })
      }
    } finally {
      savingRef.current = false
    }
  }, [
    applySaveResult,
    applySyncResult,
    baseline,
    draft,
    effectiveCanSave,
    saveMutation,
    selectedRequest,
    selectionIdentity,
    setParseBlockingSave,
    syncMutateAsync,
  ])

  const handleParseDiagnostics = useCallback(
    (diagnostics: DiagnosticDtoType[], parseStatus: 'ok' | 'error') => {
      setParseDiagnostics(diagnostics)
      setParseBlockingSave(parseStatus === 'error')
    },
    [setParseBlockingSave],
  )

  const handleSyncSuccess = useCallback(
    (response: SyncCollectionResponseType, matchedRequestIndex: number) => {
      const matched = response.requests.find(
        (request) => request.requestIndex === matchedRequestIndex,
      )
      if (!matched) return
      applySyncResult({ content: response.content, request: matched })
      setParseDiagnostics(response.diagnostics)
      setParseBlockingSave(response.parseStatus === 'error')
      if (
        selectedRequest &&
        matched.fingerprint !== selectedRequest.fingerprint
      ) {
        setSelectedRequest({
          collectionId: selectedRequest.collectionId,
          requestIndex: matched.requestIndex,
          fingerprint: matched.fingerprint,
        })
      }
    },
    [applySyncResult, selectedRequest, setParseBlockingSave],
  )

  const syncCollection = useCallback(
    async (input: {
      collectionId: string
      body: Parameters<typeof syncMutateAsync>[0]['body']
    }) => {
      return syncMutateAsync(input)
    },
    [syncMutateAsync],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey
      if (!isMeta) return

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (effectiveCanSave) {
          void handleSave()
        }
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
  }, [activeRequest, canSend, draft, effectiveCanSave, handleSave, handleSend])

  const isSending = executeMutation.isPending

  const displayResult = isSending ? null : (executeResult ?? historyResponse)
  const displayError =
    isSending || displayResult || historyReplayError ? null : executeError

  return (
    <div className="flex min-h-0 flex-1">
      <SidebarShell
        selectedRequest={selectedRequest}
        onSelectRequest={handleSelectRequest}
        onClearSelection={handleClearSelection}
        selectedHistoryId={selectedHistoryId}
        onReplayHistory={handleReplayHistory}
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
        requestFingerprint={selectedRequest?.fingerprint ?? null}
        draftSelectionKey={draftSelectionKey}
        onMethodChange={setMethod}
        onUrlChange={setUrl}
        onHeadersChange={setHeaders}
        onBodyChange={setBody}
        onAddBody={addBody}
        onClearBody={clearBody}
        onContentChange={setContent}
        onSyncSuccess={handleSyncSuccess}
        onParseDiagnostics={handleParseDiagnostics}
        syncCollection={syncCollection}
        parseDiagnostics={parseDiagnostics}
        syncPending={syncPending}
        followRedirects={followRedirects}
        onFollowRedirectsChange={setFollowRedirects}
        onSend={handleSend}
        isSending={isSending}
        canSend={canSend}
        isDraftDirty={isDirty}
        canSave={effectiveCanSave}
        validationError={validation.message ?? null}
        onSave={() => {
          void handleSave()
        }}
        saveStatus={saveStatus}
        savePending={savePending}
        preview={previewData}
        unresolvedError={unresolvedError}
        previewError={previewError}
        executeResult={executeResult}
        executeError={executeError}
        displayResult={displayResult}
        displayError={displayError}
        historyReplayError={historyReplayError}
        bodyTruncated={historyBodyTruncated}
        onExpandBody={historyBodyTruncated ? handleExpandBody : undefined}
        isExpandingBody={isExpandingBody}
      />
      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        onConfirm={runPendingNavigation}
        onCancel={() => {
          pendingNavigationRef.current = null
          setUnsavedDialogOpen(false)
        }}
      />
    </div>
  )
}
