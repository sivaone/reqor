type CollectionsEmptyStateProps = {
  onRefresh: () => void
  isRefreshing: boolean
}

export function CollectionsEmptyState({
  onRefresh,
  isRefreshing,
}: CollectionsEmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-inset px-inset py-inset">
      <p className="text-foreground-muted text-body">
        No .http files found. Add one to the repo and refresh.
      </p>
      <button
        type="button"
        aria-label="Refresh collections"
        aria-busy={isRefreshing}
        disabled={isRefreshing}
        onClick={onRefresh}
        className="inline-flex items-center gap-inset-sm rounded-md border border-border bg-surface px-inset-sm py-inset-sm text-body disabled:opacity-70"
      >
        {isRefreshing ? (
          <span
            aria-hidden="true"
            className="inline-block size-4 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent motion-reduce:animate-none"
          />
        ) : null}
        Refresh
      </button>
    </div>
  )
}
