import type { RequestHeaderDtoType } from '@reqor/shared-types'

type RequestHeadersPanelProps = {
  headers: RequestHeaderDtoType[]
  onHeadersChange: (headers: RequestHeaderDtoType[]) => void
}

export function RequestHeadersPanel({ headers, onHeadersChange }: RequestHeadersPanelProps) {
  const updateRow = (index: number, field: 'name' | 'value', value: string) => {
    onHeadersChange(
      headers.map((header, i) => (i === index ? { ...header, [field]: value } : header)),
    )
  }

  const removeRow = (index: number) => {
    onHeadersChange(headers.filter((_, i) => i !== index))
  }

  const addRow = () => {
    onHeadersChange([...headers, { name: '', value: '' }])
  }

  return (
    <div className="flex flex-col gap-inset-sm px-inset py-inset">
      <p className="text-label text-foreground-muted">Headers</p>
      {headers.length === 0 ? (
        <p className="text-body text-foreground-muted">No headers</p>
      ) : (
        <ul className="space-y-inset-sm">
          {headers.map((header, index) => (
            <li
              key={`header-${index}`}
              className="grid grid-cols-[minmax(0,8rem)_1fr_auto] gap-inset-sm"
            >
              <input
                aria-label={`Header ${index + 1} name`}
                type="text"
                value={header.name}
                onChange={(event) => updateRow(index, 'name', event.target.value)}
                className="min-w-0 rounded-md border border-border bg-background px-inset-sm py-inset-sm text-mono"
                placeholder="Name"
              />
              <input
                aria-label={`Header ${index + 1} value`}
                type="text"
                value={header.value}
                onChange={(event) => updateRow(index, 'value', event.target.value)}
                className="min-w-0 rounded-md border border-border bg-background px-inset-sm py-inset-sm text-mono"
                placeholder="Value"
              />
              <button
                type="button"
                aria-label={`Remove header ${index + 1}`}
                onClick={() => removeRow(index)}
                className="rounded-md border border-border bg-surface px-inset-sm py-inset-sm text-body text-foreground"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={addRow}
        className="self-start rounded-md border border-border bg-surface px-inset py-inset-sm text-body text-foreground"
      >
        Add header
      </button>
    </div>
  )
}
