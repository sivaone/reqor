import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CollectionStore } from './collection-store.js'
import { toCollectionDetail } from './to-dto.js'
import { parseHttpFile } from '@reqor/http-parser'

describe('CollectionStore.save', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  it('rejects path-escaping collection ids before write', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-store-'))
    tempDirs.push(root)
    await fs.writeFile(path.join(root, 'demo.http'), 'GET https://api.example.com/demo')

    const store = new CollectionStore()
    await store.loadAll(root)

    const escapingId = '../outside.http'
    const collections = (
      store as unknown as { collections: Map<string, ReturnType<typeof toCollectionDetail>> }
    ).collections
    collections.set(
      escapingId,
      toCollectionDetail(escapingId, 'GET https://x', parseHttpFile('GET https://x')),
    )

    const result = await store.save(escapingId, 'POST https://x', root)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('WRITE_FAILED')
    expect(result.message).toMatch(/outside repository root/i)
  })
})
