import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { HISTORY_MAX_ENTRIES } from './constants.js'
import { HistoryStore, type HistoryInsertInput } from './history-store.js'

describe('HistoryStore', () => {
  const tempDirs: string[] = []
  const openStores: HistoryStore[] = []

  afterEach(async () => {
    for (const store of openStores.splice(0)) {
      store.close()
    }
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createStore() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-history-'))
    tempDirs.push(root)
    const store = new HistoryStore(path.join(root, '.reqor', 'history.db'))
    openStores.push(store)
    return store
  }

  function sampleEntry(overrides: Partial<HistoryInsertInput> = {}): HistoryInsertInput {
    return {
      sentAt: new Date().toISOString(),
      environmentName: 'development',
      collectionId: 'demo.http',
      fingerprint: 'a'.repeat(64),
      method: 'GET',
      url: 'https://httpbin.dev/get',
      statusCode: 200,
      statusText: 'OK',
      durationMs: 42.5,
      sizeBytes: 12,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      responseBody: '{"ok":true}',
      ...overrides,
    }
  }

  it('inserts and lists entries newest first', async () => {
    const store = await createStore()

    const firstId = store.insert(
      sampleEntry({ sentAt: '2026-01-01T00:00:00.000Z', url: 'https://first.example' }),
    )
    const secondId = store.insert(
      sampleEntry({ sentAt: '2026-01-02T00:00:00.000Z', url: 'https://second.example' }),
    )

    const rows = store.list()
    expect(rows).toHaveLength(2)
    expect(rows[0]?.id).toBe(secondId)
    expect(rows[0]?.url).toBe('https://second.example')
    expect(rows[1]?.id).toBe(firstId)
  })

  it('prunes oldest entries when exceeding cap', async () => {
    const store = await createStore()

    for (let i = 0; i < HISTORY_MAX_ENTRIES + 1; i++) {
      store.insert(
        sampleEntry({
          sentAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
          url: `https://entry-${i}.example`,
        }),
      )
    }

    const rows = store.list()
    expect(rows).toHaveLength(HISTORY_MAX_ENTRIES)
    expect(rows[0]?.url).toBe(`https://entry-${HISTORY_MAX_ENTRIES}.example`)
    expect(rows.at(-1)?.url).toBe('https://entry-1.example')
  })

  it('persists entries across store reopen', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-history-'))
    tempDirs.push(root)
    const dbPath = path.join(root, '.reqor', 'history.db')

    const writer = new HistoryStore(dbPath)
    openStores.push(writer)
    const id = writer.insert(sampleEntry())
    writer.close()
    openStores.pop()

    const reader = new HistoryStore(dbPath)
    openStores.push(reader)
    const row = reader.getById(id)

    expect(row).toMatchObject({
      collectionId: 'demo.http',
      method: 'GET',
      statusCode: 200,
      responseBody: '{"ok":true}',
    })
  })

  it('ensureSchema is idempotent', async () => {
    const store = await createStore()
    store.ensureSchema()
    store.ensureSchema()
    store.insert(sampleEntry())

    expect(store.list()).toHaveLength(1)
  })

  it('tolerates corrupt response_headers_json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-history-corrupt-'))
    tempDirs.push(root)
    const dbPath = path.join(root, '.reqor', 'history.db')

    const writer = new HistoryStore(dbPath)
    openStores.push(writer)
    const id = writer.insert(sampleEntry())
    writer.close()
    openStores.pop()

    const { default: Database } = await import('better-sqlite3')
    const db = new Database(dbPath)
    db.prepare('UPDATE history_entries SET response_headers_json = ? WHERE id = ?').run(
      'not-json',
      id,
    )
    db.close()

    const reader = new HistoryStore(dbPath)
    openStores.push(reader)
    expect(reader.getById(id)?.responseHeaders).toEqual([])
    expect(reader.list()).toHaveLength(1)
  })
})
