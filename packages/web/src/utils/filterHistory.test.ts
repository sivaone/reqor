import { describe, expect, it } from 'vitest'
import { filterHistory } from './filterHistory.js'

const entries = [
  {
    id: 1,
    sentAt: '2026-07-22T10:00:00.000Z',
    environmentName: 'dev',
    collectionId: 'demo.http',
    fingerprint: 'a'.repeat(64),
    method: 'GET',
    url: 'https://api.example.com/users',
    statusCode: 200,
    durationMs: 50,
    sizeBytes: 100,
    body: '{}',
    bodyTruncated: false,
  },
  {
    id: 2,
    sentAt: '2026-07-22T11:00:00.000Z',
    environmentName: null,
    collectionId: 'demo.http',
    fingerprint: 'b'.repeat(64),
    method: 'POST',
    url: 'https://api.example.com/orders',
    statusCode: 404,
    durationMs: 80,
    sizeBytes: 50,
    body: 'not found',
    bodyTruncated: false,
  },
]

describe('filterHistory', () => {
  it('returns all entries when search is empty', () => {
    expect(filterHistory(entries, '')).toEqual(entries)
    expect(filterHistory(entries, '   ')).toEqual(entries)
  })

  it('matches method case-insensitively', () => {
    expect(filterHistory(entries, 'post')).toHaveLength(1)
    expect(filterHistory(entries, 'post')[0]?.id).toBe(2)
  })

  it('matches url case-insensitively', () => {
    expect(filterHistory(entries, 'USERS')).toHaveLength(1)
    expect(filterHistory(entries, 'orders')[0]?.id).toBe(2)
  })

  it('matches status code as string', () => {
    expect(filterHistory(entries, '404')).toHaveLength(1)
    expect(filterHistory(entries, '20')).toHaveLength(1)
  })

  it('returns empty when nothing matches', () => {
    expect(filterHistory(entries, 'zzz')).toEqual([])
  })
})
