import type { RequestDtoType } from '@reqor/shared-types'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { RequestPlaceholder } from './RequestPlaceholder.js'
import { RequestPreview } from './RequestPreview.js'

type WorkspaceShellProps = {
  activeRequest: RequestDtoType | null
  isDetailPending: boolean
  isDetailError: boolean
}

export function WorkspaceShell({
  activeRequest,
  isDetailPending,
  isDetailError,
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
              <RequestPreview request={activeRequest} />
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
          <section aria-label="Response" className="h-full bg-surface" />
        </Panel>
      </Group>
    </main>
  )
}
