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
      mutations: {
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
      requestCount: 2,
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
    {
      requestIndex: 1,
      fingerprint: 'e'.repeat(64),
      method: 'POST',
      url: 'https://httpbin.dev/post',
      headers: [],
    },
  ],
  diagnostics: [],
}

const executePayload = {
  status: 200,
  statusText: 'OK',
  headers: [{ name: 'content-type', value: 'application/json' }],
  body: '{"ok":true}',
  timingMs: 98,
  sizeBytes: 11,
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
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
        if (url === '/api/execute' && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => executePayload,
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

  it('select request shows request line in workspace', async () => {
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
        within(screen.getByRole('region', { name: 'Request' })).getByLabelText('Request URL'),
      ).toBeDefined()
    })
  })

  it('select request, send, and show response status bar', async () => {
    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('tree')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /demo\.http/i }))
    fireEvent.click(await screen.findByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }))
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => {
      expect(screen.getByText(/200 OK · 98 ms · 11 B/)).toBeDefined()
    })
  })

  it('clears prior response when selection changes', async () => {
    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('tree')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /demo\.http/i }))
    fireEvent.click(await screen.findByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }))
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => {
      expect(screen.getByText(/200 OK · 98 ms · 11 B/)).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /https:\/\/httpbin\.dev\/post/i }))

    await waitFor(() => {
      expect(screen.queryByText(/200 OK · 98 ms · 11 B/)).toBeNull()
      expect(screen.getByText('Response will appear here')).toBeDefined()
    })
  })

  it('Ctrl+Enter triggers send and Ctrl+S prevents default', async () => {
    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('tree')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /demo\.http/i }))
    fireEvent.click(await screen.findByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }))

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://httpbin.dev/uuid' },
    })
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByText(/200 OK · 98 ms · 11 B/)).toBeDefined()
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/execute',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"url":"https://httpbin.dev/uuid"'),
      }),
    )

    const saveEvent = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      cancelable: true,
    })
    const prevented = !document.dispatchEvent(saveEvent)
    expect(prevented).toBe(true)
  })
})
