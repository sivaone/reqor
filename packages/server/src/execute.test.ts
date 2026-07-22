import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SECRET_MASK } from '@reqor/shared-types'
import { buildApp } from './app.js'
import { HistoryStore } from './history-store.js'

describe('execute API', () => {
  const tempDirs: string[] = []
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-execute-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  function mockFetchResponse(
    init: {
      status?: number
      statusText?: string
      headers?: Record<string, string>
      body?: string
    } = {},
  ) {
    const headers = new Headers(init.headers ?? { 'content-type': 'application/json' })
    return {
      status: init.status ?? 200,
      statusText: init.statusText ?? 'OK',
      headers,
      text: async () => init.body ?? '{"ok":true}',
    }
  }

  it('proxies a successful request and returns ExecuteResponse shape', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    fetchMock.mockResolvedValue(
      mockFetchResponse({
        status: 200,
        statusText: 'OK',
        body: '{"origin":"127.0.0.1"}',
      }),
    )

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 200,
      statusText: 'OK',
      body: '{"origin":"127.0.0.1"}',
      timingMs: expect.any(Number),
      sizeBytes: expect.any(Number),
      headers: expect.arrayContaining([
        expect.objectContaining({ name: 'content-type' }),
      ]),
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://httpbin.dev/get',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      }),
    )

    const historyPath = path.join(root, '.reqor', 'history.db')
    await expect(fs.access(historyPath)).resolves.toBeUndefined()

    const history = await app.inject({ method: 'GET', url: '/api/history' })
    expect(history.statusCode).toBe(200)
    expect(history.json().total).toBe(1)
    expect(history.json().entries[0]).toMatchObject({
      method: 'GET',
      url: 'https://httpbin.dev/get',
      statusCode: 200,
      sizeBytes: expect.any(Number),
    })

    await app.close()
  })

  it('does not forward Host or Content-Length from stored headers', async () => {
    const root = await createRepo({
      'post.http': `POST https://httpbin.dev/post
Host: evil.example
Content-Length: 999
Content-Type: application/json

{"name":"reqor"}`,
    })

    fetchMock.mockResolvedValue(mockFetchResponse({ status: 200 }))

    const app = await buildApp({ repositoryRoot: root })
    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'post.http',
        requestIndex: 0,
      },
    })

    const [, fetchInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const outboundHeaders = fetchInit.headers as Headers
    expect(outboundHeaders.has('Host')).toBe(false)
    expect(outboundHeaders.has('host')).toBe(false)
    expect(outboundHeaders.has('Content-Length')).toBe(false)
    expect(outboundHeaders.get('Content-Type')).toBe('application/json')
    expect(fetchInit.body).toBe('{"name":"reqor"}')

    await app.close()
  })

  it('applies header override and body null clear from draft', async () => {
    const root = await createRepo({
      'post.http': `POST https://httpbin.dev/post
Accept: text/plain
Content-Type: application/json

{"name":"disk"}`,
    })

    fetchMock.mockResolvedValue(mockFetchResponse({ status: 200 }))

    const app = await buildApp({ repositoryRoot: root })

    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'post.http',
        requestIndex: 0,
        headers: [
          { name: 'Accept', value: 'application/json' },
          { name: 'X-Draft', value: 'yes' },
        ],
        body: { kind: 'raw', content: 'draft-body' },
      },
    })

    const [, overrideInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const overrideHeaders = overrideInit.headers as Headers
    expect(overrideHeaders.get('Accept')).toBe('application/json')
    expect(overrideHeaders.get('X-Draft')).toBe('yes')
    expect(overrideHeaders.get('Content-Type')).toBeNull()
    expect(overrideInit.body).toBe('draft-body')

    fetchMock.mockClear()
    fetchMock.mockResolvedValue(mockFetchResponse({ status: 200 }))

    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'post.http',
        requestIndex: 0,
        headers: [],
        body: null,
      },
    })

    const [, clearInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(clearInit.body).toBeUndefined()
    expect((clearInit.headers as Headers).get('Accept')).toBeNull()

    await app.close()
  })

  it('returns target HTTP 404 as success ExecuteResponse', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/missing',
    })

    fetchMock.mockResolvedValue(
      mockFetchResponse({
        status: 404,
        statusText: 'Not Found',
        body: 'not found',
      }),
    )

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 404,
      statusText: 'Not Found',
      body: 'not found',
    })

    const history = await app.inject({ method: 'GET', url: '/api/history' })
    expect(history.json().total).toBe(1)

    await app.close()
  })

  it('returns NOT_FOUND for missing collection and request index', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })

    const missingCollection = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'missing.http',
        requestIndex: 0,
      },
    })
    expect(missingCollection.statusCode).toBe(404)
    expect(missingCollection.json().error.code).toBe('NOT_FOUND')

    const missingIndex = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 99,
      },
    })
    expect(missingIndex.statusCode).toBe(404)
    expect(missingIndex.json().error.code).toBe('NOT_FOUND')

    const history = await app.inject({ method: 'GET', url: '/api/history' })
    expect(history.json().total).toBe(0)

    await app.close()
  })

  it('returns INVALID_REQUEST for non-http(s) URL override', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        url: 'file:///etc/passwd',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('INVALID_REQUEST')
    expect(fetchMock).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns first 302 without following when followRedirects is false', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/redirect/1',
    })

    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 302,
        statusText: 'Found',
        headers: { location: '/next' },
        body: '',
      }),
    )

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        followRedirects: false,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe(302)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await app.close()
  })

  it('follows relative Location across hops when followRedirects is true', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/start',
    })

    fetchMock
      .mockResolvedValueOnce(
        mockFetchResponse({
          status: 302,
          statusText: 'Found',
          headers: { location: '/hop-2' },
          body: '',
        }),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({
          status: 200,
          statusText: 'OK',
          body: '{"done":true}',
        }),
      )

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        followRedirects: true,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 200,
      body: '{"done":true}',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://httpbin.dev/hop-2')

    await app.close()
  })

  it('returns PROXY_FAILED on network error and health check still passes', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://unreachable.invalid/get',
    })

    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const app = await buildApp({ repositoryRoot: root })
    const executeResponse = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
      },
    })

    expect(executeResponse.statusCode).toBe(502)
    expect(executeResponse.json().error.code).toBe('PROXY_FAILED')

    const health = await app.inject({ method: 'GET', url: '/api/health' })
    expect(health.statusCode).toBe(200)

    await app.close()
  })

  it('returns INVALID_REQUEST for empty or unknown method override', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })

    const emptyMethod = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        method: '',
      },
    })
    expect(emptyMethod.statusCode).toBe(400)
    expect(emptyMethod.json().error.code).toBe('INVALID_REQUEST')

    const badMethod = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        method: 'TRACE',
      },
    })
    expect(badMethod.statusCode).toBe(400)
    expect(badMethod.json().error.code).toBe('INVALID_REQUEST')
    expect(fetchMock).not.toHaveBeenCalled()

    await app.close()
  })

  it('downgrades POST to GET and drops body on 302 redirect', async () => {
    const root = await createRepo({
      'post.http': `POST https://httpbin.dev/post
Content-Type: application/json

{"name":"reqor"}`,
    })

    fetchMock
      .mockResolvedValueOnce(
        mockFetchResponse({
          status: 302,
          statusText: 'Found',
          headers: { location: '/landed' },
          body: '',
        }),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({
          status: 200,
          statusText: 'OK',
          body: '{"ok":true}',
        }),
      )

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'post.http',
        requestIndex: 0,
        followRedirects: true,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', body: '{"name":"reqor"}' }),
    )
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://httpbin.dev/landed')
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'GET', body: undefined }),
    )

    const history = await app.inject({ method: 'GET', url: '/api/history' })
    expect(history.json().entries[0]).toMatchObject({
      method: 'POST',
      url: 'https://httpbin.dev/post',
    })

    await app.close()
  })

  it('returns TOO_MANY_REDIRECTS after 10 hops', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/start',
    })

    for (let hop = 0; hop < 11; hop++) {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          status: 302,
          statusText: 'Found',
          headers: { location: `/hop-${hop + 1}` },
          body: '',
        }),
      )
    }

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        followRedirects: true,
      },
    })

    expect(response.statusCode).toBe(502)
    expect(response.json().error.code).toBe('TOO_MANY_REDIRECTS')
    expect(fetchMock).toHaveBeenCalledTimes(11)

    await app.close()
  })

  it('returns INVALID_REQUEST for malformed redirect Location', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/start',
    })

    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 302,
        statusText: 'Found',
        headers: { location: 'http://[' },
        body: '',
      }),
    )

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        followRedirects: true,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('INVALID_REQUEST')

    await app.close()
  })

  it('resolves {{host}} before proxying when environment is selected', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://{{host}}/get',
      'http-client.env.json': JSON.stringify({
        development: { host: 'httpbin.dev' },
      }),
    })

    fetchMock.mockResolvedValue(mockFetchResponse({ status: 200 }))

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://httpbin.dev/get',
      expect.objectContaining({ method: 'GET' }),
    )

    await app.close()
  })

  it('resolves body placeholders on execute', async () => {
    const root = await createRepo({
      'post.http': `POST https://httpbin.dev/post
Content-Type: application/json

{"token":"{{$dotenv API_KEY}}"}`,
      '.env': 'API_KEY=body-secret',
    })

    fetchMock.mockResolvedValue(mockFetchResponse({ status: 200 }))

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'post.http',
        requestIndex: 0,
        environment: null,
      },
    })

    expect(response.statusCode).toBe(200)
    const [, fetchInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(fetchInit.body).toBe('{"token":"body-secret"}')

    await app.close()
  })

  it('returns UNRESOLVED_VARIABLE 400 when env placeholder cannot resolve', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://{{host}}/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: null,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: {
        code: 'UNRESOLVED_VARIABLE',
        message: 'Unresolved variable: {{host}}',
        details: { name: 'host', raw: '{{host}}' },
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()

    const history = await app.inject({ method: 'GET', url: '/api/history' })
    expect(history.json().total).toBe(0)

    await app.close()
  })

  it('honors followRedirects with resolved URLs', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://{{host}}/start',
      'http-client.env.json': JSON.stringify({
        development: { host: 'httpbin.dev' },
      }),
    })

    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 302,
        statusText: 'Found',
        headers: { location: '/next' },
        body: '',
      }),
    )

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        followRedirects: false,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe(302)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://httpbin.dev/start')

    await app.close()
  })

  it('redacts secrets from history storage and API', async () => {
    const root = await createRepo({
      'demo.http': `GET https://{{host}}/get?key={{$dotenv API_KEY}}
Authorization: Bearer {{$dotenv API_KEY}}`,
      'http-client.env.json': JSON.stringify({
        development: { host: 'httpbin.dev' },
      }),
      '.env': 'API_KEY=super-secret-token',
    })

    fetchMock.mockResolvedValue(
      mockFetchResponse({
        body: '{"token":"super-secret-token"}',
        statusText: 'OK super-secret-token',
      }),
    )

    const app = await buildApp({ repositoryRoot: root })
    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
      },
    })

    const history = await app.inject({ method: 'GET', url: '/api/history' })
    const entry = history.json().entries[0]
    expect(entry.url).not.toContain('super-secret-token')
    expect(entry.url).toContain(SECRET_MASK)
    expect(entry.body).not.toContain('super-secret-token')
    expect(entry.body).toContain(SECRET_MASK)

    const dbPath = path.join(root, '.reqor', 'history.db')
    const store = new HistoryStore(dbPath)
    const row = store.getById(entry.id)
    expect(row?.url).not.toContain('super-secret-token')
    expect(row?.responseBody).not.toContain('super-secret-token')
    expect(row?.statusText).not.toContain('super-secret-token')
    expect(row?.statusText).toContain(SECRET_MASK)
    store.close()

    await app.close()
  })

  it('does not insert history on PROXY_FAILED', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://unreachable.invalid/get',
    })

    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const app = await buildApp({ repositoryRoot: root })
    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { collectionId: 'demo.http', requestIndex: 0 },
    })

    const history = await app.inject({ method: 'GET', url: '/api/history' })
    expect(history.json().total).toBe(0)

    await app.close()
  })

  it('still returns execute response when history insert fails', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    fetchMock.mockResolvedValue(mockFetchResponse())

    const app = await buildApp({ repositoryRoot: root })

    const originalInsert = HistoryStore.prototype.insert
    HistoryStore.prototype.insert = function insertMock() {
      throw new Error('simulated history failure')
    }

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/execute',
        payload: { collectionId: 'demo.http', requestIndex: 0 },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ status: 200 })
    } finally {
      HistoryStore.prototype.insert = originalInsert
    }

    await app.close()
  })

  it('records pre-redirect URL after redirect follow', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/start',
      'http-client.env.json': JSON.stringify({
        development: { host: 'httpbin.dev' },
      }),
    })

    fetchMock
      .mockResolvedValueOnce(
        mockFetchResponse({
          status: 302,
          statusText: 'Found',
          headers: { location: '/hop-2' },
          body: '',
        }),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({
          status: 200,
          statusText: 'OK',
          body: '{"done":true}',
        }),
      )

    const app = await buildApp({ repositoryRoot: root })
    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        followRedirects: true,
      },
    })

    const history = await app.inject({ method: 'GET', url: '/api/history' })
    expect(history.json().entries[0]).toMatchObject({
      method: 'GET',
      url: 'https://httpbin.dev/start',
    })

    await app.close()
  })
})
