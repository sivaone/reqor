import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('collections API', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-collections-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  it('lists collections with ids, counts, and parse status', async () => {
    const root = await createRepo({
      'http/users.http': 'GET https://api.example.com/users',
      'http/items.http': `GET https://api.example.com/items

###

POST https://api.example.com/items`,
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/collections' })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.collections).toHaveLength(2)
    expect(body.collections.map((c: { id: string }) => c.id)).toEqual([
      'http/items.http',
      'http/users.http',
    ])
    expect(body.collections.find((c: { id: string }) => c.id === 'http/users.http')).toEqual(
      {
        id: 'http/users.http',
        parseStatus: 'ok',
        requestCount: 1,
        diagnostics: [],
      },
    )
    expect(body.collections.find((c: { id: string }) => c.id === 'http/items.http')).toMatchObject(
      {
        requestCount: 2,
        parseStatus: 'ok',
      },
    )

    await app.close()
  })

  it('returns collection detail with requestIndex and fingerprint', async () => {
    const root = await createRepo({
      'http/users.http': `GET https://api.example.com/users

###

POST https://api.example.com/users`,
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'GET',
      url: '/api/collections/http/users.http',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.id).toBe('http/users.http')
    expect(body.requests).toHaveLength(2)
    expect(body.requests[0].requestIndex).toBe(0)
    expect(body.requests[1].requestIndex).toBe(1)
    expect(body.requests[0].fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(body.requests[0].fingerprint).not.toBe(body.requests[1].fingerprint)

    await app.close()
  })

  it('isolates parse errors without blocking other collections', async () => {
    const root = await createRepo({
      'valid.http': 'GET https://api.example.com/valid',
      'invalid.http': 'NOT_A_VALID_REQUEST',
    })

    const app = await buildApp({ repositoryRoot: root })
    const listResponse = await app.inject({ method: 'GET', url: '/api/collections' })
    const invalidResponse = await app.inject({
      method: 'GET',
      url: '/api/collections/invalid.http',
    })
    const validResponse = await app.inject({
      method: 'GET',
      url: '/api/collections/valid.http',
    })

    expect(listResponse.json().collections).toHaveLength(2)
    expect(invalidResponse.json()).toMatchObject({
      id: 'invalid.http',
      parseStatus: 'error',
      requests: [],
    })
    expect(invalidResponse.json().diagnostics[0]).toMatchObject({
      line: expect.any(Number),
      message: expect.any(String),
    })
    expect(validResponse.json()).toMatchObject({
      id: 'valid.http',
      parseStatus: 'ok',
      requests: [{ method: 'GET' }],
    })

    await app.close()
  })

  it('refreshes collections after files are added on disk', async () => {
    const root = await createRepo({
      'first.http': 'GET https://api.example.com/first',
    })

    const app = await buildApp({ repositoryRoot: root })

    const initial = await app.inject({ method: 'GET', url: '/api/collections' })
    expect(initial.json().collections).toHaveLength(1)

    await fs.writeFile(
      path.join(root, 'second.http'),
      'GET https://api.example.com/second',
    )

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/collections/refresh',
    })

    expect(refresh.statusCode).toBe(200)
    expect(refresh.json().collections).toHaveLength(2)
    expect(refresh.json().collections.map((c: { id: string }) => c.id)).toEqual([
      'first.http',
      'second.http',
    ])

    await app.close()
  })

  it('returns 404 error envelope for unknown collection id', async () => {
    const root = await createRepo({})
    const app = await buildApp({ repositoryRoot: root })

    const response = await app.inject({
      method: 'GET',
      url: '/api/collections/missing.http',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Collection not found',
        details: { id: 'missing.http' },
      },
    })

    await app.close()
  })

  it('syncs nested collection id with visual patch without writing disk', async () => {
    const root = await createRepo({
      'http/users.http': `# keep
GET https://api.example.com/users
Accept: application/json

###

POST https://api.example.com/users
`,
    })
    const app = await buildApp({ repositoryRoot: root })

    const response = await app.inject({
      method: 'POST',
      url: '/api/collections/http/users.http/sync',
      payload: {
        content: `# keep
GET https://api.example.com/users
Accept: application/json

###

POST https://api.example.com/users
`,
        requestIndex: 0,
        patch: {
          method: 'GET',
          url: 'https://api.example.com/users?limit=5',
          headers: [{ name: 'Accept', value: 'application/json' }],
          body: null,
        },
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.parseStatus).toBe('ok')
    expect(body.content).toContain('users?limit=5')
    expect(body.content).toContain('# keep')
    expect(body.content).toContain('POST https://api.example.com/users')
    expect(body.requests[0].url).toBe('https://api.example.com/users?limit=5')

    const onDisk = await fs.readFile(path.join(root, 'http', 'users.http'), 'utf8')
    expect(onDisk).not.toContain('limit=5')

    await app.close()
  })

  it('returns INVALID_REQUEST_INDEX for sync patch with bad index', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://api.example.com/demo',
    })
    const app = await buildApp({ repositoryRoot: root })

    const response = await app.inject({
      method: 'POST',
      url: '/api/collections/demo.http/sync',
      payload: {
        content: 'GET https://api.example.com/demo',
        requestIndex: 3,
        patch: {
          method: 'GET',
          url: 'https://api.example.com/demo',
          headers: [],
        },
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      error: { code: 'INVALID_REQUEST_INDEX' },
    })

    await app.close()
  })

  it('retrieves collection ids containing literal percent escapes', async () => {
    const root = await createRepo({
      'literal%2Fname.http': 'GET https://api.example.com/literal',
    })
    const app = await buildApp({ repositoryRoot: root })

    const response = await app.inject({
      method: 'GET',
      url: '/api/collections/literal%252Fname.http',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().id).toBe('literal%2Fname.http')

    await app.close()
  })

  it('returns an error envelope and preserves the snapshot when refresh fails', async () => {
    const root = await createRepo({
      'stable.http': 'GET https://api.example.com/stable',
    })
    const app = await buildApp({ repositoryRoot: root })
    await fs.mkdir(path.join(root, '.gitignore'))

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/collections/refresh',
    })
    const list = await app.inject({ method: 'GET', url: '/api/collections' })

    expect(refresh.statusCode).toBe(500)
    expect(refresh.json()).toEqual({
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh collections',
      },
    })
    expect(list.json().collections).toMatchObject([{ id: 'stable.http' }])

    await app.close()
  })

  it('does not scan node_modules or gitignored paths', async () => {
    const root = await createRepo({
      '.gitignore': 'ignored/\n',
      'visible.http': 'GET https://api.example.com/visible',
      'node_modules/pkg/hidden.http': 'GET https://api.example.com/hidden',
      'ignored/hidden.http': 'GET https://api.example.com/ignored',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/collections' })

    expect(response.json().collections).toEqual([
      {
        id: 'visible.http',
        parseStatus: 'ok',
        requestCount: 1,
        diagnostics: [],
      },
    ])

    await app.close()
  })

  it('refreshes 100 files within 3 seconds (NFR3)', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [
        `bulk/file-${index}.http`,
        `GET https://api.example.com/resource-${index}`,
      ]),
    )
    const root = await createRepo(files)

    const app = await buildApp({ repositoryRoot: root, scanOnStart: false })
    const started = performance.now()
    const response = await app.inject({
      method: 'POST',
      url: '/api/collections/refresh',
    })
    const elapsed = performance.now() - started

    expect(response.statusCode).toBe(200)
    expect(response.json().collections).toHaveLength(100)
    expect(elapsed).toBeLessThan(3000)

    await app.close()
  })
})
