import type { RequestBodyDtoType } from '@reqor/shared-types'

const BODY_KINDS = ['raw', 'json', 'form'] as const

type RequestBodyPanelProps = {
  body: RequestBodyDtoType | undefined
  onBodyChange: (body: RequestBodyDtoType | undefined) => void
  onAddBody: () => void
  onClearBody: () => void
}

export function RequestBodyPanel({
  body,
  onBodyChange,
  onAddBody,
  onClearBody,
}: RequestBodyPanelProps) {
  if (!body) {
    return (
      <div className="flex flex-col gap-inset-sm px-inset py-inset">
        <p className="text-label text-foreground-muted">Body</p>
        <p className="text-body text-foreground-muted">No request body</p>
        <button
          type="button"
          onClick={onAddBody}
          className="self-start rounded-md border border-border bg-surface px-inset py-inset-sm text-body text-foreground"
        >
          Add body
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-inset-sm px-inset py-inset">
      <p className="text-label text-foreground-muted">Body</p>
      <label className="flex flex-col gap-inset-sm">
        <span className="text-label text-foreground-muted">Kind</span>
        <select
          aria-label="Body kind"
          value={body.kind}
          onChange={(event) =>
            onBodyChange({
              ...body,
              kind: event.target.value as RequestBodyDtoType['kind'],
            })
          }
          className="w-fit rounded-md border border-border bg-background px-inset-sm py-inset-sm text-body text-foreground"
        >
          {BODY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-inset-sm">
        <span className="text-label text-foreground-muted">Content</span>
        <textarea
          aria-label="Body content"
          value={body.content}
          onChange={(event) => onBodyChange({ ...body, content: event.target.value })}
          rows={8}
          className="min-h-[8rem] w-full rounded-md border border-border bg-background px-inset-sm py-inset-sm text-mono"
        />
      </label>
      <button
        type="button"
        onClick={onClearBody}
        className="self-start rounded-md border border-border bg-surface px-inset py-inset-sm text-body text-foreground"
      >
        Remove body
      </button>
    </div>
  )
}
