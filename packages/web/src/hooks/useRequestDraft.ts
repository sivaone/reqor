import type { RequestBodyDtoType, RequestDtoType, RequestHeaderDtoType } from '@reqor/shared-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  draftEquals,
  draftFromRequest,
  type RequestDraft,
  validateRequestDraft,
} from '../utils/requestDraft.js'

export type UseRequestDraftResult = {
  draft: RequestDraft | null
  baseline: RequestDraft | null
  isDirty: boolean
  validation: { valid: boolean; message?: string }
  canSave: boolean
  setDraft: (updater: RequestDraft | ((prev: RequestDraft) => RequestDraft)) => void
  setMethod: (method: string) => void
  setUrl: (url: string) => void
  setHeaders: (headers: RequestHeaderDtoType[]) => void
  setBody: (body: RequestBodyDtoType | undefined) => void
  addBody: () => void
  clearBody: () => void
}

export function useRequestDraft(
  activeRequest: RequestDtoType | null,
  selectionIdentity: string | null,
): UseRequestDraftResult {
  const [draft, setDraftState] = useState<RequestDraft | null>(null)
  const [baseline, setBaseline] = useState<RequestDraft | null>(null)

  useEffect(() => {
    if (!selectionIdentity || !activeRequest) {
      setDraftState(null)
      setBaseline(null)
      return
    }
    const next = draftFromRequest(activeRequest)
    setBaseline(next)
    setDraftState(next)
  }, [selectionIdentity, activeRequest])

  const setDraft = useCallback(
    (updater: RequestDraft | ((prev: RequestDraft) => RequestDraft)) => {
      setDraftState((prev) => {
        if (!prev) return prev
        return typeof updater === 'function' ? updater(prev) : updater
      })
    },
    [],
  )

  const setMethod = useCallback((method: string) => {
    setDraft((prev) => ({ ...prev, method: method.toUpperCase() }))
  }, [setDraft])

  const setUrl = useCallback(
    (url: string) => {
      setDraft((prev) => ({ ...prev, url }))
    },
    [setDraft],
  )

  const setHeaders = useCallback(
    (headers: RequestHeaderDtoType[]) => {
      setDraft((prev) => ({ ...prev, headers }))
    },
    [setDraft],
  )

  const setBody = useCallback(
    (body: RequestBodyDtoType | undefined) => {
      setDraft((prev) => {
        if (body === undefined) {
          const { body: _removed, ...rest } = prev
          return rest
        }
        return { ...prev, body }
      })
    },
    [setDraft],
  )

  const addBody = useCallback(() => {
    setDraft((prev) => ({ ...prev, body: { kind: 'raw', content: '' } }))
  }, [setDraft])

  const clearBody = useCallback(() => {
    setBody(undefined)
  }, [setBody])

  const isDirty = useMemo(() => {
    if (!draft || !baseline) return false
    return !draftEquals(draft, baseline)
  }, [draft, baseline])

  const validation = useMemo(() => {
    if (!draft) return { valid: true }
    return validateRequestDraft(draft)
  }, [draft])

  const canSave = isDirty && validation.valid

  return {
    draft,
    baseline,
    isDirty,
    validation,
    canSave,
    setDraft,
    setMethod,
    setUrl,
    setHeaders,
    setBody,
    addBody,
    clearBody,
  }
}
