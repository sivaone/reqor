import type {
  DiagnosticDtoType,
  EnvironmentVariableDtoType,
  PreviewResponseType,
  RequestBodyDtoType,
  RequestHeaderDtoType,
  SyncCollectionResponseType,
} from '@reqor/shared-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PREVIEW_DEBOUNCE_MS } from '../hooks/usePreviewRequest.js'
import type { DraftSendOverrides } from '../types/draftSend.js'
import type { RequestDraft } from '../utils/requestDraft.js'
import {
  buildSyncPayload,
  isVisualTab,
  matchRequestAfterSync,
} from '../utils/syncOnTabSwitch.js'
import { RequestBodyPanel } from './RequestBodyPanel.js'
import { RequestHeadersPanel } from './RequestHeadersPanel.js'
import { RequestLine } from './RequestLine.js'
import { RequestParamsPanel } from './RequestParamsPanel.js'
import { RequestRawPanel } from './RequestRawPanel.js'
import { RequestSubTabs, type RequestSubTab } from './RequestSubTabs.js'

type RequestEditorProps = {
  draft: RequestDraft
  draftSelectionKey?: string | null
  collectionId: string | null
  requestIndex: number | null
  requestFingerprint: string | null
  activeEnvironment?: string | null
  environmentVariables?: EnvironmentVariableDtoType[]
  onMethodChange: (method: string) => void
  onUrlChange: (url: string) => void
  onHeadersChange: (headers: RequestHeaderDtoType[]) => void
  onBodyChange: (body: RequestBodyDtoType | undefined) => void
  onAddBody: () => void
  onClearBody: () => void
  onContentChange: (content: string) => void
  onSyncSuccess: (response: SyncCollectionResponseType, matchedRequestIndex: number) => void
  onParseDiagnostics: (diagnostics: DiagnosticDtoType[], parseStatus: 'ok' | 'error') => void
  syncCollection: (input: {
    collectionId: string
    body: ReturnType<typeof buildSyncPayload>
  }) => Promise<SyncCollectionResponseType>
  followRedirects: boolean
  onFollowRedirectsChange: (value: boolean) => void
  onSend: (overrides: DraftSendOverrides) => void
  isSending: boolean
  canSend: boolean
  isDraftDirty: boolean
  canSave: boolean
  validationError: string | null
  onSave: () => void
  preview?: PreviewResponseType | null
  unresolvedError?: string | null
  previewError?: string | null
  parseDiagnostics?: DiagnosticDtoType[]
  syncPending?: boolean
}

export function RequestEditor({
  draft,
  draftSelectionKey = null,
  collectionId,
  requestIndex,
  requestFingerprint,
  activeEnvironment,
  environmentVariables = [],
  onMethodChange,
  onUrlChange,
  onHeadersChange,
  onBodyChange,
  onAddBody,
  onClearBody,
  onContentChange,
  onSyncSuccess,
  onParseDiagnostics,
  syncCollection,
  followRedirects,
  onFollowRedirectsChange,
  onSend,
  isSending,
  canSend,
  isDraftDirty,
  canSave,
  validationError,
  onSave,
  preview = null,
  unresolvedError = null,
  previewError = null,
  parseDiagnostics = [],
  syncPending = false,
}: RequestEditorProps) {
  const [activeTab, setActiveTab] = useState<RequestSubTab>('params')
  const [trackedSelection, setTrackedSelection] = useState(draftSelectionKey)
  const [localSyncPending, setLocalSyncPending] = useState(false)
  const [localDiagnostics, setLocalDiagnostics] = useState<DiagnosticDtoType[]>(parseDiagnostics)
  const draftRef = useRef(draft)
  const activeTabRef = useRef(activeTab)
  const syncSeqRef = useRef(0)
  const tabChangeInFlightRef = useRef(false)
  const selectionKeyAtSyncRef = useRef(draftSelectionKey)
  const structuredEditedOnRawRef = useRef(false)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    selectionKeyAtSyncRef.current = draftSelectionKey
  }, [draftSelectionKey])

  if (draftSelectionKey !== trackedSelection) {
    setTrackedSelection(draftSelectionKey)
    setActiveTab('params')
    setLocalDiagnostics([])
    structuredEditedOnRawRef.current = false
  }

  const markStructuredEditedOnRaw = useCallback(() => {
    if (activeTabRef.current === 'raw') {
      structuredEditedOnRawRef.current = true
    }
  }, [])

  const wrapStructuredChange = useCallback(
    <T extends (...args: never[]) => void>(handler: T): T => {
      const wrapped = ((...args: Parameters<T>) => {
        markStructuredEditedOnRaw()
        handler(...args)
      }) as T
      return wrapped
    },
    [markStructuredEditedOnRaw],
  )

  const runSync = useCallback(
    async (direction: 'to-raw' | 'to-visual') => {
      if (!collectionId || requestIndex === null || requestFingerprint === null) {
        return false
      }

      const seq = ++syncSeqRef.current
      const selectionKeyAtStart = selectionKeyAtSyncRef.current

      setLocalSyncPending(true)
      try {
        const body = buildSyncPayload(direction, draftRef.current, requestIndex, {
          includeStructuredPatch:
            direction === 'to-visual' && structuredEditedOnRawRef.current,
        })
        const response = await syncCollection({ collectionId, body })

        if (seq !== syncSeqRef.current) return false
        if (selectionKeyAtStart !== selectionKeyAtSyncRef.current) return false

        setLocalDiagnostics(response.diagnostics)
        onParseDiagnostics(response.diagnostics, response.parseStatus)

        if (response.parseStatus === 'error') {
          return false
        }

        const matched = matchRequestAfterSync(
          response,
          requestIndex,
          requestFingerprint,
          direction,
        )
        if (!matched) {
          const fallback = [
            {
              line: 1,
              message: 'Could not rematch request after sync',
            },
          ]
          setLocalDiagnostics(
            response.diagnostics.length > 0 ? response.diagnostics : fallback,
          )
          onParseDiagnostics(
            response.diagnostics.length > 0 ? response.diagnostics : fallback,
            'error',
          )
          return false
        }
        onSyncSuccess(response, matched.requestIndex)
        structuredEditedOnRawRef.current = false
        return true
      } catch (error) {
        if (seq !== syncSeqRef.current) return false
        const message = error instanceof Error ? error.message : 'Failed to sync collection'
        const fallback = [{ line: 1, message }]
        setLocalDiagnostics(fallback)
        onParseDiagnostics(fallback, 'error')
        return false
      } finally {
        if (seq === syncSeqRef.current) {
          setLocalSyncPending(false)
        }
      }
    },
    [
      collectionId,
      onParseDiagnostics,
      onSyncSuccess,
      requestFingerprint,
      requestIndex,
      syncCollection,
    ],
  )

  const handleTabChange = useCallback(
    async (next: RequestSubTab) => {
      if (tabChangeInFlightRef.current) return

      const fromVisual = isVisualTab(activeTab)
      const toVisual = isVisualTab(next)
      const crossingToRaw = fromVisual && next === 'raw'
      const crossingToVisual = activeTab === 'raw' && toVisual

      if (!crossingToRaw && !crossingToVisual) {
        setActiveTab(next)
        return
      }

      tabChangeInFlightRef.current = true
      try {
        if (crossingToRaw) {
          const ok = await runSync('to-raw')
          if (!ok) return
        } else if (crossingToVisual) {
          const ok = await runSync('to-visual')
          if (!ok) return
        }
        setActiveTab(next)
      } finally {
        tabChangeInFlightRef.current = false
      }
    },
    [activeTab, runSync],
  )

  const runDiagnosticsSync = useCallback(async () => {
    if (!collectionId || requestIndex === null) return

    const seq = ++syncSeqRef.current
    const tabAtStart = activeTabRef.current
    const selectionKeyAtStart = selectionKeyAtSyncRef.current

    try {
      const body = buildSyncPayload('to-visual', draftRef.current, requestIndex)
      const response = await syncCollection({ collectionId, body })

      if (seq !== syncSeqRef.current) return
      if (tabAtStart !== 'raw' || activeTabRef.current !== 'raw') return
      if (selectionKeyAtStart !== selectionKeyAtSyncRef.current) return

      setLocalDiagnostics(response.diagnostics)
      onParseDiagnostics(response.diagnostics, response.parseStatus)

      if (response.parseStatus === 'ok' && requestFingerprint !== null) {
        const matched = matchRequestAfterSync(
          response,
          requestIndex,
          requestFingerprint,
          'to-visual',
        )
        if (matched) {
          onSyncSuccess(response, matched.requestIndex)
        }
      }
    } catch (error) {
      if (seq !== syncSeqRef.current) return
      if (tabAtStart !== 'raw' || activeTabRef.current !== 'raw') return
      const message = error instanceof Error ? error.message : 'Failed to sync collection'
      const fallback = [{ line: 1, message }]
      setLocalDiagnostics(fallback)
      onParseDiagnostics(fallback, 'error')
    }
  }, [
    collectionId,
    onParseDiagnostics,
    onSyncSuccess,
    requestFingerprint,
    requestIndex,
    syncCollection,
  ])

  useEffect(() => {
    if (activeTab !== 'raw' || !collectionId || requestIndex === null) return

    const handle = window.setTimeout(() => {
      void runDiagnosticsSync()
    }, PREVIEW_DEBOUNCE_MS)

    return () => window.clearTimeout(handle)
  }, [activeTab, collectionId, draft.content, requestIndex, runDiagnosticsSync])

  const draftBody: DraftSendOverrides['body'] = draft.body ?? null
  const pending = syncPending || localSyncPending
  const diagnosticsToShow =
    localDiagnostics.length > 0 ? localDiagnostics : parseDiagnostics

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <RequestLine
        activeEnvironment={activeEnvironment}
        environmentVariables={environmentVariables}
        method={draft.method}
        url={draft.url}
        headers={draft.headers}
        body={draftBody}
        onMethodChange={wrapStructuredChange(onMethodChange)}
        onUrlChange={wrapStructuredChange(onUrlChange)}
        followRedirects={followRedirects}
        onFollowRedirectsChange={onFollowRedirectsChange}
        onSend={onSend}
        isSending={isSending}
        canSend={canSend}
        isDraftDirty={isDraftDirty}
        canSave={canSave}
        validationError={validationError}
        onSave={onSave}
        preview={preview}
        unresolvedError={unresolvedError}
        previewError={previewError}
      />
      <RequestSubTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          void handleTabChange(tab)
        }}
        headersCount={draft.headers.length}
      />
      <div
        role="tabpanel"
        id="request-panel-params"
        aria-labelledby="request-tab-params"
        hidden={activeTab !== 'params'}
      >
        <RequestParamsPanel url={draft.url} onUrlChange={wrapStructuredChange(onUrlChange)} />
      </div>
      <div
        role="tabpanel"
        id="request-panel-headers"
        aria-labelledby="request-tab-headers"
        hidden={activeTab !== 'headers'}
      >
        <RequestHeadersPanel
          headers={draft.headers}
          onHeadersChange={wrapStructuredChange(onHeadersChange)}
        />
      </div>
      <div
        role="tabpanel"
        id="request-panel-body"
        aria-labelledby="request-tab-body"
        hidden={activeTab !== 'body'}
      >
        <RequestBodyPanel
          body={draft.body}
          onBodyChange={wrapStructuredChange(onBodyChange)}
          onAddBody={wrapStructuredChange(onAddBody)}
          onClearBody={wrapStructuredChange(onClearBody)}
        />
      </div>
      <div
        role="tabpanel"
        id="request-panel-raw"
        aria-labelledby="request-tab-raw"
        hidden={activeTab !== 'raw'}
        className={activeTab === 'raw' ? 'flex min-h-0 flex-1 flex-col' : undefined}
      >
        <RequestRawPanel
          content={draft.content}
          onContentChange={(text) => {
            draftRef.current = { ...draftRef.current, content: text }
            onContentChange(text)
          }}
          onBlur={() => {
            void runDiagnosticsSync()
          }}
          diagnostics={diagnosticsToShow}
          syncPending={pending}
        />
      </div>
    </div>
  )
}
