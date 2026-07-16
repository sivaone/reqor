import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SidebarTabs } from './SidebarTabs.js'

describe('SidebarTabs', () => {
  it('defaults to Collections tab active', () => {
    render(<SidebarTabs activeTab="collections" onTabChange={() => undefined} />)

    expect(screen.getByRole('tab', { name: 'Collections', selected: true })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'History', selected: false })).toBeDefined()
  })

  it('calls onTabChange when switching tabs', () => {
    const onTabChange = vi.fn()
    render(<SidebarTabs activeTab="collections" onTabChange={onTabChange} />)

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    expect(onTabChange).toHaveBeenCalledWith('history')
  })

  it('preserves search when managed by parent on tab switch', () => {
    function TabsWithSearch() {
      const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections')
      const [collectionsSearch, setCollectionsSearch] = useState('demo')
      const [historySearch] = useState('')

      return (
        <div>
          <SidebarTabs activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === 'collections' ? (
            <input
              aria-label="Collections search"
              value={collectionsSearch}
              onChange={(event) => setCollectionsSearch(event.target.value)}
            />
          ) : (
            <input aria-label="History search" value={historySearch} readOnly />
          )}
        </div>
      )
    }

    render(<TabsWithSearch />)

    expect((screen.getByLabelText('Collections search') as HTMLInputElement).value).toBe(
      'demo',
    )
    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Collections' }))
    expect((screen.getByLabelText('Collections search') as HTMLInputElement).value).toBe(
      'demo',
    )
  })
})
