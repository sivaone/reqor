import type {
  ExecuteResponseType,
  EnvironmentVariableDtoType,
  PreviewResponseType,
  RequestDtoType,
} from '@reqor/shared-types'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { RequestLine } from './RequestLine.js'
import { RequestPlaceholder } from './RequestPlaceholder.js'
import { ResponsePanel } from './ResponsePanel.js'

type WorkspaceShellProps = {
  activeRequest: RequestDtoType | null
  activeEnvironment: string | null
  environmentVariables: EnvironmentVariableDtoType[]
  isDetailPending: boolean
  isDetailError: boolean
  collectionId: string | null
  requestIndex: number | null
  lineMethod: string
  lineUrl: string
  onMethodChange: (method: string) => void
  onUrlChange: (url: string) => void
  followRedirects: boolean
  onFollowRedirectsChange: (value: boolean) => void
  onSend: (overrides: { method: string; url: string }) => void
  isSending: boolean
  canSend: boolean
  preview: PreviewResponseType | null
  unresolvedError: string | null
  previewError: string | null
  executeResult: ExecuteResponseType | null
  executeError: { code?: string; message: string } | null
}

export function WorkspaceShell({
  activeRequest,
  activeEnvironment,
  environmentVariables,
  isDetailPending,
  isDetailError,
  lineMethod,
  lineUrl,
  onMethodChange,
  onUrlChange,
  followRedirects,
  onFollowRedirectsChange,
  onSend,
  isSending,
  canSend,
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
            ) : activeRequest ? (
              <RequestLine
                activeEnvironment={activeEnvironment}
                environmentVariables={environmentVariables}
                method={lineMethod}
                url={lineUrl}
                onMethodChange={onMethodChange}
                onUrlChange={onUrlChange}
                followRedirects={followRedirects}
                onFollowRedirectsChange={onFollowRedirectsChange}
                onSend={onSend}
                isSending={isSending}
                canSend={canSend}
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
