import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnsavedChangesDialog } from './UnsavedChangesDialog.js'

describe('UnsavedChangesDialog', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.open = false
    })
  })

  it('renders dialog copy when open', () => {
    render(<UnsavedChangesDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Discard unsaved changes?')).toBeDefined()
  })

  it('invokes confirm when Discard is clicked', () => {
    const onConfirm = vi.fn()
    render(<UnsavedChangesDialog open onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('closes via cancel event (Esc)', () => {
    const onCancel = vi.fn()
    render(<UnsavedChangesDialog open onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
