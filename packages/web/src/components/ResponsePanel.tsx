import type { ExecuteResponseType } from '@reqor/shared-types'
import { type ReactNode, useMemo, useState } from 'react'
import {
  detectResponseFormat,
  escapeJsonStringDisplay,
  formatStatusBar,
  prettyPrintJson,
  statusTone,
  tokenizeXml,
} from '../utils/formatResponseBody.js'

type ResponsePanelProps = {
  result: ExecuteResponseType | null
  isPending: boolean
  error: { code?: string; message: string } | null
  bodyTruncated?: boolean
  onExpandBody?: () => void
  isExpandingBody?: boolean
}

type ResponseTab = 'body' | 'headers'

function getContentType(headers: ExecuteResponseType['headers']): string | undefined {
  return headers.find((header) => header.name.toLowerCase() === 'content-type')?.value
}

function JsonHighlightedBody({ body }: { body: string }) {
  const formatted = useMemo(() => prettyPrintJson(body), [body])

  const renderValue = (value: unknown, indent: number): ReactNode => {
    const pad = '  '.repeat(indent)
    if (value === null) {
      return <span className="text-foreground-muted">null</span>
    }
    if (typeof value === 'boolean') {
      return <span className="text-foreground">{String(value)}</span>
    }
    if (typeof value === 'number') {
      return <span className="text-foreground">{String(value)}</span>
    }
    if (typeof value === 'string') {
      return (
        <span className="text-success">
          &quot;{escapeJsonStringDisplay(value)}&quot;
        </span>
      )
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span>[]</span>
      return (
        <>
          {'[\n'}
          {value.map((item, index) => (
            <span key={index}>
              {pad}
              {'  '}
              {renderValue(item, indent + 1)}
              {index < value.length - 1 ? ',\n' : '\n'}
            </span>
          ))}
          {pad}
          {']'}
        </>
      )
    }

    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span>{'{}'}</span>
    return (
      <>
        {'{\n'}
        {entries.map(([key, entryValue], index) => (
          <span key={`${indent}:${index}:${key}`}>
            {pad}
            {'  '}
            <span className="text-primary">&quot;{escapeJsonStringDisplay(key)}&quot;</span>
            {': '}
            {renderValue(entryValue, indent + 1)}
            {index < entries.length - 1 ? ',\n' : '\n'}
          </span>
        ))}
        {pad}
        {'}'}
      </>
    )
  }

  try {
    const parsed = JSON.parse(formatted)
    return <pre className="whitespace-pre-wrap">{renderValue(parsed, 0)}</pre>
  } catch {
    return <pre className="whitespace-pre-wrap">{formatted}</pre>
  }
}

function XmlHighlightedBody({ body }: { body: string }) {
  const tokens = useMemo(() => tokenizeXml(body), [body])
  return (
    <pre className="whitespace-pre-wrap">
      {tokens.map((token, index) => {
        if (token.type === 'tag') {
          return (
            <span key={index} className="text-primary">
              {token.value}
            </span>
          )
        }
        if (token.type === 'attr') {
          return (
            <span key={index} className="text-success">
              {token.value}
            </span>
          )
        }
        return (
          <span key={index} className="text-foreground">
            {token.value}
          </span>
        )
      })}
    </pre>
  )
}

function PlainBody({ body }: { body: string }) {
  return <pre className="whitespace-pre-wrap">{body}</pre>
}

function ResponseBodyContent({ result }: { result: ExecuteResponseType }) {
  const format = detectResponseFormat(getContentType(result.headers), result.body)

  if (format === 'json') {
    return <JsonHighlightedBody body={result.body} />
  }
  if (format === 'xml') {
    return <XmlHighlightedBody body={result.body} />
  }
  return <PlainBody body={result.body} />
}

export function ResponsePanel({
  result,
  isPending,
  error,
  bodyTruncated = false,
  onExpandBody,
  isExpandingBody = false,
}: ResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body')

  const statusClass =
    result && statusTone(result.status) === 'success'
      ? 'text-success'
      : result && statusTone(result.status) === 'error'
        ? 'text-error'
        : 'text-foreground'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-inset py-inset-sm">
        {result ? (
          <p className={`text-body ${statusClass}`}>
            {formatStatusBar(result.status, result.statusText, result.timingMs, result.sizeBytes)}
          </p>
        ) : isPending ? (
          <p className="text-body text-foreground-muted">Sending…</p>
        ) : error ? (
          <p className="text-body text-error">
            {error.message}
            {error.code ? ` (${error.code})` : ''}
          </p>
        ) : (
          <p className="text-body text-foreground-muted">Response will appear here</p>
        )}
      </div>

      {result ? (
        <>
          <div role="tablist" aria-label="Response sections" className="flex border-b border-border">
            {(['body', 'headers'] as const).map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`response-tab-${tab}`}
                  aria-controls={`response-panel-${tab}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  className={`px-inset py-inset-sm text-body capitalize ${
                    isActive
                      ? 'border-b-2 border-primary text-foreground'
                      : 'text-foreground-muted'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              )
            })}
          </div>

          <div
            role="tabpanel"
            id="response-panel-body"
            aria-labelledby="response-tab-body"
            hidden={activeTab !== 'body'}
            className="min-h-0 flex-1 overflow-auto bg-surface p-inset text-mono"
          >
            {bodyTruncated && onExpandBody ? (
              <div className="mb-inset flex items-center gap-inset-sm text-body text-foreground-muted">
                <span>Response body truncated (&gt;1MB). Expand to load full body.</span>
                <button
                  type="button"
                  className="text-primary underline"
                  disabled={isExpandingBody}
                  onClick={onExpandBody}
                >
                  {isExpandingBody ? 'Expanding…' : 'Expand'}
                </button>
              </div>
            ) : null}
            <ResponseBodyContent result={result} />
          </div>
          <div
            role="tabpanel"
            id="response-panel-headers"
            aria-labelledby="response-tab-headers"
            hidden={activeTab !== 'headers'}
            className="min-h-0 flex-1 overflow-auto bg-surface p-inset"
          >
            <ul className="space-y-inset-sm">
              {result.headers.map((header, index) => (
                <li
                  key={`${index}:${header.name}:${header.value}`}
                  className="grid grid-cols-[160px_1fr] gap-inset-sm"
                >
                  <span className="text-body font-semibold">{header.name}</span>
                  <span className="truncate text-mono" title={header.value}>
                    {header.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}
