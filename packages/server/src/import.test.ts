import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('import curl API', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-import-'))
    tempDirs.push(root)
    await fs.writeFile(path.join(root, 'demo.http'), 'GET https://example.com')
    return root
  }

  it('converts cURL to request DTO', async () => {
    const root = await createRepo()
    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/import/curl',
      payload: {
        curl: `curl -X POST 'https://api.example.com/users' -H 'Accept: application/json' -d '{"name":"test"}'`,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.request.method).toBe('POST')
    expect(body.request.url).toBe('https://api.example.com/users')
    expect(body.request.headers).toEqual([{ name: 'Accept', value: 'application/json' }])
    expect(body.request.body.content).toBe('{"name":"test"}')
    expect(body.warnings).toEqual([])
  })

  it('returns warnings for unsupported flags', async () => {
    const root = await createRepo()
    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/import/curl',
      payload: {
        curl: 'curl --cookie foo=bar https://api.example.com/path',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().warnings).toContain('Unsupported flag: --cookie')
  })

  it('returns 400 for empty curl', async () => {
    const root = await createRepo()
    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/import/curl',
      payload: { curl: '   ' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('INVALID_CURL')
  })

  it('returns 400 when no URL found', async () => {
    const root = await createRepo()
    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'POST',
      url: '/api/import/curl',
      payload: { curl: '-H "Accept: application/json"' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.message).toContain('No URL found')
  })
})
