import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import type { EnvResolver } from './env-resolver.js'

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-app-dotenv-'))
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, ...relativePath.split('/'))
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, contents, 'utf8')
  }
  return root
}

describe('dotenv integration', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('loads dotenv store on app startup without exposing values via API', async () => {
    const root = await createTempRepo({
      '.env': 'API_KEY=super-secret',
      'http-client.env.json': JSON.stringify({ development: { host: 'localhost' } }),
    })
    tempDirs.push(root)

    const app = await buildApp({ repositoryRoot: root, scanOnStart: true })
    const resolver = (app as unknown as { envResolver: EnvResolver }).envResolver

    expect(resolver.resolveDotenv('API_KEY')).toBe('super-secret')

    const response = await app.inject({ method: 'GET', url: '/api/environments' })
    expect(response.statusCode).toBe(200)
    expect(response.body).not.toContain('super-secret')
  })

  it('loads dotenv even when scanOnStart is false', async () => {
    const root = await createTempRepo({
      '.env': 'TOKEN=from-dotenv',
    })
    tempDirs.push(root)

    const app = await buildApp({ repositoryRoot: root, scanOnStart: false })
    const resolver = (app as unknown as { envResolver: EnvResolver }).envResolver

    expect(resolver.resolveDotenv('TOKEN')).toBe('from-dotenv')
  })
})
