import type {
  CollectionDetailDtoType,
  CollectionSummaryDtoType,
} from '@reqor/shared-types'
import { describe, expect, it } from 'vitest'
import { filterCollections } from './filterCollections.js'

const summaryA: CollectionSummaryDtoType = {
  id: 'http/users.http',
  parseStatus: 'ok',
  requestCount: 1,
  diagnostics: [],
}

const summaryB: CollectionSummaryDtoType = {
  id: 'api/demo.http',
  parseStatus: 'ok',
  requestCount: 1,
  diagnostics: [],
}

const detailA: CollectionDetailDtoType = {
  id: 'http/users.http',
  content: '',
  parseStatus: 'ok',
  requests: [
    {
      requestIndex: 0,
      fingerprint: 'a'.repeat(64),
      method: 'GET',
      url: 'https://example.com/users',
      headers: [],
    },
  ],
  diagnostics: [],
}

describe('filterCollections', () => {
  it('returns all summaries when search is empty', () => {
    const result = filterCollections([summaryA, summaryB], {}, '')
    expect(result).toHaveLength(2)
    expect(result.every((item) => item.autoExpand === false)).toBe(true)
  })

  it('matches collection path without detail loaded', () => {
    const result = filterCollections([summaryA, summaryB], {}, 'users')
    expect(result).toHaveLength(1)
    expect(result[0]!.summary.id).toBe('http/users.http')
    expect(result[0]!.autoExpand).toBe(false)
  })

  it('matches request only when detail is present in cache', () => {
    const result = filterCollections([summaryA, summaryB], {}, 'example.com')
    expect(result).toHaveLength(0)

    const withDetail = filterCollections(
      [summaryA, summaryB],
      { 'http/users.http': detailA },
      'example.com',
    )
    expect(withDetail).toHaveLength(1)
    expect(withDetail[0]!.summary.id).toBe('http/users.http')
    expect(withDetail[0]!.autoExpand).toBe(true)
  })

  it('does not auto-expand when path matches', () => {
    const result = filterCollections(
      [summaryA],
      { 'http/users.http': detailA },
      'users.http',
    )
    expect(result[0]!.autoExpand).toBe(false)
  })
})
