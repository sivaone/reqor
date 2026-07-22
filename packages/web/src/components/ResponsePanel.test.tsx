import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResponsePanel } from './ResponsePanel.js'

const sampleResult = {
  status: 200,
  statusText: 'OK',
  headers: [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'X-Test', value: 'alpha' },
  ],
  body: '{"hello":"world"}',
  timingMs: 98.4,
  sizeBytes: 897,
}

describe('ResponsePanel', () => {
  it('renders status bar format including empty statusText handling', () => {
    render(<ResponsePanel result={{ ...sampleResult, statusText: '' }} isPending={false} error={null} />)

    expect(screen.getByText(/200 · 98 ms · 897 B/)).toBeDefined()
  })

  it('shows HTTP 500 in status bar rather than transport error panel', () => {
    render(
      <ResponsePanel
        result={{
          ...sampleResult,
          status: 500,
          statusText: 'Internal Server Error',
          body: 'error',
        }}
        isPending={false}
        error={null}
      />,
    )

    expect(screen.getByText(/500 Internal Server Error · 98 ms · 897 B/)).toBeDefined()
    expect(screen.queryByText(/PROXY_FAILED/i)).toBeNull()
  })

  it('switches between body and headers tabs', () => {
    render(<ResponsePanel result={sampleResult} isPending={false} error={null} />)

    expect(screen.getByText(/"hello"/)).toBeDefined()

    fireEvent.click(screen.getByRole('tab', { name: /headers/i }))
    expect(screen.getByText('X-Test')).toBeDefined()
    expect(screen.getByText('alpha')).toBeDefined()
  })

  it('shows transport error message', () => {
    render(
      <ResponsePanel
        result={null}
        isPending={false}
        error={{ code: 'PROXY_FAILED', message: 'fetch failed' }}
      />,
    )

    expect(screen.getByText(/fetch failed \(PROXY_FAILED\)/)).toBeDefined()
  })

  it('shows empty placeholder when no send yet', () => {
    render(<ResponsePanel result={null} isPending={false} error={null} />)
    expect(screen.getByText('Response will appear here')).toBeDefined()
  })

  it('shows truncation marker and expand callback', () => {
    const onExpandBody = vi.fn()
    render(
      <ResponsePanel
        result={sampleResult}
        isPending={false}
        error={null}
        bodyTruncated
        onExpandBody={onExpandBody}
      />,
    )

    expect(
      screen.getByText('Response body truncated (>1MB). Expand to load full body.'),
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(onExpandBody).toHaveBeenCalledOnce()
  })
})
