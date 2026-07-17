import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DotenvStore } from './dotenv-store.js'
import { EnvResolver } from './env-resolver.js'
import { EnvironmentStore } from './environment-store.js'

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-resolver-'))
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, ...relativePath.split('/'))
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, contents, 'utf8')
  }
  return root
}

async function createResolver(files: Record<string, string>) {
  const root = await createTempRepo(files)
  const dotenvStore = new DotenvStore()
  const environmentStore = new EnvironmentStore()
  await Promise.all([dotenvStore.load(root), environmentStore.loadAll(root)])
  return { root, resolver: new EnvResolver(dotenvStore, environmentStore) }
}

describe('EnvResolver', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('resolveDotenv returns merged value', async () => {
    const { root, resolver } = await createResolver({
      '.env': 'API_KEY=secret-value',
    })
    tempDirs.push(root)

    expect(resolver.resolveDotenv('API_KEY')).toBe('secret-value')
    expect(resolver.resolveDotenv('  API_KEY  ')).toBe('secret-value')
    expect(resolver.resolveDotenv('MISSING')).toBeUndefined()
    expect(resolver.resolveDotenv('')).toBeUndefined()
  })

  it('resolveEnv prefers active environment then falls back to dotenv', async () => {
    const { root, resolver } = await createResolver({
      'http-client.env.json': JSON.stringify({
        development: { host: 'env-host', token: 'env-token' },
      }),
      '.env': 'host=dotenv-host\nAPI_KEY=dotenv-key',
    })
    tempDirs.push(root)

    expect(resolver.resolveEnv('host', 'development')).toBe('env-host')
    expect(resolver.resolveEnv('API_KEY', 'development')).toBe('dotenv-key')
    expect(resolver.resolveEnv('host', null)).toBeUndefined()
    expect(resolver.resolveEnv('host', 'missing-env')).toBeUndefined()
    expect(resolver.resolveEnv('missing', 'development')).toBeUndefined()
  })

  it('resolveBuiltin generates uuid, timestamp, and randomInt', async () => {
    const { root, resolver } = await createResolver({})
    tempDirs.push(root)

    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555')
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.42)

    expect(resolver.resolveBuiltin('uuid')).toBe('11111111-2222-3333-4444-555555555555')
    expect(resolver.resolveBuiltin('timestamp')).toBe('1700000000000')
    expect(resolver.resolveBuiltin('randomInt')).toBe('420')
  })

  it('getSecretValuesForRedaction includes dotenv and JetBrains isSecret values', async () => {
    const { root, resolver } = await createResolver({
      'http-client.env.json': JSON.stringify({
        development: { host: 'localhost', note: 'public' },
      }),
      'http-client.private.env.json': JSON.stringify({
        development: { token: 'secret-token' },
      }),
      '.env': 'A=alpha\nB=',
    })
    tempDirs.push(root)

    expect(resolver.getSecretValuesForRedaction()).toEqual(['alpha'])
    expect(resolver.getSecretValuesForRedaction('development').sort()).toEqual(
      ['alpha', 'secret-token'].sort(),
    )
  })
})
