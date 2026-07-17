import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DotenvStore } from './dotenv-store.js'
import { EnvResolver } from './env-resolver.js'

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-resolver-'))
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, ...relativePath.split('/'))
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, contents, 'utf8')
  }
  return root
}

describe('EnvResolver', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('resolveDotenv returns merged value', async () => {
    const root = await createTempRepo({
      '.env': 'API_KEY=secret-value',
    })
    tempDirs.push(root)

    const store = new DotenvStore()
    await store.load(root)
    const resolver = new EnvResolver(store)

    expect(resolver.resolveDotenv('API_KEY')).toBe('secret-value')
    expect(resolver.resolveDotenv('  API_KEY  ')).toBe('secret-value')
    expect(resolver.resolveDotenv('MISSING')).toBeUndefined()
    expect(resolver.resolveDotenv('')).toBeUndefined()
  })

  it('getSecretValuesForRedaction returns non-empty values', async () => {
    const root = await createTempRepo({
      '.env': 'A=alpha\nB=',
    })
    tempDirs.push(root)

    const store = new DotenvStore()
    await store.load(root)
    const resolver = new EnvResolver(store)

    expect(resolver.getSecretValuesForRedaction()).toEqual(['alpha'])
  })
})
