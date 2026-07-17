import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequestHeadersPanel } from './RequestHeadersPanel.js'

describe('RequestHeadersPanel', () => {
  it('adds, edits, and removes header rows', () => {
    const onHeadersChange = vi.fn()
    const { rerender } = render(
      <RequestHeadersPanel headers={[]} onHeadersChange={onHeadersChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add header/i }))
    expect(onHeadersChange).toHaveBeenCalledWith([{ name: '', value: '' }])

    rerender(
      <RequestHeadersPanel
        headers={[{ name: 'Accept', value: 'text/plain' }]}
        onHeadersChange={onHeadersChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Header 1 value'), {
      target: { value: 'application/json' },
    })
    expect(onHeadersChange).toHaveBeenCalledWith([
      { name: 'Accept', value: 'application/json' },
    ])

    fireEvent.click(screen.getByRole('button', { name: /remove header 1/i }))
    expect(onHeadersChange).toHaveBeenCalledWith([])
  })
})
