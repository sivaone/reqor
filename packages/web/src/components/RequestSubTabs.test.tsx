import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequestSubTabs } from './RequestSubTabs.js'

describe('RequestSubTabs', () => {
  it('renders Params, Headers with badge, Body, and Raw .http tabs', () => {
    render(<RequestSubTabs activeTab="params" onTabChange={vi.fn()} headersCount={2} />)

    expect(screen.getByRole('tab', { name: 'Params' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Headers (2)' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Body' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Raw .http' })).toBeDefined()
  })

  it('notifies on tab change', () => {
    const onTabChange = vi.fn()
    render(<RequestSubTabs activeTab="params" onTabChange={onTabChange} headersCount={0} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Body' }))
    expect(onTabChange).toHaveBeenCalledWith('body')
  })
})
