import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { SECRET_MASK } from '@reqor/shared-types'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('preview API', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-preview-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  it('returns resolved URL/headers with hasVariables and redacted secrets', async () => {
    const root = await createRepo({
      'demo.http': `GET https://{{host}}/get
Authorization: Bearer {{token}}`,
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
      url: '/api/preview',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      url: 'https://httpbin.dev/get',
      headers: [{ name: 'Authorization', value: `Bearer ${SECRET_MASK}` }],
      unresolved: null,
      hasVariables: true,
    })
    expect(response.body).not.toContain('super-secret-token')

    await app.close()
  })

  it('returns hasVariables false for literal requests', async () => {
    const root = await createRepo({
      'literal.http': 'GET https://httpbin.dev/get',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/preview',
      payload: {
        collectionId: 'literal.http',
        requestIndex: 0,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      url: 'https://httpbin.dev/get',
      headers: [],
      unresolved: null,
      hasVariables: false,
    })

    await app.close()
  })

  it('returns unresolved for env-kind when no environment is selected', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://{{host}}/get',
      'http-client.env.json': JSON.stringify({
        development: { host: 'httpbin.dev' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/preview',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: null,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      unresolved: { name: 'host', raw: '{{host}}' },
      hasVariables: true,
    })

    await app.close()
  })

  it('uses config activeEnvironment when body omits environment', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://{{host}}/get',
      'http-client.env.json': JSON.stringify({
        development: { host: 'httpbin.dev' },
      }),
      '.reqor/config.json': JSON.stringify({ activeEnvironment: 'development' }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/preview',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      url: 'https://httpbin.dev/get',
      unresolved: null,
      hasVariables: true,
    })

    await app.close()
  })

  it('applies method/url overrides before resolution', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://{{host}}/get',
      'http-client.env.json': JSON.stringify({
        development: { host: 'httpbin.dev' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/preview',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        method: 'POST',
        url: 'https://{{host}}/post',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().url).toBe('https://httpbin.dev/post')

    await app.close()
  })

  it('applies header overrides and body null clear before resolution', async () => {
    const root = await createRepo({
      'demo.http': [
        'POST https://httpbin.dev/post',
        'Accept: text/plain',
        'Authorization: Bearer {{token}}',
        '',
        'disk-body',
      ].join('\n'),
      'http-client.env.json': JSON.stringify({
        development: { token: 'secret-token' },
      }),
      'http-client.private.env.json': JSON.stringify({
        development: { token: 'secret-token' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })

    const headerOverride = await app.inject({
      method: 'POST',
      url: '/api/preview',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        headers: [
          { name: 'Accept', value: 'application/json' },
          { name: 'X-Draft', value: '1' },
        ],
      },
    })
    expect(headerOverride.statusCode).toBe(200)
    expect(headerOverride.json().headers).toEqual([
      { name: 'Accept', value: 'application/json' },
      { name: 'X-Draft', value: '1' },
    ])

    const bodyClear = await app.inject({
      method: 'POST',
      url: '/api/preview',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        headers: [],
        body: null,
      },
    })
    expect(bodyClear.statusCode).toBe(200)
    expect(bodyClear.json().headers).toEqual([])

    const bodyOverride = await app.inject({
      method: 'POST',
      url: '/api/preview',
      payload: {
        collectionId: 'demo.http',
        requestIndex: 0,
        environment: 'development',
        headers: [{ name: 'Accept', value: 'text/plain' }],
        body: { kind: 'raw', content: 'hello {{unknownvar}}' },
      },
    })
    expect(bodyOverride.statusCode).toBe(200)
    expect(bodyOverride.json()).toMatchObject({
      hasVariables: true,
      unresolved: { name: 'unknownvar', raw: '{{unknownvar}}' },
    })

    await app.close()
  })
})
