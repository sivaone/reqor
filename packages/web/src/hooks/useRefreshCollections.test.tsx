import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRefreshCollections } from './useRefreshCollections.js'

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useRefreshCollections', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sets collections query data with full envelope and invalidates detail queries', async () => {
    const payload = {
      collections: [
        {
          id: 'demo.http',
          parseStatus: 'ok' as const,
          requestCount: 1,
          diagnostics: [],
        },
      ],
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      }),
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['collection', 'demo.http'], { id: 'demo.http' })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRefreshCollections(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({})
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/collections/refresh',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(queryClient.getQueryData(['collections'])).toEqual(payload)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['collection'] })
  })

  it('surfaces error when refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(() => useRefreshCollections(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      try {
        await result.current.mutateAsync({})
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
