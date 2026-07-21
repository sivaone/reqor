import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncCollection } from './useSyncCollection.js'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

describe('useSyncCollection', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: 'GET https://example.com\n',
          parseStatus: 'ok',
          requests: [
            {
              requestIndex: 0,
              fingerprint: 'a'.repeat(64),
              method: 'GET',
              url: 'https://example.com',
              headers: [],
            },
          ],
          diagnostics: [],
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to nested collection sync URL and updates query cache', async () => {
    const { queryClient, Wrapper } = createWrapper()
    queryClient.setQueryData(['collection', 'http/users.http'], {
      id: 'http/users.http',
      content: 'old',
      parseStatus: 'ok',
      requests: [],
      diagnostics: [],
    })

    const { result } = renderHook(() => useSyncCollection(), {
      wrapper: Wrapper,
    })

    result.current.mutate({
      collectionId: 'http/users.http',
      body: { content: 'GET https://example.com\n' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(fetch).toHaveBeenCalledWith('/api/collections/http/users.http/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'GET https://example.com\n' }),
    })

    expect(queryClient.getQueryData(['collection', 'http/users.http'])).toMatchObject({
      content: 'GET https://example.com\n',
      parseStatus: 'ok',
    })
  })
})
