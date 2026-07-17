import { describe, expect, it } from 'vitest'
import { deriveCanSend } from './deriveCanSend.js'

describe('deriveCanSend', () => {
  it('blocks Send while preview is pending or fetching', () => {
    expect(
      deriveCanSend({
        isSending: false,
        hasActiveRequest: true,
        previewPending: true,
        previewFetching: false,
        hasVariables: undefined,
        unresolved: null,
      }),
    ).toBe(false)

    expect(
      deriveCanSend({
        isSending: false,
        hasActiveRequest: true,
        previewPending: false,
        previewFetching: true,
        hasVariables: true,
        unresolved: null,
      }),
    ).toBe(false)
  })

  it('allows Send when hasVariables is false', () => {
    expect(
      deriveCanSend({
        isSending: false,
        hasActiveRequest: true,
        previewPending: false,
        previewFetching: false,
        hasVariables: false,
        unresolved: null,
      }),
    ).toBe(true)
  })

  it('blocks Send when variables are unresolved', () => {
    expect(
      deriveCanSend({
        isSending: false,
        hasActiveRequest: true,
        previewPending: false,
        previewFetching: false,
        hasVariables: true,
        unresolved: { name: 'host', raw: '{{host}}' },
      }),
    ).toBe(false)
  })

  it('allows Send when variables resolved and preview settled', () => {
    expect(
      deriveCanSend({
        isSending: false,
        hasActiveRequest: true,
        previewPending: false,
        previewFetching: false,
        hasVariables: true,
        unresolved: null,
      }),
    ).toBe(true)
  })
})
