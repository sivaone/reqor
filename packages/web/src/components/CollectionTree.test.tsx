import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollectionTree } from './CollectionTree.js'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const summaryOk = {
  id: 'demo.http',
  parseStatus: 'ok' as const,
  requestCount: 1,
  diagnostics: [],
}

const summaryError = {
  id: 'bad.http',
  parseStatus: 'error' as const,
  requestCount: 0,
  diagnostics: [{ line: 2, message: 'Unexpected token' }],
}

const detailOk = {
  id: 'demo.http',
  content: '',
  parseStatus: 'ok' as const,
  requests: [
    {
      requestIndex: 0,
      fingerprint: 'b'.repeat(64),
      method: 'GET',
      url: 'https://httpbin.dev/get',
      headers: [],
    },
  ],
  diagnostics: [],
}

describe('CollectionTree', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders collection files', () => {
    render(
      <CollectionTree
        items={[{ summary: summaryOk, autoExpand: false }]}
        selectedRequest={null}
        onSelectRequest={() => undefined}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByRole('button', { name: 'demo.http' })).toBeDefined()
  })

  it('expands file and shows requests on click', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => detailOk,
      }),
    )

    render(
      <CollectionTree
        items={[{ summary: summaryOk, autoExpand: false }]}
        selectedRequest={null}
        onSelectRequest={() => undefined}
      />,
      { wrapper: createWrapper() },
    )

    fireEvent.click(screen.getByRole('button', { name: 'demo.http' }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'GET https://httpbin.dev/get' }),
      ).toBeDefined()
    })
  })

  it('selects request on click', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => detailOk,
      }),
    )

    const onSelectRequest = vi.fn()
    render(
      <CollectionTree
        items={[{ summary: summaryOk, autoExpand: true }]}
        selectedRequest={null}
        onSelectRequest={onSelectRequest}
      />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'GET https://httpbin.dev/get' }),
      ).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: 'GET https://httpbin.dev/get' }))

    expect(onSelectRequest).toHaveBeenCalledWith({
      collectionId: 'demo.http',
      requestIndex: 0,
      fingerprint: 'b'.repeat(64),
    })
  })

  it('shows parse error badge and diagnostic text when expanded', () => {
    render(
      <CollectionTree
        items={[{ summary: summaryError, autoExpand: false }]}
        selectedRequest={null}
        onSelectRequest={() => undefined}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('error')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'bad.http' }))
    expect(screen.getByText('Line 2: Unexpected token')).toBeDefined()
  })

  it('Enter on file toggles expand', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => detailOk,
      }),
    )

    render(
      <CollectionTree
        items={[{ summary: summaryOk, autoExpand: false }]}
        selectedRequest={null}
        onSelectRequest={() => undefined}
      />,
      { wrapper: createWrapper() },
    )

    const tree = screen.getByRole('tree')
    fireEvent.focus(tree)
    fireEvent.keyDown(tree, { key: 'Enter' })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'GET https://httpbin.dev/get' }),
      ).toBeDefined()
    })
  })

  it('ArrowDown to request and Enter selects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => detailOk,
      }),
    )

    const onSelectRequest = vi.fn()
    render(
      <CollectionTree
        items={[{ summary: summaryOk, autoExpand: true }]}
        selectedRequest={null}
        onSelectRequest={onSelectRequest}
      />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'GET https://httpbin.dev/get' }),
      ).toBeDefined()
    })

    const tree = screen.getByRole('tree')
    fireEvent.focus(tree)
    fireEvent.keyDown(tree, { key: 'ArrowDown' })
    fireEvent.keyDown(tree, { key: 'Enter' })

    await waitFor(() => {
      expect(onSelectRequest).toHaveBeenCalledWith({
        collectionId: 'demo.http',
        requestIndex: 0,
        fingerprint: 'b'.repeat(64),
      })
    })
  })
})
