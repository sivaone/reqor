import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHistoryDetail } from './useHistoryDetail.js'

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

const sampleDetail = {
  id: 1,
  sentAt: '2026-07-22T10:00:00.000Z',
  environmentName: 'dev',
  collectionId: 'demo.http',
  fingerprint: 'a'.repeat(64),
  method: 'GET',
  url: 'https://example.com',
  statusCode: 200,
  statusText: 'OK',
  durationMs: 42,
  sizeBytes: 100,
  responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
  body: '{}',
  bodyTruncated: false as const,
}

describe('useHistoryDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches history detail when id is provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleDetail,
      }),
    )

    const { result } = renderHook(() => useHistoryDetail(1), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(sampleDetail)
    expect(fetch).toHaveBeenCalledWith(
      '/api/history/1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('does not fetch when id is null', async () => {
    vi.stubGlobal('fetch', vi.fn())

    renderHook(() => useHistoryDetail(null), { wrapper: createWrapper() })

    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces error when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    )

    const { result } = renderHook(() => useHistoryDetail(99), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})
