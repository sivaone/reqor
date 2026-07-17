import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SECRET_MASK } from '@reqor/shared-types'
import { buildApp } from './app.js'

describe('environments API', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-environments-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  it('returns empty list when no env files exist', async () => {
    const root = await createRepo({
      'demo.http': 'GET https://example.com',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/environments' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ environments: [] })

    await app.close()
  })

  it('lists environments with redacted secret values', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost', username: '' },
      }),
      'http-client.private.env.json': JSON.stringify({
        development: { password: 'super-secret' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/environments' })
    const body = response.json()

    expect(response.statusCode).toBe(200)
    expect(body.environments).toHaveLength(1)
    expect(body.environments[0]).toMatchObject({
      name: 'development',
      sourceFile: 'http-client.env.json',
    })

    const variables = body.environments[0].variables
    expect(variables).toEqual(
      expect.arrayContaining([
        { key: 'host', value: 'localhost', isSecret: false },
        { key: 'username', value: '', isSecret: false },
        { key: 'password', value: SECRET_MASK, isSecret: true },
      ]),
    )

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('super-secret')

    await app.close()
  })

  it('uses later directory pair when environment names collide', async () => {
    const root = await createRepo({
      'a/http-client.env.json': JSON.stringify({
        development: { host: 'first-host' },
      }),
      'b/http-client.env.json': JSON.stringify({
        development: { host: 'second-host' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/environments' })
    const body = response.json()

    expect(body.environments).toHaveLength(1)
    expect(body.environments[0]).toMatchObject({
      name: 'development',
      sourceFile: 'b/http-client.env.json',
    })
    expect(body.environments[0].variables).toEqual([
      { key: 'host', value: 'second-host', isSecret: false },
    ])

    await app.close()
  })

  it('loads private-only env file pair', async () => {
    const root = await createRepo({
      'secrets/http-client.private.env.json': JSON.stringify({
        production: { token: 'hidden-token' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/environments' })
    const body = response.json()

    expect(body.environments[0]).toMatchObject({
      name: 'production',
      sourceFile: 'secrets/http-client.private.env.json',
    })
    expect(body.environments[0].variables[0]).toEqual({
      key: 'token',
      value: SECRET_MASK,
      isSecret: true,
    })
    expect(JSON.stringify(body)).not.toContain('hidden-token')

    await app.close()
  })

  it('returns empty list for invalid JSON without failing startup', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const root = await createRepo({
      'http-client.env.json': '{ not json',
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/environments' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ environments: [] })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[environments] http-client.env.json:'),
    )

    await app.close()
  })

  it('skips unreadable env files without failing startup', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const root = await createRepo({
      'good/http-client.env.json': JSON.stringify({
        development: { host: 'ok-host' },
      }),
      'bad/http-client.env.json': JSON.stringify({
        development: { host: 'bad-host' },
      }),
    })

    const realReadFile = fs.readFile.bind(fs)
    vi.spyOn(fs, 'readFile').mockImplementation(async (file, options) => {
      const filePath = String(file)
      if (filePath.includes(`${path.sep}bad${path.sep}`) || filePath.includes('/bad/')) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' })
      }
      return realReadFile(file, options as BufferEncoding)
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/environments' })
    const body = response.json()

    expect(response.statusCode).toBe(200)
    expect(body.environments).toEqual([
      {
        name: 'development',
        sourceFile: 'good/http-client.env.json',
        variables: [{ key: 'host', value: 'ok-host', isSecret: false }],
      },
    ])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to read'))

    await app.close()
  })
})
