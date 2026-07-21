import type {
  DiagnosticDtoType,
  ExecuteResponseType,
  EnvironmentVariableDtoType,
  PreviewResponseType,
  RequestBodyDtoType,
  RequestDtoType,
  RequestHeaderDtoType,
  SyncCollectionRequestType,
  SyncCollectionResponseType,
} from '@reqor/shared-types'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { DraftSendOverrides } from '../types/draftSend.js'
import type { RequestDraft } from '../utils/requestDraft.js'
import { RequestEditor } from './RequestEditor.js'
import { RequestPlaceholder } from './RequestPlaceholder.js'
import { ResponsePanel } from './ResponsePanel.js'

type WorkspaceShellProps = {
  activeRequest: RequestDtoType | null
  draft: RequestDraft | null
  activeEnvironment: string | null
  environmentVariables: EnvironmentVariableDtoType[]
  isDetailPending: boolean
  isDetailError: boolean
  collectionId: string | null
  requestIndex: number | null
  requestFingerprint: string | null
  draftSelectionKey: string | null
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
    body: SyncCollectionRequestType
  }) => Promise<SyncCollectionResponseType>
  parseDiagnostics: DiagnosticDtoType[]
  syncPending: boolean
  followRedirects: boolean
  onFollowRedirectsChange: (value: boolean) => void
  onSend: (overrides: DraftSendOverrides) => void
  isSending: boolean
  canSend: boolean
  isDraftDirty: boolean
  canSave: boolean
  validationError: string | null
  onSave: () => void
  saveStatus?: {
    kind: 'success' | 'warning' | 'error'
    message: string
    successMessage?: string
  } | null
  savePending?: boolean
  preview: PreviewResponseType | null
  unresolvedError: string | null
  previewError: string | null
  executeResult: ExecuteResponseType | null
  executeError: { code?: string; message: string } | null
}

export function WorkspaceShell({
  activeRequest,
  draft,
  activeEnvironment,
  environmentVariables,
  isDetailPending,
  isDetailError,
  collectionId,
  requestIndex,
  requestFingerprint,
  draftSelectionKey,
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
  parseDiagnostics,
  syncPending,
  followRedirects,
  onFollowRedirectsChange,
  onSend,
  isSending,
  canSend,
  isDraftDirty,
  canSave,
  validationError,
  onSave,
  saveStatus = null,
  savePending = false,
  preview,
  unresolvedError,
  previewError,
  executeResult,
  executeError,
}: WorkspaceShellProps) {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Workspace">
      <Group orientation="vertical" className="h-full flex-1 gap-panel-gap">
        <Panel defaultSize={50} minSize={20} className="min-h-0">
          <section
            aria-label="Request"
            className="flex h-full flex-col bg-background"
          >
            {isDetailError ? (
              <p className="px-inset py-inset text-foreground-muted text-body">
                Could not load request
              </p>
            ) : activeRequest && draft ? (
              <RequestEditor
                draft={draft}
                draftSelectionKey={draftSelectionKey}
                collectionId={collectionId}
                requestIndex={requestIndex}
                requestFingerprint={requestFingerprint}
                activeEnvironment={activeEnvironment}
                environmentVariables={environmentVariables}
                onMethodChange={onMethodChange}
                onUrlChange={onUrlChange}
                onHeadersChange={onHeadersChange}
                onBodyChange={onBodyChange}
                onAddBody={onAddBody}
                onClearBody={onClearBody}
                onContentChange={onContentChange}
                onSyncSuccess={onSyncSuccess}
                onParseDiagnostics={onParseDiagnostics}
                syncCollection={syncCollection}
                parseDiagnostics={parseDiagnostics}
                syncPending={syncPending}
                followRedirects={followRedirects}
                onFollowRedirectsChange={onFollowRedirectsChange}
                onSend={onSend}
                isSending={isSending}
                canSend={canSend}
                isDraftDirty={isDraftDirty}
                canSave={canSave}
                validationError={validationError}
                onSave={onSave}
                saveStatus={saveStatus}
                savePending={savePending}
                preview={preview}
                unresolvedError={unresolvedError}
                previewError={previewError}
              />
            ) : isDetailPending ? (
              <p className="px-inset py-inset text-foreground-muted text-body">
                Loading request…
              </p>
            ) : (
              <div className="flex h-full items-center justify-center">
                <RequestPlaceholder />
              </div>
            )}
          </section>
        </Panel>
        <Separator
          aria-label="Resize request and response panels"
          className="h-px shrink-0 cursor-row-resize bg-border hover:bg-foreground-muted"
        />
        <Panel defaultSize={50} minSize={20} className="min-h-0">
          <section aria-label="Response" className="h-full bg-surface">
            <ResponsePanel
              result={executeResult}
              isPending={isSending}
              error={executeError}
            />
          </section>
        </Panel>
      </Group>
    </main>
  )
}
