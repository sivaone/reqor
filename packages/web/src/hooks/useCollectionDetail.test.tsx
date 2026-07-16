import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCollectionDetail } from './useCollectionDetail.js'

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

describe('useCollectionDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches nested path without encoding entire id and passes AbortSignal', async () => {
    const payload = {
      id: 'http/users.http',
      content: '',
      parseStatus: 'ok',
      requests: [],
      diagnostics: [],
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      }),
    )

    const { result } = renderHook(() => useCollectionDetail('http/users.http'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/collections/http/users.http',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(result.current.data).toEqual(payload)
  })

  it('surfaces NOT_FOUND as query error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: { code: 'NOT_FOUND', message: 'Not found', details: { id: 'missing.http' } },
        }),
      }),
    )

    const { result } = renderHook(() => useCollectionDetail('missing.http'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
