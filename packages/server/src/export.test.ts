import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { SECRET_MASK, SECRET_SNIPPET_PLACEHOLDER } from '@reqor/shared-types'
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

describe('export snippet API', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-snippet-export-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  it('exports JavaScript snippet with env substitution and secret placeholder', async () => {
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
      url: '/api/export/snippet',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        language: 'javascript',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.language).toBe('javascript')
    expect(body.snippet).toContain('fetch(')
    expect(body.snippet).toContain('https://httpbin.dev/post')
    expect(body.snippet).toContain(SECRET_SNIPPET_PLACEHOLDER)
    expect(body.snippet).not.toContain('super-secret-token')
    expect(body.snippet).not.toContain(SECRET_MASK)

    await app.close()
  })

  it('exports Python snippet for the same request', async () => {
    const root = await createRepo({
      'demo.http': `POST https://httpbin.dev/post
Content-Type: application/json

{"name":"test"}`,
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/snippet',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        language: 'python',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.language).toBe('python')
    expect(body.snippet).toContain('import requests')
    expect(body.snippet).toContain('requests.post(')
    expect(body.snippet).toContain("json={'name': 'test'}")

    await app.close()
  })

  it('exports cURL tab snippet with SECRET_SNIPPET_PLACEHOLDER not SECRET_MASK', async () => {
    const root = await createRepo({
      'demo.http': `POST https://httpbin.dev/post
Authorization: Bearer {{token}}
Content-Type: application/json

{"name":"test"}`,
      'http-client.private.env.json': JSON.stringify({
        development: { token: 'super-secret-token' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/snippet',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        language: 'curl',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.snippet).toContain(SECRET_SNIPPET_PLACEHOLDER)
    expect(body.snippet).not.toContain(SECRET_MASK)
    expect(body.snippet).not.toContain('super-secret-token')

    await app.close()
  })

  it('applies draft overrides before snippet export', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/snippet',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        method: 'POST',
        url: 'https://httpbin.dev/post',
        headers: [{ name: 'Accept', value: 'application/json' }],
        body: { kind: 'json', content: '{"draft":true}' },
        language: 'javascript',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().snippet).toContain('https://httpbin.dev/post')
    expect(response.json().snippet).toContain("method: 'POST'")

    await app.close()
  })

  it('returns UNRESOLVED_VARIABLE 400 for snippet export', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://{{host}}/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/snippet',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: null,
        language: 'javascript',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('UNRESOLVED_VARIABLE')

    await app.close()
  })

  it('rejects invalid language via schema validation', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/snippet',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        language: 'go',
      },
    })

    expect(response.statusCode).not.toBe(200)
    expect(response.body).toMatch(/language/i)

    await app.close()
  })

  it('redacts secrets inside JSON body values', async () => {
    const root = await createRepo({
      'demo.http': `POST https://httpbin.dev/post
Content-Type: application/json

{"token":"{{secret}}"}`,
      'http-client.private.env.json': JSON.stringify({
        development: { secret: 'super-secret-token' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/export/snippet',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        language: 'javascript',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.snippet).toContain(SECRET_SNIPPET_PLACEHOLDER)
    expect(body.snippet).not.toContain('super-secret-token')

    await app.close()
  })

  it('exports form and raw body snippets', async () => {
    const root = await createRepo({
      'form.http': `POST https://httpbin.dev/post
Content-Type: application/x-www-form-urlencoded

a=b&c=d`,
      'raw.http': `POST https://httpbin.dev/post

plain text body`,
    })

    const app = await buildApp({ repositoryRoot: root })

    const formResponse = await app.inject({
      method: 'POST',
      url: '/api/export/snippet',
      payload: {
        collectionId: 'form.http',
        requestIndex: 0,
        language: 'javascript',
      },
    })
    expect(formResponse.statusCode).toBe(200)
    expect(formResponse.json().snippet).toContain("URLSearchParams('a=b&c=d')")

    const rawResponse = await app.inject({
      method: 'POST',
      url: '/api/export/snippet',
      payload: {
        collectionId: 'raw.http',
        requestIndex: 0,
        language: 'python',
      },
    })
    expect(rawResponse.statusCode).toBe(200)
    expect(rawResponse.json().snippet).toContain("data='plain text body'")

    await app.close()
  })
})
