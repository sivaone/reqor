import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HistoryList } from './HistoryList.js'

const sampleEntries = [
  {
    id: 1,
    sentAt: '2026-07-22T10:00:00.000Z',
    environmentName: 'dev',
    collectionId: 'demo.http',
    fingerprint: 'a'.repeat(64),
    method: 'GET',
    url: 'https://api.example.com/users',
    statusCode: 200,
    durationMs: 50,
    sizeBytes: 100,
    body: '{}',
    bodyTruncated: false,
  },
  {
    id: 2,
    sentAt: '2026-07-22T11:00:00.000Z',
    environmentName: null,
    collectionId: 'demo.http',
    fingerprint: 'b'.repeat(64),
    method: 'POST',
    url: 'https://api.example.com/orders',
    statusCode: 404,
    durationMs: 80,
    sizeBytes: 50,
    body: 'not found',
    bodyTruncated: false,
  },
]

describe('HistoryList', () => {
  it('renders history rows with method badge and status colors', () => {
    render(
      <HistoryList
        filteredEntries={sampleEntries}
        selectedHistoryId={null}
        onReplay={vi.fn()}
        isLoading={false}
        isError={false}
      />,
    )

    expect(screen.getByRole('listbox', { name: 'History' })).toBeDefined()
    expect(screen.getByText('https://api.example.com/users')).toBeDefined()
    expect(screen.getByText('200').className).toContain('text-success')
    expect(screen.getByText('404').className).toContain('text-error')
    expect(screen.getByText('dev')).toBeDefined()
    expect(screen.getByText('—')).toBeDefined()
  })

  it('calls onReplay when row is clicked', () => {
    const onReplay = vi.fn()
    render(
      <HistoryList
        filteredEntries={sampleEntries}
        selectedHistoryId={null}
        onReplay={onReplay}
        isLoading={false}
        isError={false}
      />,
    )

    fireEvent.click(screen.getByRole('option', { name: /users/i }))
    expect(onReplay).toHaveBeenCalledWith(sampleEntries[0])
  })

  it('supports keyboard navigation and Enter to replay', () => {
    const onReplay = vi.fn()
    render(
      <HistoryList
        filteredEntries={sampleEntries}
        selectedHistoryId={null}
        onReplay={onReplay}
        isLoading={false}
        isError={false}
      />,
    )

    const listbox = screen.getByRole('listbox', { name: 'History' })
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onReplay).toHaveBeenCalled()
  })

  it('shows loading, error, and empty states while keeping scroll container mounted', () => {
    const scrollRef = { current: null as HTMLDivElement | null }
    const { rerender } = render(
      <HistoryList
        filteredEntries={[]}
        selectedHistoryId={null}
        onReplay={vi.fn()}
        scrollContainerRef={scrollRef}
        isLoading={true}
        isError={false}
      />,
    )
    expect(screen.getByText('Loading history…')).toBeDefined()
    expect(scrollRef.current).not.toBeNull()

    rerender(
      <HistoryList
        filteredEntries={[]}
        selectedHistoryId={null}
        onReplay={vi.fn()}
        scrollContainerRef={scrollRef}
        isLoading={false}
        isError={true}
      />,
    )
    expect(screen.getByText('Could not load history')).toBeDefined()
    expect(scrollRef.current).not.toBeNull()

    rerender(
      <HistoryList
        filteredEntries={[]}
        selectedHistoryId={null}
        onReplay={vi.fn()}
        scrollContainerRef={scrollRef}
        isLoading={false}
        isError={false}
        emptyMessage="No sent requests yet."
      />,
    )
    expect(screen.getByText('No sent requests yet.')).toBeDefined()
    expect(scrollRef.current).not.toBeNull()
  })
})
