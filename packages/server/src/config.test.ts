import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('config API', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-config-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  it('GET returns null activeEnvironment when no config file exists', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({ method: 'GET', url: '/api/config' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ activeEnvironment: null })

    await app.close()
  })

  it('PUT persists activeEnvironment and restores on new app instance', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost' },
        production: { host: 'example.com' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const putResponse = await app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: { activeEnvironment: 'production' },
    })

    expect(putResponse.statusCode).toBe(200)
    expect(putResponse.json()).toEqual({ activeEnvironment: 'production' })

    const configPath = path.join(root, '.reqor', 'config.json')
    const disk = JSON.parse(await fs.readFile(configPath, 'utf8'))
    expect(disk).toEqual({ activeEnvironment: 'production' })

    await app.close()

    const reloaded = await buildApp({ repositoryRoot: root })
    const getResponse = await reloaded.inject({ method: 'GET', url: '/api/config' })

    expect(getResponse.statusCode).toBe(200)
    expect(getResponse.json()).toEqual({ activeEnvironment: 'production' })

    await reloaded.close()
  })

  it('PUT rejects unknown environment name with INVALID_ENVIRONMENT', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost' },
      }),
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: { activeEnvironment: 'unknown' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_ENVIRONMENT',
        message: 'Environment not found',
        details: { name: 'unknown' },
      },
    })

    await app.close()
  })

  it('PUT null clears persisted activeEnvironment', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost' },
      }),
      '.reqor/config.json': `${JSON.stringify({ activeEnvironment: 'development' }, null, 2)}\n`,
    })

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: { activeEnvironment: null },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ activeEnvironment: null })

    const disk = JSON.parse(await fs.readFile(path.join(root, '.reqor', 'config.json'), 'utf8'))
    expect(disk).toEqual({ activeEnvironment: null })

    await app.close()
  })

  it('loads invalid JSON and wrong-shape config as null without failing startup', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost' },
      }),
      '.reqor/config.json': '{ not json',
    })

    const app = await buildApp({ repositoryRoot: root })
    const invalidJson = await app.inject({ method: 'GET', url: '/api/config' })
    expect(invalidJson.json()).toEqual({ activeEnvironment: null })
    await app.close()

    await fs.writeFile(
      path.join(root, '.reqor', 'config.json'),
      JSON.stringify({ activeEnvironment: '' }),
    )

    const app2 = await buildApp({ repositoryRoot: root })
    const emptyString = await app2.inject({ method: 'GET', url: '/api/config' })
    expect(emptyString.json()).toEqual({ activeEnvironment: null })
    await app2.close()

    await fs.writeFile(
      path.join(root, '.reqor', 'config.json'),
      JSON.stringify({ activeEnvironment: 42, extraKey: 'ignored' }),
    )

    const app3 = await buildApp({ repositoryRoot: root })
    const wrongType = await app3.inject({ method: 'GET', url: '/api/config' })
    expect(wrongType.json()).toEqual({ activeEnvironment: null })
    await app3.close()
  })

  it('save rewrites disk file with known shape only', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost' },
      }),
      '.reqor/config.json': `${JSON.stringify(
        { activeEnvironment: 'development', port: 3000, theme: 'dark' },
        null,
        2,
      )}\n`,
    })

    const app = await buildApp({ repositoryRoot: root })
    await app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: { activeEnvironment: 'development' },
    })

    const disk = JSON.parse(await fs.readFile(path.join(root, '.reqor', 'config.json'), 'utf8'))
    expect(disk).toEqual({ activeEnvironment: 'development' })
    expect(disk).not.toHaveProperty('port')
    expect(disk).not.toHaveProperty('theme')

    await app.close()
  })

  it('loads config from disk even when scanOnStart is false', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost' },
      }),
      '.reqor/config.json': `${JSON.stringify({ activeEnvironment: 'development' }, null, 2)}\n`,
    })

    const app = await buildApp({ repositoryRoot: root, scanOnStart: false })
    const response = await app.inject({ method: 'GET', url: '/api/config' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ activeEnvironment: 'development' })

    await app.close()
  })
})
