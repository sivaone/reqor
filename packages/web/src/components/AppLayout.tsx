import type {
  CollectionDetailDtoType,
  DiagnosticDtoType,
  ExecuteResponseType,
  HistoryEntrySummaryDtoType,
  ImportCurlResponseType,
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
import { ExportCurlError, useExportCurl } from '../hooks/useExportCurl.js'
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
import { replayHistoryEntry } from '../utils/replayHistoryEntry.js'
import { copyToClipboard, CopyToClipboardError } from '../utils/copyToClipboard.js'
import { SidebarShell } from './SidebarShell.js'
import { CurlImportDialog } from './CurlImportDialog.js'
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
  const [curlImportOpen, setCurlImportOpen] = useState(false)
  const [importWarnings, setImportWarnings] = useState<string[] | null>(null)
  const [copyCurlStatus, setCopyCurlStatus] = useState<{
    kind: 'success' | 'error'
    message: string
  } | null>(null)
  const pendingNavigationRef = useRef<(() => void) | null>(null)
  const savingRef = useRef(false)
  const isReplayingRef = useRef(false)
  const replayGenerationRef = useRef(0)
  const copyCurlGenerationRef = useRef(0)
  const selectedHistoryIdRef = useRef<number | null>(null)

  const collectionId = selectedRequest?.collectionId
  const {
    data: detail,
    isPending: isDetailPending,
    isError: isDetailError,
  } = useCollectionDetail(collectionId)

  const executeMutation = useExecuteRequest()
  const exportCurlMutation = useExportCurl()
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
    selectedHistoryIdRef.current = null
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
      guardNavigation(() => {
        copyCurlGenerationRef.current += 1
        setImportWarnings(null)
        setCopyCurlStatus(null)
        setSelectedRequest(selection)
      })
    },
    [guardNavigation],
  )

  const handleClearSelection = useCallback(() => {
    guardNavigation(() => {
      copyCurlGenerationRef.current += 1
      setImportWarnings(null)
      setCopyCurlStatus(null)
      setSelectedRequest(null)
    })
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

  const clearHistoryDisplay = useCallback(() => {
    selectedHistoryIdRef.current = null
    setSelectedHistoryId(null)
    setHistoryResponse(null)
    setHistoryBodyTruncated(false)
    setHistoryReplayError(null)
  }, [])

  const handleReplayHistory = useCallback(
    (entry: HistoryEntrySummaryDtoType) => {
      guardNavigation(() => {
        const generation = ++replayGenerationRef.current
        isReplayingRef.current = true
        setExecuteResult(null)
        setExecuteError(null)
        setHistoryReplayError(null)
        setHistoryResponse(null)
        setHistoryBodyTruncated(false)
        selectedHistoryIdRef.current = entry.id
        setSelectedHistoryId(entry.id)

        void (async () => {
          try {
            const result = await replayHistoryEntry({
              entry,
              fetchCollectionDetail,
              fetchHistoryDetail,
            })
            if (generation !== replayGenerationRef.current) return

            if (!result.ok) {
              setHistoryResponse(null)
              setHistoryBodyTruncated(false)
              setHistoryReplayError(result.error)
              return
            }

            setSelectedRequest(result.selection)
            setHistoryResponse(result.response)
            // Detail always includes the full stored body — never keep summary truncation.
            setHistoryBodyTruncated(false)
            setHistoryReplayError(null)
          } finally {
            if (generation === replayGenerationRef.current) {
              isReplayingRef.current = false
            }
          }
        })()
      })
    },
    [fetchCollectionDetail, fetchHistoryDetail, guardNavigation],
  )

  const handleExpandBody = useCallback(async () => {
    if (selectedHistoryId == null) return
    const expandingId = selectedHistoryId
    setIsExpandingBody(true)
    try {
      const detailDto = await fetchHistoryDetail(expandingId)
      if (selectedHistoryIdRef.current !== expandingId) return
      setHistoryResponse(historyToExecuteResponse(detailDto))
      setHistoryBodyTruncated(false)
      setHistoryReplayError(null)
    } catch {
      if (selectedHistoryIdRef.current !== expandingId) return
      setHistoryReplayError('Failed to load full response body')
    } finally {
      if (selectedHistoryIdRef.current === expandingId) {
        setIsExpandingBody(false)
      }
    }
  }, [fetchHistoryDetail, selectedHistoryId])

  const handleSend = useCallback(
    (overrides: DraftSendOverrides) => {
      if (!selectedRequest || !selectionIdentity) return

      const sentIdentity = selectionIdentity
      setExecuteResult(null)
      setExecuteError(null)
      clearHistoryDisplay()

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
            clearHistoryDisplay()
            void queryClient.invalidateQueries({ queryKey: ['history'], exact: true })
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
    [
      activeEnvironment,
      clearHistoryDisplay,
      executeMutation,
      followRedirects,
      queryClient,
      selectedRequest,
      selectionIdentity,
    ],
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

  const handleCurlImported = useCallback(
    (result: ImportCurlResponseType) => {
      setMethod(result.request.method)
      setUrl(result.request.url)
      setHeaders(result.request.headers)
      if (result.request.body) {
        setBody(result.request.body)
      } else {
        clearBody()
      }
      setImportWarnings(result.warnings.length > 0 ? result.warnings : null)
      setSaveStatus(null)
    },
    [clearBody, setBody, setHeaders, setMethod, setUrl],
  )

  const handleCopyCurl = useCallback(async () => {
    if (!selectedRequest || !draft || exportCurlMutation.isPending) return

    const generation = ++copyCurlGenerationRef.current
    setCopyCurlStatus(null)
    try {
      const result = await exportCurlMutation.mutateAsync({
        collectionId: selectedRequest.collectionId,
        requestIndex: selectedRequest.requestIndex,
        environment: activeEnvironment,
        method: draft.method,
        url: draft.url,
        headers: draft.headers,
        body: draft.body ?? null,
      })
      if (generation !== copyCurlGenerationRef.current) return
      await copyToClipboard(result.curl)
      if (generation !== copyCurlGenerationRef.current) return
      setCopyCurlStatus({ kind: 'success', message: 'cURL copied to clipboard' })
    } catch (error) {
      if (generation !== copyCurlGenerationRef.current) return
      const message =
        error instanceof ExportCurlError || error instanceof CopyToClipboardError
          ? error.message
          : 'Failed to export cURL'
      setCopyCurlStatus({ kind: 'error', message })
    }
  }, [activeEnvironment, draft, exportCurlMutation, selectedRequest])

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
        displayResult={displayResult}
        displayError={displayError}
        historyReplayError={historyReplayError}
        bodyTruncated={historyBodyTruncated}
        onExpandBody={historyBodyTruncated ? handleExpandBody : undefined}
        isExpandingBody={isExpandingBody}
        onImportCurl={activeRequest && draft ? () => setCurlImportOpen(true) : undefined}
        importWarnings={importWarnings}
        onCopyCurl={activeRequest && draft ? () => void handleCopyCurl() : undefined}
        copyCurlPending={exportCurlMutation.isPending}
        copyCurlStatus={copyCurlStatus}
      />
      <CurlImportDialog
        open={curlImportOpen}
        onClose={() => setCurlImportOpen(false)}
        onImported={handleCurlImported}
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
