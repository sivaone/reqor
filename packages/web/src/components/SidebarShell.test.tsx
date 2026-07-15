import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SidebarShell } from './SidebarShell.js'

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

describe('SidebarShell collections load', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows skeleton while pending then clears on success', async () => {
    let resolveFetch: (value: unknown) => void = () => undefined
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(fetchPromise),
    )

    render(<SidebarShell />, { wrapper: createWrapper() })

    expect(screen.getByTestId('sidebar-skeleton')).toBeDefined()
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThanOrEqual(4)

    resolveFetch({
      ok: true,
      json: async () => ({ collections: [] }),
    })

    await waitFor(() => {
      expect(screen.queryByTestId('sidebar-skeleton')).toBeNull()
    })
  })

  it('shows muted error when collections fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    )

    render(<SidebarShell />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Could not load collections')).toBeDefined()
    })
    expect(screen.queryByTestId('sidebar-skeleton')).toBeNull()
  })
})
