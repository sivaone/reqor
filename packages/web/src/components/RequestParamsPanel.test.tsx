import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequestParamsPanel } from './RequestParamsPanel.js'

describe('RequestParamsPanel', () => {
  it('edits query params and updates URL', () => {
    const onUrlChange = vi.fn()
    render(
      <RequestParamsPanel url="https://httpbin.dev/get?retry=1" onUrlChange={onUrlChange} />,
    )

    fireEvent.change(screen.getByLabelText('Param 1 value'), {
      target: { value: '2' },
    })
    expect(onUrlChange).toHaveBeenCalledWith('https://httpbin.dev/get?retry=2')
  })

  it('adds and removes params for template URLs', () => {
    const onUrlChange = vi.fn()
    render(<RequestParamsPanel url="{{host}}/get" onUrlChange={onUrlChange} />)

    fireEvent.click(screen.getByRole('button', { name: /add param/i }))
    expect(onUrlChange).toHaveBeenCalledWith('{{host}}/get?=')

    onUrlChange.mockClear()
    render(
      <RequestParamsPanel url="{{host}}/get?retry=1" onUrlChange={onUrlChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remove param 1/i }))
    expect(onUrlChange).toHaveBeenCalledWith('{{host}}/get')
  })
})
