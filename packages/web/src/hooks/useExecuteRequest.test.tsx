import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExecuteRequestError, useExecuteRequest } from './useExecuteRequest.js'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useExecuteRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts ExecuteRequest and returns ExecuteResponse', async () => {
    const payload = {
      status: 200,
      statusText: 'OK',
      headers: [{ name: 'content-type', value: 'application/json' }],
      body: '{"ok":true}',
      timingMs: 42,
      sizeBytes: 11,
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      }),
    )

    const { result } = renderHook(() => useExecuteRequest(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      collectionId: 'demo.http',
      requestIndex: 0,
      followRedirects: true,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/execute',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          collectionId: 'demo.http',
          requestIndex: 0,
          followRedirects: true,
        }),
      }),
    )
    expect(result.current.data).toEqual(payload)
  })

  it('throws ExecuteRequestError for ApiErrorEnvelope responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          error: { code: 'PROXY_FAILED', message: 'fetch failed' },
        }),
      }),
    )

    const { result } = renderHook(() => useExecuteRequest(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      collectionId: 'demo.http',
      requestIndex: 0,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(ExecuteRequestError)
    expect((result.current.error as ExecuteRequestError).code).toBe('PROXY_FAILED')
  })

  it('throws when success response body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      }),
    )

    const { result } = renderHook(() => useExecuteRequest(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      collectionId: 'demo.http',
      requestIndex: 0,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(ExecuteRequestError)
    expect((result.current.error as ExecuteRequestError).message).toBe(
      'Invalid execute response',
    )
  })
})
