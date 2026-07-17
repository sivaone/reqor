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

const environmentsPayload = {
  environments: [
    {
      name: 'development',
      sourceFile: 'http-client.env.json',
      variables: [
        { key: 'host', value: 'localhost', isSecret: false },
      ],
    },
    {
      name: 'production',
      sourceFile: 'http-client.env.json',
      variables: [
        { key: 'host', value: 'example.com', isSecret: false },
      ],
    },
  ],
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
        if (url === '/api/environments') {
          return Promise.resolve({
            ok: true,
            json: async () => environmentsPayload,
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
    let resolveCollections: (value: unknown) => void = () => undefined
    let resolveEnvironments: (value: unknown) => void = () => undefined
    const collectionsPromise = new Promise((resolve) => {
      resolveCollections = resolve
    })
    const environmentsPromise = new Promise((resolve) => {
      resolveEnvironments = resolve
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/collections') {
          return collectionsPromise
        }
        if (url === '/api/environments') {
          return environmentsPromise
        }
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )

    render(<App />, { wrapper: createWrapper() })

    expect(screen.getByRole('banner')).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Reqor' })).toBeDefined()
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeDefined()
    expect(screen.getByText('Select a request')).toBeDefined()
    expect(screen.getByRole('region', { name: 'Request' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Response' })).toBeDefined()
    expect(screen.getByTestId('sidebar-skeleton')).toBeDefined()

    resolveCollections({
      ok: true,
      json: async () => ({ collections: [] }),
    })
    resolveEnvironments({
      ok: true,
      json: async () => ({ environments: [] }),
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

  it('renders environment selector with names from API', async () => {
    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.options).toHaveLength(2)
    })

    const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
    expect(selector.options[0]?.text).toBe('development')
    expect(selector.options[1]?.text).toBe('production')
    expect(selector.value).toBe('development')
  })

  it('shows empty environments placeholder when API returns none', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/collections') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ collections: [] }),
          })
        }
        if (url === '/api/environments') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ environments: [] }),
          })
        }
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )

    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.disabled).toBe(true)
      expect(selector.options[0]?.text).toBe('No environments')
    })
  })

  it('shows error placeholder when environments API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/collections') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ collections: [] }),
          })
        }
        if (url === '/api/environments') {
          return Promise.resolve({ ok: false, status: 500 })
        }
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )

    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.disabled).toBe(true)
      expect(selector.options[0]?.text).toBe('Failed to load environments')
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
