import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { SECRET_MASK } from '@reqor/shared-types'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('export curl API', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-export-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  it('exports resolved cURL with env substitution and secret masking', async () => {
    const root = await createRepo({
      'demo.http': `POST https://{{host}}/post
Authorization: Bearer {{token}}
Content-Type: application/json

{"name":"test"}`,
      'http-client.env.json': JSON.stringify({
        development: { host: 'httpbin.dev' },
      }),
      'http-client.private.env.json': JSON.stringify({
        development: { token: 'super-secret-token' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/curl',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
      },
    })

    expect(response.statusCode).toBe(200)
    const { curl } = response.json()
    expect(curl).toContain('https://httpbin.dev/post')
    expect(curl).toContain(`Bearer ${SECRET_MASK}`)
    expect(curl).toContain('--json')
    expect(curl).toContain('{"name":"test"}')
    expect(curl).not.toContain('super-secret-token')
    expect(curl).not.toContain('Content-Type: application/json')

    await app.close()
  })

  it('applies draft overrides before export', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/curl',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        method: 'POST',
        url: 'https://httpbin.dev/post',
        headers: [{ name: 'Accept', value: 'application/json' }],
        body: { kind: 'json', content: '{"draft":true}' },
      },
    })

    expect(response.statusCode).toBe(200)
    const { curl } = response.json()
    expect(curl).toContain('-X POST')
    expect(curl).toContain('https://httpbin.dev/post')
    expect(curl).toContain(`--json '{"draft":true}'`)

    await app.close()
  })

  it('redacts secrets in body content', async () => {
    const root = await createRepo({
      'post.http': `POST https://httpbin.dev/post
Content-Type: application/json

{"token":"{{$dotenv API_KEY}}"}`,
      '.env': 'API_KEY=body-secret',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/curl',
      payload: {
        collectionId: 'post.http',
        requestIndex: 0,
        environment: null,
      },
    })

    expect(response.statusCode).toBe(200)
    const { curl } = response.json()
    expect(curl).toContain(SECRET_MASK)
    expect(curl).not.toContain('body-secret')

    await app.close()
  })

  it('returns UNRESOLVED_VARIABLE 400 when env placeholder cannot resolve', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://{{host}}/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/curl',
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

    await app.close()
  })

  it('returns 404 when collection is missing', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/curl',
      payload: {
        collectionId: 'missing.http',
        requestIndex: 0,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('NOT_FOUND')

    await app.close()
  })

  it('returns 400 for empty collection', async () => {
    const root = await createRepo({
      'empty.http': '',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/curl',
      payload: {
        collectionId: 'empty.http',
        requestIndex: 0,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('INVALID_REQUEST')
    expect(response.json().error.message).toBe('Collection has no requests')

    await app.close()
  })
})
