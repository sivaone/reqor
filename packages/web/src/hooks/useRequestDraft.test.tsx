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

const FILE_A = 'GET https://httpbin.dev/get\n'

describe('useRequestDraft', () => {
  it('initializes from active request and content and is not dirty', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0', FILE_A))

    expect(result.current.draft).toMatchObject({
      content: FILE_A,
      method: 'GET',
      url: 'https://httpbin.dev/get',
      headers: [{ name: 'Accept', value: 'application/json' }],
    })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.canSave).toBe(false)
  })

  it('marks dirty on content edit', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0', FILE_A))

    act(() => {
      result.current.setContent(`${FILE_A}\n# edited`)
    })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.canSave).toBe(true)
  })

  it('marks dirty on edit and clean when reverted', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0', FILE_A))

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

  it('resets draft when selection identity changes including content', () => {
    const { result, rerender } = renderHook(
      ({ req, id, content }: { req: RequestDtoType; id: string; content: string }) =>
        useRequestDraft(req, id, content),
      { initialProps: { req: requestA, id: 'demo:0', content: FILE_A } },
    )

    act(() => {
      result.current.setContent('edited raw')
    })
    expect(result.current.isDirty).toBe(true)

    rerender({
      req: requestB,
      id: 'demo:1',
      content: 'POST https://httpbin.dev/post\n\nhi\n',
    })
    expect(result.current.draft?.method).toBe('POST')
    expect(result.current.draft?.url).toBe('https://httpbin.dev/post')
    expect(result.current.draft?.content).toBe('POST https://httpbin.dev/post\n\nhi\n')
    expect(result.current.isDirty).toBe(false)
  })

  it('applySyncResult updates draft without requiring selection change', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0', FILE_A))

    act(() => {
      result.current.setUrl('https://edited')
    })
    expect(result.current.isDirty).toBe(true)

    act(() => {
      result.current.applySyncResult({
        content: 'GET https://edited\n',
        request: {
          ...requestA,
          url: 'https://edited',
          fingerprint: 'c'.repeat(64),
        },
      })
    })

    expect(result.current.draft?.url).toBe('https://edited')
    expect(result.current.draft?.content).toBe('GET https://edited\n')
    expect(result.current.isDirty).toBe(true)
  })

  it('addBody and clearBody toggle body presence', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0', FILE_A))

    act(() => {
      result.current.addBody()
    })
    expect(result.current.draft?.body).toEqual({ kind: 'raw', content: '' })
    expect(result.current.isDirty).toBe(false)

    act(() => {
      result.current.setBody({ kind: 'raw', content: 'payload' })
    })
    expect(result.current.isDirty).toBe(true)

    act(() => {
      result.current.clearBody()
    })
    expect(result.current.draft?.body).toBeUndefined()
  })

  it('preserves edits when activeRequest reference changes for same selection', () => {
    const { result, rerender } = renderHook(
      ({ req, id }: { req: RequestDtoType; id: string }) => useRequestDraft(req, id, FILE_A),
      { initialProps: { req: requestA, id: 'demo:0' } },
    )

    act(() => {
      result.current.setUrl('https://edited')
    })
    expect(result.current.isDirty).toBe(true)

    rerender({ req: { ...requestA, headers: [...requestA.headers] }, id: 'demo:0' })
    expect(result.current.draft?.url).toBe('https://edited')
    expect(result.current.isDirty).toBe(true)
  })

  it('surfaces validation for GET with body', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0', FILE_A))

    act(() => {
      result.current.addBody()
      result.current.setBody({ kind: 'raw', content: 'payload' })
    })

    expect(result.current.validation.valid).toBe(false)
    expect(result.current.canSave).toBe(false)
    expect(result.current.validation.message).toMatch(/should not include a body/i)
  })

  it('blocks save when parseBlockingSave is set', () => {
    const { result } = renderHook(() => useRequestDraft(requestA, 'demo:0', FILE_A))

    act(() => {
      result.current.setUrl('https://edited')
      result.current.setParseBlockingSave(true)
    })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.canSave).toBe(false)
  })

  it('clears draft when selection is null', () => {
    const { result, rerender } = renderHook(
      ({ req, id }: { req: RequestDtoType | null; id: string | null }) =>
        useRequestDraft(req, id, FILE_A),
      { initialProps: { req: requestA as RequestDtoType | null, id: 'demo:0' as string | null } },
    )

    rerender({ req: null, id: null })
    expect(result.current.draft).toBeNull()
    expect(result.current.isDirty).toBe(false)
  })
})
