import type {
  EnvironmentVariableDtoType,
  PreviewResponseType,
  RequestBodyDtoType,
  RequestHeaderDtoType,
} from '@reqor/shared-types'
import { useState } from 'react'
import type { DraftSendOverrides } from '../types/draftSend.js'
import type { RequestDraft } from '../utils/requestDraft.js'
import { RequestBodyPanel } from './RequestBodyPanel.js'
import { RequestHeadersPanel } from './RequestHeadersPanel.js'
import { RequestLine } from './RequestLine.js'
import { RequestParamsPanel } from './RequestParamsPanel.js'
import { RequestSubTabs, type RequestSubTab } from './RequestSubTabs.js'

type RequestEditorProps = {
  draft: RequestDraft
  selectionIdentity?: string | null
  activeEnvironment?: string | null
  environmentVariables?: EnvironmentVariableDtoType[]
  onMethodChange: (method: string) => void
  onUrlChange: (url: string) => void
  onHeadersChange: (headers: RequestHeaderDtoType[]) => void
  onBodyChange: (body: RequestBodyDtoType | undefined) => void
  onAddBody: () => void
  onClearBody: () => void
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
}

export function RequestEditor({
  draft,
  selectionIdentity = null,
  activeEnvironment,
  environmentVariables = [],
  onMethodChange,
  onUrlChange,
  onHeadersChange,
  onBodyChange,
  onAddBody,
  onClearBody,
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
}: RequestEditorProps) {
  const [activeTab, setActiveTab] = useState<RequestSubTab>('params')
  const [trackedSelection, setTrackedSelection] = useState(selectionIdentity)

  if (selectionIdentity !== trackedSelection) {
    setTrackedSelection(selectionIdentity)
    setActiveTab('params')
  }

  const draftBody: DraftSendOverrides['body'] = draft.body ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <RequestLine
        activeEnvironment={activeEnvironment}
        environmentVariables={environmentVariables}
        method={draft.method}
        url={draft.url}
        headers={draft.headers}
        body={draftBody}
        onMethodChange={onMethodChange}
        onUrlChange={onUrlChange}
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
        onTabChange={setActiveTab}
        headersCount={draft.headers.length}
      />
      <div
        role="tabpanel"
        id="request-panel-params"
        aria-labelledby="request-tab-params"
        hidden={activeTab !== 'params'}
      >
        <RequestParamsPanel url={draft.url} onUrlChange={onUrlChange} />
      </div>
      <div
        role="tabpanel"
        id="request-panel-headers"
        aria-labelledby="request-tab-headers"
        hidden={activeTab !== 'headers'}
      >
        <RequestHeadersPanel headers={draft.headers} onHeadersChange={onHeadersChange} />
      </div>
      <div
        role="tabpanel"
        id="request-panel-body"
        aria-labelledby="request-tab-body"
        hidden={activeTab !== 'body'}
      >
        <RequestBodyPanel
          body={draft.body}
          onBodyChange={onBodyChange}
          onAddBody={onAddBody}
          onClearBody={onClearBody}
        />
      </div>
    </div>
  )
}
