import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DotenvStore } from './dotenv-store.js'

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-dotenv-'))
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, ...relativePath.split('/'))
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, contents, 'utf8')
  }
  return root
}

describe('DotenvStore', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('loads and merges .env variants with .env.local winning', async () => {
    const root = await createTempRepo({
      '.env': 'API_KEY=from-env\nHOST=localhost',
      '.env.staging': 'API_KEY=from-staging\nSTAGE=true',
      '.env.local': 'API_KEY=from-local',
    })
    tempDirs.push(root)

    const store = new DotenvStore()
    await store.load(root)

    expect(store.get('API_KEY')).toBe('from-local')
    expect(store.get('HOST')).toBe('localhost')
    expect(store.get('STAGE')).toBe('true')
  })

  it('applies .env.staging over .env when .env.local is absent', async () => {
    const root = await createTempRepo({
      '.env': 'TOKEN=base',
      '.env.staging': 'TOKEN=staging',
    })
    tempDirs.push(root)

    const store = new DotenvStore()
    await store.load(root)

    expect(store.get('TOKEN')).toBe('staging')
  })

  it('returns undefined for missing keys and skips absent files', async () => {
    const root = await createTempRepo({
      '.env': 'ONLY=1',
    })
    tempDirs.push(root)

    const store = new DotenvStore()
    await store.load(root)

    expect(store.get('ONLY')).toBe('1')
    expect(store.get('MISSING')).toBeUndefined()
    expect(store.has('MISSING')).toBe(false)
  })

  it('never writes to repo dotenv files', async () => {
    const root = await createTempRepo({
      '.env': 'API_KEY=original',
    })
    tempDirs.push(root)

    const store = new DotenvStore()
    await store.load(root)
    store.get('API_KEY')

    const onDisk = await fs.readFile(path.join(root, '.env'), 'utf8')
    expect(onDisk).toBe('API_KEY=original')
  })
})
