import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from './app.js'

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
})
