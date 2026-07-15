import { Group, Panel, Separator } from 'react-resizable-panels'
import { RequestPlaceholder } from './RequestPlaceholder.js'

export function WorkspaceShell() {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Workspace">
      <Group orientation="vertical" className="h-full flex-1 gap-panel-gap">
        <Panel defaultSize={50} minSize={20} className="min-h-0">
          <section
            aria-label="Request"
            className="flex h-full items-center justify-center bg-background"
          >
            <RequestPlaceholder />
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
