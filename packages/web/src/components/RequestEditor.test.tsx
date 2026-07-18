import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RequestDraft } from '../utils/requestDraft.js'
import { RequestEditor } from './RequestEditor.js'

const draft: RequestDraft = {
  method: 'GET',
  url: 'https://httpbin.dev/get',
  headers: [{ name: 'Accept', value: 'application/json' }],
}

const baseProps = {
  draft,
  onMethodChange: vi.fn(),
  onUrlChange: vi.fn(),
  onHeadersChange: vi.fn(),
  onBodyChange: vi.fn(),
  onAddBody: vi.fn(),
  onClearBody: vi.fn(),
  followRedirects: true,
  onFollowRedirectsChange: vi.fn(),
  onSend: vi.fn(),
  isSending: false,
  canSend: true,
  isDraftDirty: false,
  canSave: false,
  validationError: null,
  onSave: vi.fn(),
}

describe('RequestEditor', () => {
  it('preserves header edits when switching sub-tabs', () => {
    const onHeadersChange = vi.fn()
    const { rerender } = render(
      <RequestEditor {...baseProps} onHeadersChange={onHeadersChange} />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Headers (1)' }))
    fireEvent.change(screen.getByLabelText('Header 1 value'), {
      target: { value: 'text/plain' },
    })
    expect(onHeadersChange).toHaveBeenCalledWith([{ name: 'Accept', value: 'text/plain' }])

    const editedDraft: RequestDraft = {
      ...draft,
      headers: [{ name: 'Accept', value: 'text/plain' }],
    }
    rerender(
      <RequestEditor
        {...baseProps}
        draft={editedDraft}
        onHeadersChange={onHeadersChange}
        isDraftDirty={true}
        canSave={true}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Params' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Headers (1)' }))
    expect(screen.getByLabelText('Header 1 value')).toHaveProperty('value', 'text/plain')
  })

  it('hides Save when clean and shows when dirty', () => {
    const { rerender } = render(<RequestEditor {...baseProps} />)
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()

    rerender(<RequestEditor {...baseProps} isDraftDirty={true} canSave={true} />)
    expect(screen.getByRole('button', { name: /^save$/i })).toHaveProperty('disabled', false)
  })

  it('resets sub-tab to Params when selection changes', () => {
    const { rerender } = render(
      <RequestEditor {...baseProps} selectionIdentity="demo:0:aaa" />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Headers (1)' }))
    expect(screen.getByRole('tab', { name: 'Headers (1)' })).toHaveProperty('ariaSelected', 'true')

    rerender(
      <RequestEditor
        {...baseProps}
        draft={{ ...draft, method: 'POST', url: 'https://httpbin.dev/post' }}
        selectionIdentity="demo:1:bbb"
      />,
    )

    expect(screen.getByRole('tab', { name: 'Params' })).toHaveProperty('ariaSelected', 'true')
  })
})
