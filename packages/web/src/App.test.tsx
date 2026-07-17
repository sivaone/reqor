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

function createFetchMock(configState: { activeEnvironment: string | null }) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
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
    if (url === '/api/config' && (!init?.method || init.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ activeEnvironment: configState.activeEnvironment }),
      })
    }
    if (url === '/api/config' && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { activeEnvironment: string | null }
      configState.activeEnvironment = body.activeEnvironment
      return Promise.resolve({
        ok: true,
        json: async () => ({ activeEnvironment: configState.activeEnvironment }),
      })
    }
    if (url === '/api/collections/demo.http') {
      return Promise.resolve({
        ok: true,
        json: async () => detailPayload,
      })
    }
    if (url === '/api/preview' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { url?: string }
      const templateUrl = body.url ?? 'https://httpbin.dev/get'
      return Promise.resolve({
        ok: true,
        json: async () => ({
          url: templateUrl,
          headers: [],
          unresolved: null,
          hasVariables: templateUrl.includes('{{'),
        }),
      })
    }
    if (url === '/api/execute' && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => executePayload,
      })
    }
    return Promise.resolve({ ok: false, status: 404 })
  })
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createFetchMock({ activeEnvironment: null }))
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
        if (url === '/api/config') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ activeEnvironment: null }),
          })
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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', false)
    })
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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', false)
    })
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

  it('renders environment selector with names from API and no default selection', async () => {
    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.options).toHaveLength(3)
    })

    const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
    expect(selector.options[0]?.text).toBe('Select environment…')
    expect(selector.options[1]?.text).toBe('development')
    expect(selector.options[2]?.text).toBe('production')
    expect(selector.value).toBe('')
  })

  it('restores persisted environment from config on load', async () => {
    vi.stubGlobal('fetch', createFetchMock({ activeEnvironment: 'development' }))

    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.value).toBe('development')
    })
  })

  it('persists environment selection and shows toolbar label', async () => {
    const configState = { activeEnvironment: 'development' as string | null }
    vi.stubGlobal('fetch', createFetchMock(configState))

    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.value).toBe('development')
    })

    fireEvent.click(screen.getByRole('button', { name: /demo\.http/i }))
    fireEvent.click(await screen.findByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }))

    const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
    fireEvent.change(selector, { target: { value: 'production' } })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/config',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ activeEnvironment: 'production' }),
        }),
      )
      expect(screen.getByText('Environment: production')).toBeDefined()
    })
  })

  it('clears environment selection via blank option and hides toolbar label', async () => {
    const configState = { activeEnvironment: 'production' as string | null }
    vi.stubGlobal('fetch', createFetchMock(configState))

    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.value).toBe('production')
    })

    fireEvent.click(screen.getByRole('button', { name: /demo\.http/i }))
    fireEvent.click(await screen.findByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }))

    await waitFor(() => {
      expect(screen.getByText('Environment: production')).toBeDefined()
    })

    const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
    fireEvent.change(selector, { target: { value: '' } })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/config',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ activeEnvironment: null }),
        }),
      )
      expect(screen.queryByText('Environment: production')).toBeNull()
    })
  })

  it('shows unavailable option for stale persisted env, no toolbar label, no auto-PUT, and allows clear', async () => {
    const configState = { activeEnvironment: 'staging' as string | null }
    const fetchMock = createFetchMock(configState)
    vi.stubGlobal('fetch', fetchMock)

    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect([...selector.options].some((option) => option.text === 'Environment unavailable')).toBe(
        true,
      )
      expect(selector.value).toBe('__reqor_unavailable__')
    })

    fireEvent.click(screen.getByRole('button', { name: /demo\.http/i }))
    fireEvent.click(await screen.findByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }))

    expect(screen.queryByText(/Environment:/)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/config',
      expect.objectContaining({ method: 'PUT' }),
    )

    const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
    fireEvent.change(selector, { target: { value: '' } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/config',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ activeEnvironment: null }),
        }),
      )
      expect(selector.value).toBe('')
    })
  })

  it('shows failed config placeholder when config API fails to load', async () => {
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
            json: async () => environmentsPayload,
          })
        }
        if (url === '/api/config') {
          return Promise.resolve({ ok: false, status: 500 })
        }
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )

    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.disabled).toBe(true)
      expect(selector.options[0]?.text).toBe('Failed to load config')
    })
  })

  it('shows alert when environment PUT fails', async () => {
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
        if (url === '/api/config' && (!init?.method || init.method === 'GET')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ activeEnvironment: null }),
          })
        }
        if (url === '/api/config' && init?.method === 'PUT') {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              error: {
                code: 'INVALID_ENVIRONMENT',
                message: 'Environment not found',
                details: { name: 'production' },
              },
            }),
          })
        }
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )

    render(<App />, { wrapper: createWrapper() })

    await waitFor(() => {
      const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
      expect(selector.disabled).toBe(false)
    })

    const selector = screen.getByRole('combobox', { name: 'Environment' }) as HTMLSelectElement
    fireEvent.change(selector, { target: { value: 'production' } })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Environment not found')
    })
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
        if (url === '/api/config') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ activeEnvironment: null }),
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
        if (url === '/api/config') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ activeEnvironment: null }),
          })
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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', false)
    })

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://httpbin.dev/uuid' },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', false)
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

  it('blocks Ctrl+Enter when unresolved variables gate Send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/collections') {
          return Promise.resolve({ ok: true, json: async () => listPayload })
        }
        if (url === '/api/environments') {
          return Promise.resolve({ ok: true, json: async () => environmentsPayload })
        }
        if (url === '/api/config') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ activeEnvironment: null }),
          })
        }
        if (url === '/api/collections/demo.http') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ...detailPayload,
              requests: [
                {
                  requestIndex: 0,
                  fingerprint: 'd'.repeat(64),
                  method: 'GET',
                  url: 'https://{{host}}/get',
                  headers: [],
                },
              ],
            }),
          })
        }
        if (url === '/api/preview' && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              url: 'https://{{host}}/get',
              headers: [],
              unresolved: { name: 'host', raw: '{{host}}' },
              hasVariables: true,
            }),
          })
        }
        if (url === '/api/execute' && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => executePayload })
        }
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )

    render(<App />, { wrapper: createWrapper() })

    fireEvent.click(await screen.findByRole('button', { name: /demo\.http/i }))
    fireEvent.click(await screen.findByRole('button', { name: /\{\{host\}\}/i }))

    await waitFor(() => {
      expect(screen.getByText('Unresolved variable: {{host}}')).toBeDefined()
      expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', true)
    })

    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true })

    expect(fetch).not.toHaveBeenCalledWith(
      '/api/execute',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('allows Send after preview refresh fails when last result had no variables', async () => {
    let previewCalls = 0

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/collections') {
          return Promise.resolve({ ok: true, json: async () => listPayload })
        }
        if (url === '/api/environments') {
          return Promise.resolve({ ok: true, json: async () => environmentsPayload })
        }
        if (url === '/api/config') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ activeEnvironment: null }),
          })
        }
        if (url === '/api/collections/demo.http') {
          return Promise.resolve({ ok: true, json: async () => detailPayload })
        }
        if (url === '/api/preview' && init?.method === 'POST') {
          previewCalls += 1
          if (previewCalls === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                url: 'https://httpbin.dev/get',
                headers: [],
                unresolved: null,
                hasVariables: false,
              }),
            })
          }
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({
              error: { code: 'PROXY_FAILED', message: 'Failed to preview request' },
            }),
          })
        }
        if (url === '/api/execute' && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => executePayload })
        }
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )

    render(<App />, { wrapper: createWrapper() })

    fireEvent.click(await screen.findByRole('button', { name: /demo\.http/i }))
    fireEvent.click(await screen.findByRole('button', { name: /https:\/\/httpbin\.dev\/get/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', false)
    })

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://httpbin.dev/get?retry=1' },
    })

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/failed to preview request/i)
      expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', false)
    })
  })
})
