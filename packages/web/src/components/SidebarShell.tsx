import { useCollections } from '../hooks/useCollections.js'
import { SidebarSkeleton } from './SidebarSkeleton.js'

export function SidebarShell() {
  const { isPending, isError, isRefetchError } = useCollections()
  const showError = isError || isRefetchError

  return (
    <aside
      role="complementary"
      aria-label="Sidebar"
      className="flex h-full w-sidebar-width shrink-0 flex-col border-r border-border bg-surface"
    >
      {isPending ? <SidebarSkeleton /> : null}
      {showError ? (
        <p
          role="alert"
          aria-live="assertive"
          className="px-inset py-inset-sm text-foreground-muted text-body"
        >
          Could not load collections
        </p>
      ) : null}
    </aside>
  )
}
