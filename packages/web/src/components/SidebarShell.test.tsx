import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const defaultProps = {
  selectedRequest: null,
  onSelectRequest: vi.fn(),
  onClearSelection: vi.fn(),
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

    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise))

    render(<SidebarShell {...defaultProps} />, { wrapper: createWrapper() })

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

    render(<SidebarShell {...defaultProps} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Could not load collections')).toBeDefined()
    })
    expect(screen.queryByTestId('sidebar-skeleton')).toBeNull()
  })

  it('shows Collections tab and empty state on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ collections: [] }),
      }),
    )

    render(<SidebarShell {...defaultProps} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(
        screen.getByText('No .http files found. Add one to the repo and refresh.'),
      ).toBeDefined()
    })
    expect(screen.getByRole('tab', { name: 'Collections', selected: true })).toBeDefined()
  })

  it('shows collection tree when collections exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          collections: [
            {
              id: 'demo.http',
              parseStatus: 'ok',
              requestCount: 1,
              diagnostics: [],
            },
          ],
        }),
      }),
    )

    render(<SidebarShell {...defaultProps} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'demo.http' })).toBeDefined()
    })
  })

  it('does not show skeleton during refresh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/collections/refresh') {
          return new Promise(() => undefined)
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            collections: [
              {
                id: 'demo.http',
                parseStatus: 'ok',
                requestCount: 0,
                diagnostics: [],
              },
            ],
          }),
        })
      }),
    )

    render(<SidebarShell {...defaultProps} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'demo.http' })).toBeDefined()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /refresh collections/i })[0]!)

    expect(screen.queryByTestId('sidebar-skeleton')).toBeNull()
    expect(screen.getByText('demo.http')).toBeDefined()
  })
})
