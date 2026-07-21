import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequestRawPanel } from './RequestRawPanel.js'

describe('RequestRawPanel', () => {
  it('renders content and notifies on change', () => {
    const onContentChange = vi.fn()
    render(
      <RequestRawPanel
        content="GET https://example.com"
        onContentChange={onContentChange}
      />,
    )

    const editor = screen.getByLabelText('Raw HTTP file') as HTMLTextAreaElement
    expect(editor.value).toBe('GET https://example.com')
    fireEvent.change(editor, { target: { value: 'POST https://example.com' } })
    expect(onContentChange).toHaveBeenCalledWith('POST https://example.com')
  })

  it('shows parse error with line number', () => {
    render(
      <RequestRawPanel
        content="NOPE"
        onContentChange={vi.fn()}
        diagnostics={[{ line: 2, message: 'Expected request line' }]}
      />,
    )

    expect(screen.getByRole('alert').textContent).toBe('Line 2: Expected request line')
  })

  it('renders highlighted overlay markup', () => {
    const { container } = render(
      <RequestRawPanel content="GET https://example.com\n" onContentChange={vi.fn()} />,
    )
    expect(container.querySelector('pre')?.innerHTML).toContain('text-primary')
  })
})
