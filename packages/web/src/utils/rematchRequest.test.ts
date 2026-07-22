import { describe, expect, it } from 'vitest'
import { findByFingerprint } from './rematchRequest.js'

const requests = [
  {
    requestIndex: 0,
    fingerprint: 'a'.repeat(64),
    method: 'GET',
    url: 'https://example.com/a',
    headers: [],
  },
  {
    requestIndex: 1,
    fingerprint: 'b'.repeat(64),
    method: 'POST',
    url: 'https://example.com/b',
    headers: [],
  },
]

describe('findByFingerprint', () => {
  it('finds request by fingerprint when no preferIndex', () => {
    const matched = findByFingerprint({ requests }, 'b'.repeat(64))
    expect(matched?.requestIndex).toBe(1)
  })

  it('returns null when fingerprint not found', () => {
    expect(findByFingerprint({ requests }, 'c'.repeat(64))).toBeNull()
  })

  it('prefers index when fingerprint still matches', () => {
    const matched = findByFingerprint({ requests }, 'a'.repeat(64), 0)
    expect(matched?.requestIndex).toBe(0)
  })

  it('falls back to fingerprint when preferIndex fingerprint mismatches', () => {
    const matched = findByFingerprint({ requests }, 'b'.repeat(64), 0)
    expect(matched?.requestIndex).toBe(1)
  })
})
