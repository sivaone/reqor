import { describe, expect, it, vi } from 'vitest'
import {
  HISTORY_DETAIL_ERROR,
  HISTORY_REMATCH_ERROR,
  replayHistoryEntry,
} from './replayHistoryEntry.js'

const fingerprint = 'a'.repeat(64)

const entry = {
  id: 7,
  sentAt: '2026-07-22T10:00:00.000Z',
  environmentName: 'dev',
  collectionId: 'demo.http',
  fingerprint,
  method: 'GET',
  url: 'https://httpbin.dev/get',
  statusCode: 200,
  durationMs: 12,
  sizeBytes: 11,
  body: '{"ok":true}',
  bodyTruncated: true,
}

const collectionDetail = {
  id: 'demo.http',
  path: 'demo.http',
  content: 'GET https://httpbin.dev/get\n',
  parseStatus: 'ok' as const,
  requests: [
    {
      requestIndex: 0,
      fingerprint,
      method: 'GET',
      url: 'https://httpbin.dev/get',
      headers: [],
    },
  ],
  diagnostics: [],
}

const detailDto = {
  id: 7,
  sentAt: '2026-07-22T10:00:00.000Z',
  environmentName: 'dev',
  collectionId: 'demo.http',
  fingerprint,
  method: 'GET',
  url: 'https://httpbin.dev/get',
  statusCode: 200,
  statusText: 'OK',
  durationMs: 12,
  sizeBytes: 11,
  responseHeaders: [{ name: 'content-type', value: 'application/json' }],
  body: '{"ok":true,"full":true}',
  bodyTruncated: false,
}

describe('replayHistoryEntry', () => {
  it('fetches collection, rematches fingerprint, and maps history detail', async () => {
    const fetchCollectionDetail = vi.fn().mockResolvedValue(collectionDetail)
    const fetchHistoryDetail = vi.fn().mockResolvedValue(detailDto)

    const result = await replayHistoryEntry({
      entry,
      fetchCollectionDetail,
      fetchHistoryDetail,
    })

    expect(result).toEqual({
      ok: true,
      selection: {
        collectionId: 'demo.http',
        requestIndex: 0,
        fingerprint,
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'content-type', value: 'application/json' }],
        body: '{"ok":true,"full":true}',
        timingMs: 12,
        sizeBytes: 11,
      },
    })
    expect(fetchCollectionDetail).toHaveBeenCalledWith('demo.http')
    expect(fetchHistoryDetail).toHaveBeenCalledWith(7)
  })

  it('returns rematch banner error when collection fetch fails', async () => {
    const result = await replayHistoryEntry({
      entry,
      fetchCollectionDetail: vi.fn().mockRejectedValue(new Error('NOT_FOUND')),
      fetchHistoryDetail: vi.fn(),
    })

    expect(result).toEqual({ ok: false, error: HISTORY_REMATCH_ERROR })
  })

  it('returns rematch banner error when fingerprint is missing', async () => {
    const result = await replayHistoryEntry({
      entry: { ...entry, fingerprint: 'b'.repeat(64) },
      fetchCollectionDetail: vi.fn().mockResolvedValue(collectionDetail),
      fetchHistoryDetail: vi.fn(),
    })

    expect(result).toEqual({ ok: false, error: HISTORY_REMATCH_ERROR })
  })

  it('returns detail error when history detail fetch fails after rematch', async () => {
    const fetchHistoryDetail = vi.fn().mockRejectedValue(new Error('boom'))

    const result = await replayHistoryEntry({
      entry,
      fetchCollectionDetail: vi.fn().mockResolvedValue(collectionDetail),
      fetchHistoryDetail,
    })

    expect(result).toEqual({ ok: false, error: HISTORY_DETAIL_ERROR })
    expect(fetchHistoryDetail).toHaveBeenCalledWith(7)
  })
})
