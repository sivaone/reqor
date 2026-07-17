import { applyUrlParams, parseUrlParams, type UrlParam } from '../utils/requestDraft.js'

type RequestParamsPanelProps = {
  url: string
  onUrlChange: (url: string) => void
}

export function RequestParamsPanel({ url, onUrlChange }: RequestParamsPanelProps) {
  const params = parseUrlParams(url)

  const updateParams = (next: UrlParam[]) => {
    onUrlChange(applyUrlParams(url, next))
  }

  const updateRow = (index: number, field: 'key' | 'value', value: string) => {
    const next = params.map((param, i) =>
      i === index ? { ...param, [field]: value } : param,
    )
    updateParams(next)
  }

  const removeRow = (index: number) => {
    updateParams(params.filter((_, i) => i !== index))
  }

  const addRow = () => {
    updateParams([...params, { key: '', value: '' }])
  }

  return (
    <div className="flex flex-col gap-inset-sm px-inset py-inset">
      <p className="text-label text-foreground-muted">Query params</p>
      {params.length === 0 ? (
        <p className="text-body text-foreground-muted">No query parameters</p>
      ) : (
        <ul className="space-y-inset-sm">
          {params.map((param, index) => (
            <li
              key={`param-${index}`}
              className="grid grid-cols-[minmax(0,8rem)_1fr_auto] gap-inset-sm"
            >
              <input
                aria-label={`Param ${index + 1} key`}
                type="text"
                value={param.key}
                onChange={(event) => updateRow(index, 'key', event.target.value)}
                className="min-w-0 rounded-md border border-border bg-background px-inset-sm py-inset-sm text-mono"
                placeholder="Key"
              />
              <input
                aria-label={`Param ${index + 1} value`}
                type="text"
                value={param.value}
                onChange={(event) => updateRow(index, 'value', event.target.value)}
                className="min-w-0 rounded-md border border-border bg-background px-inset-sm py-inset-sm text-mono"
                placeholder="Value"
              />
              <button
                type="button"
                aria-label={`Remove param ${index + 1}`}
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
        Add param
      </button>
    </div>
  )
}
