import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequestBodyPanel } from './RequestBodyPanel.js'

describe('RequestBodyPanel', () => {
  it('shows Add body when body is absent', () => {
    const onAddBody = vi.fn()
    render(
      <RequestBodyPanel
        body={undefined}
        onBodyChange={vi.fn()}
        onAddBody={onAddBody}
        onClearBody={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add body/i }))
    expect(onAddBody).toHaveBeenCalled()
  })

  it('edits kind/content and can remove body', () => {
    const onBodyChange = vi.fn()
    const onClearBody = vi.fn()
    render(
      <RequestBodyPanel
        body={{ kind: 'raw', content: 'hello' }}
        onBodyChange={onBodyChange}
        onAddBody={vi.fn()}
        onClearBody={onClearBody}
      />,
    )

    fireEvent.change(screen.getByLabelText('Body kind'), { target: { value: 'json' } })
    expect(onBodyChange).toHaveBeenCalledWith({ kind: 'json', content: 'hello' })

    fireEvent.change(screen.getByLabelText('Body content'), {
      target: { value: '{"a":1}' },
    })
    expect(onBodyChange).toHaveBeenCalledWith({ kind: 'raw', content: '{"a":1}' })

    fireEvent.click(screen.getByRole('button', { name: /remove body/i }))
    expect(onClearBody).toHaveBeenCalled()
  })
})
