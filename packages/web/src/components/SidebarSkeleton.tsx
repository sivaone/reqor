export function SidebarSkeleton() {
  return (
    <div
      className="flex flex-col gap-inset-sm p-inset"
      aria-busy="true"
      aria-label="Loading collections"
      data-testid="sidebar-skeleton"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          data-testid="skeleton-row"
          className="h-4 animate-pulse rounded-sm bg-surface-muted"
        />
      ))}
    </div>
  )
}
