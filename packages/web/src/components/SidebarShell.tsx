import { useCollections } from '../hooks/useCollections.js'
import { SidebarSkeleton } from './SidebarSkeleton.js'

export function SidebarShell() {
  const { isPending, isError, isSuccess } = useCollections()

  return (
    <aside
      role="complementary"
      aria-label="Sidebar"
      className="flex h-full w-sidebar-width shrink-0 flex-col border-r border-border bg-surface"
    >
      {isPending ? <SidebarSkeleton /> : null}
      {isError ? (
        <p className="px-inset py-inset-sm text-foreground-muted text-body">
          Could not load collections
        </p>
      ) : null}
      {isSuccess ? <div className="h-full bg-surface" aria-hidden="true" /> : null}
    </aside>
  )
}
