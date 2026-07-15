import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ collections: [] }),
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
})
