import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.js'

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

const listPayload = {
  collections: [
    {
      id: 'demo.http',
      parseStatus: 'ok' as const,
      requestCount: 1,
      diagnostics: [],
    },
  ],
}

const detailPayload = {
  id: 'demo.http',
  content: '',
  parseStatus: 'ok' as const,
  requests: [
    {
      requestIndex: 0,
      fingerprint: 'd'.repeat(64),
      method: 'GET',
      url: 'https://httpbin.dev/get',
      headers: [],
    },
  ],
  diagnostics: [],
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/collections') {
          return Promise.resolve({
            ok: true,
            json: async () => listPayload,
          })
        }
        if (url === '/api/collections/demo.http') {
          return Promise.resolve({
            ok: true,
            json: async () => detailPayload,
          })
        }
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders app shell with accessible header, sidebar, and request placeholder', async () => {
    let resolveFetch: (value: unknown) => void = () => undefined
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve
    })

    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise))

    render(<App />, { wrapper: createWrapper() })

    expect(screen.getByRole('banner')).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Reqor' })).toBeDefined()
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeDefined()
    expect(screen.getByText('Select a request')).toBeDefined()
    expect(screen.getByRole('region', { name: 'Request' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Response' })).toBeDefined()
    expect(screen.getByTestId('sidebar-skeleton')).toBeDefined()

    resolveFetch({
      ok: true,
      json: async () => ({ collections: [] }),
    })

    await waitFor(() => {
      expect(screen.queryByTestId('sidebar-skeleton')).toBeNull()
    })
  })

  it('select request shows preview in workspace', async () => {
    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('tree')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /demo\.http/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }),
      ).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }))

    await waitFor(() => {
      expect(screen.queryByText('Select a request')).toBeNull()
      expect(
        within(screen.getByRole('region', { name: 'Request' })).getByText('GET'),
      ).toBeDefined()
    })
  })
})
