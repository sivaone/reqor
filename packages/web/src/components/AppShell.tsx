import { AppHeader } from './AppHeader.js'
import { AppLayout } from './AppLayout.js'

export function AppShell() {
  return (
    <div className="flex h-screen min-w-[1280px] flex-col overflow-hidden bg-background text-foreground text-body">
      <AppHeader />
      <AppLayout />
    </div>
  )
}
