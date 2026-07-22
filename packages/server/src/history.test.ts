import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HISTORY_BODY_DISPLAY_LIMIT } from './constants.js'
import { buildApp } from './app.js'
import { HistoryStore } from './history-store.js'

describe('history API', () => {
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
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-history-api-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  function mockFetchResponse(body = '{"ok":true}') {
    return {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => body,
    }
  }

  it('GET /api/history returns entries newest first after execute', async () => {
    const root = await createRepo({
      'a.http': 'GET https://httpbin.dev/a',
      'b.http': 'GET https://httpbin.dev/b',
    })

    fetchMock.mockResolvedValue(mockFetchResponse())

    const app = await buildApp({ repositoryRoot: root })

    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { collectionId: 'a.http', requestIndex: 0 },
    })

    await new Promise((resolve) => setTimeout(resolve, 5))

    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { collectionId: 'b.http', requestIndex: 0 },
    })

    const list = await app.inject({ method: 'GET', url: '/api/history' })
    expect(list.statusCode).toBe(200)

    const body = list.json()
    expect(body.total).toBe(2)
    expect(body.entries).toHaveLength(2)
    expect(body.entries[0]?.collectionId).toBe('b.http')
    expect(body.entries[1]?.collectionId).toBe('a.http')

    await app.close()
  })

  it('GET /api/history/:id returns full detail body', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    fetchMock.mockResolvedValue(mockFetchResponse('{"detail":true}'))

    const app = await buildApp({ repositoryRoot: root })

    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { collectionId: 'demo.http', requestIndex: 0 },
    })

    const list = await app.inject({ method: 'GET', url: '/api/history' })
    const id = list.json().entries[0]?.id

    const detail = await app.inject({ method: 'GET', url: `/api/history/${id}` })
    expect(detail.statusCode).toBe(200)
    expect(detail.json()).toMatchObject({
      body: '{"detail":true}',
      bodyTruncated: false,
      statusCode: 200,
      responseHeaders: expect.any(Array),
    })

    await app.close()
  })

  it('returns 404 for unknown history id', async () => {
    const root = await createRepo({})
    const app = await buildApp({ repositoryRoot: root })

    const response = await app.inject({ method: 'GET', url: '/api/history/999' })
    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('NOT_FOUND')

    await app.close()
  })

  it('returns 400 for non-numeric history id', async () => {
    const root = await createRepo({})
    const app = await buildApp({ repositoryRoot: root })

    const response = await app.inject({ method: 'GET', url: '/api/history/abc' })
    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('truncates list body at 1MB UTF-8 but detail returns full body', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const largeBody = 'x'.repeat(HISTORY_BODY_DISPLAY_LIMIT + 1)
    fetchMock.mockResolvedValue(mockFetchResponse(largeBody))

    const app = await buildApp({ repositoryRoot: root })

    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { collectionId: 'demo.http', requestIndex: 0 },
    })

    const list = await app.inject({ method: 'GET', url: '/api/history' })
    const entry = list.json().entries[0]
    expect(entry.bodyTruncated).toBe(true)
    expect(new TextEncoder().encode(entry.body).length).toBe(HISTORY_BODY_DISPLAY_LIMIT)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/history/${entry.id}`,
    })
    expect(detail.json().body).toBe(largeBody)
    expect(detail.json().bodyTruncated).toBe(false)

    await app.close()
  })

  it('survives server restart', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    fetchMock.mockResolvedValue(mockFetchResponse())

    const app = await buildApp({ repositoryRoot: root })
    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { collectionId: 'demo.http', requestIndex: 0 },
    })
    await app.close()

    const reloaded = await buildApp({ repositoryRoot: root })
    const list = await reloaded.inject({ method: 'GET', url: '/api/history' })
    expect(list.json().total).toBe(1)
    await reloaded.close()
  })

  it('does not create history.db before first successful send', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const dbPath = path.join(root, '.reqor', 'history.db')

    await expect(fs.access(dbPath)).rejects.toThrow()

    const emptyList = await app.inject({ method: 'GET', url: '/api/history' })
    expect(emptyList.statusCode).toBe(200)
    expect(emptyList.json()).toEqual({ entries: [], total: 0 })
    await expect(fs.access(dbPath)).rejects.toThrow()

    const missing = await app.inject({ method: 'GET', url: '/api/history/999' })
    expect(missing.statusCode).toBe(404)
    await expect(fs.access(dbPath)).rejects.toThrow()

    fetchMock.mockResolvedValue(mockFetchResponse())
    await app.inject({
      method: 'POST',
      url: '/api/execute',
      payload: { collectionId: 'demo.http', requestIndex: 0 },
    })

    await expect(fs.access(dbPath)).resolves.toBeUndefined()
    await app.close()
  })
})

describe('HistoryStore direct insert for list ordering', () => {
  it('getById returns null for missing row without creating the db file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-history-missing-'))
    const dbPath = path.join(root, '.reqor', 'history.db')
    const store = new HistoryStore(dbPath)
    expect(store.getById(1)).toBeNull()
    expect(store.list()).toEqual([])
    await expect(fs.access(dbPath)).rejects.toThrow()
    store.close()
    await fs.rm(root, { recursive: true, force: true })
  })
})
