import type { RequestDtoType } from '@reqor/shared-types'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useRequestDraft } from './useRequestDraft.js'

const requestA: RequestDtoType = {
  requestIndex: 0,
  fingerprint: 'a'.repeat(64),
  method: 'GET',
  url: 'https://httpbin.dev/get',
  headers: [{ name: 'Accept', value: 'application/json' }],
}

const requestB: RequestDtoType = {
  requestIndex: 1,
  fingerprint: 'b'.repeat(64),
  method: 'POST',
  url: 'https://httpbin.dev/post',
  headers: [],
  body: { kind: 'raw', content: 'hi' },
}

describe('useRequestDraft', () => {
  it('initializes from active request and is not dirty', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0:aaa'))

    expect(result.current.draft).toMatchObject({
      method: 'GET',
      url: 'https://httpbin.dev/get',
      headers: [{ name: 'Accept', value: 'application/json' }],
    })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.canSave).toBe(false)
  })

  it('marks dirty on edit and clean when reverted', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0:aaa'))

    act(() => {
      result.current.setUrl('https://httpbin.dev/uuid')
    })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.canSave).toBe(true)

    act(() => {
      result.current.setUrl('https://httpbin.dev/get')
    })
    expect(result.current.isDirty).toBe(false)
  })

  it('resets draft when selection identity changes', () => {
    const { result, rerender } = renderHook(
      ({ req, id }: { req: RequestDtoType; id: string }) => useRequestDraft(req, id),
      { initialProps: { req: requestA, id: 'demo:0:aaa' } },
    )

    act(() => {
      result.current.setUrl('https://edited')
    })
    expect(result.current.isDirty).toBe(true)

    rerender({ req: requestB, id: 'demo:1:bbb' })
    expect(result.current.draft?.method).toBe('POST')
    expect(result.current.draft?.url).toBe('https://httpbin.dev/post')
    expect(result.current.isDirty).toBe(false)
  })

  it('addBody and clearBody toggle body presence', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0:aaa'))

    act(() => {
      result.current.addBody()
    })
    expect(result.current.draft?.body).toEqual({ kind: 'raw', content: '' })
    expect(result.current.isDirty).toBe(true)

    act(() => {
      result.current.clearBody()
    })
    expect(result.current.draft?.body).toBeUndefined()
  })

  it('surfaces validation for GET with body', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0:aaa'))

    act(() => {
      result.current.addBody()
      result.current.setBody({ kind: 'raw', content: 'payload' })
    })

    expect(result.current.validation.valid).toBe(false)
    expect(result.current.canSave).toBe(false)
    expect(result.current.validation.message).toMatch(/should not include a body/i)
  })

  it('clears draft when selection is null', () => {
    const { result, rerender } = renderHook(
      ({ req, id }: { req: RequestDtoType | null; id: string | null }) =>
        useRequestDraft(req, id),
      { initialProps: { req: requestA as RequestDtoType | null, id: 'demo:0:aaa' as string | null } },
    )

    rerender({ req: null, id: null })
    expect(result.current.draft).toBeNull()
    expect(result.current.isDirty).toBe(false)
  })
})
