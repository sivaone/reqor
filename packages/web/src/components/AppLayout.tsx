import { SidebarShell } from './SidebarShell.js'
import { WorkspaceShell } from './WorkspaceShell.js'

export function AppLayout() {
  return (
    <div className="flex min-h-0 flex-1">
      <SidebarShell />
      <WorkspaceShell />
    </div>
  )
}
