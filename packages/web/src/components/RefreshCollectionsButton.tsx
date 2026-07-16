type RefreshCollectionsButtonProps = {
  onRefresh: () => void
  isPending: boolean
  error: Error | null
}

export function RefreshCollectionsButton({
  onRefresh,
  isPending,
  error,
}: RefreshCollectionsButtonProps) {
  return (
    <div className="flex flex-col gap-inset-sm">
      <button
        type="button"
        aria-label="Refresh collections"
        aria-busy={isPending}
        disabled={isPending}
        onClick={onRefresh}
        className="inline-flex items-center justify-center gap-inset-sm rounded-md border border-border bg-surface px-inset-sm py-inset-sm text-body disabled:opacity-70"
      >
        {isPending ? (
          <span
            aria-hidden="true"
            className="inline-block size-4 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent motion-reduce:animate-none"
          />
        ) : null}
        Refresh
      </button>
      {error ? (
        <p className="text-foreground-muted text-body">Could not refresh collections</p>
      ) : null}
    </div>
  )
}
