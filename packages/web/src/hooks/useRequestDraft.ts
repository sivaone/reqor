import type { RequestBodyDtoType, RequestDtoType, RequestHeaderDtoType } from '@reqor/shared-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  draftEquals,
  draftFromRequest,
  type RequestDraft,
  validateRequestDraft,
} from '../utils/requestDraft.js'

export type SyncResultApply = {
  content: string
  request: RequestDtoType
}

export type UseRequestDraftResult = {
  draft: RequestDraft | null
  baseline: RequestDraft | null
  isDirty: boolean
  validation: { valid: boolean; message?: string }
  canSave: boolean
  setDraft: (updater: RequestDraft | ((prev: RequestDraft) => RequestDraft)) => void
  setContent: (content: string) => void
  setMethod: (method: string) => void
  setUrl: (url: string) => void
  setHeaders: (headers: RequestHeaderDtoType[]) => void
  setBody: (body: RequestBodyDtoType | undefined) => void
  addBody: () => void
  clearBody: () => void
  applySyncResult: (result: SyncResultApply) => void
  applySaveResult: (result: SyncResultApply) => void
  commitBaseline: () => void
  setParseBlockingSave: (blocking: boolean) => void
}

function initialDraft(
  activeRequest: RequestDtoType | null,
  selectionIdentity: string | null,
  collectionContent: string,
): RequestDraft | null {
  if (!selectionIdentity || !activeRequest) return null
  return draftFromRequest(activeRequest, collectionContent)
}

export function useRequestDraft(
  activeRequest: RequestDtoType | null,
  selectionIdentity: string | null,
  collectionContent: string = '',
): UseRequestDraftResult {
  const [draft, setDraftState] = useState<RequestDraft | null>(() =>
    initialDraft(activeRequest, selectionIdentity, collectionContent),
  )
  const [baseline, setBaseline] = useState<RequestDraft | null>(() =>
    initialDraft(activeRequest, selectionIdentity, collectionContent),
  )
  const [trackedSelection, setTrackedSelection] = useState(selectionIdentity)
  const [parseBlockingSave, setParseBlockingSave] = useState(false)

  if (selectionIdentity !== trackedSelection) {
    setTrackedSelection(selectionIdentity)
    const next = initialDraft(activeRequest, selectionIdentity, collectionContent)
    setDraftState(next)
    setBaseline(next)
    setParseBlockingSave(false)
  }

  useEffect(() => {
    if (!selectionIdentity || !activeRequest) return
    setDraftState((prev) => {
      if (prev === null) {
        const next = draftFromRequest(activeRequest, collectionContent)
        setBaseline(next)
        return next
      }
      return prev
    })
  }, [selectionIdentity, activeRequest, collectionContent])

  useEffect(() => {
    if (!selectionIdentity || !collectionContent) return
    setDraftState((prev) => {
      if (!prev || prev.content !== '') return prev
      return { ...prev, content: collectionContent }
    })
    setBaseline((prev) => {
      if (!prev || prev.content !== '') return prev
      return { ...prev, content: collectionContent }
    })
  }, [selectionIdentity, collectionContent])

  const setDraft = useCallback(
    (updater: RequestDraft | ((prev: RequestDraft) => RequestDraft)) => {
      setDraftState((prev) => {
        if (!prev) return prev
        return typeof updater === 'function' ? updater(prev) : updater
      })
    },
    [],
  )

  const setContent = useCallback(
    (content: string) => {
      setDraft((prev) => ({ ...prev, content }))
    },
    [setDraft],
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

  const applySyncResult = useCallback((result: SyncResultApply) => {
    const next = draftFromRequest(result.request, result.content)
    setDraftState(next)
    // Keep baseline as disk-loaded state so Save stays dirty until persisted.
  }, [])

  const applySaveResult = useCallback((result: SyncResultApply) => {
    const next = draftFromRequest(result.request, result.content)
    setDraftState(next)
    setBaseline(next)
  }, [])

  const commitBaseline = useCallback(() => {
    setBaseline((prev) => {
      if (!draft) return prev
      return { ...draft }
    })
  }, [draft])

  const isDirty = useMemo(() => {
    if (!draft || !baseline) return false
    return !draftEquals(draft, baseline)
  }, [draft, baseline])

  const validation = useMemo(() => {
    if (!draft) return { valid: true }
    return validateRequestDraft(draft)
  }, [draft])

  const canSave = isDirty && validation.valid && !parseBlockingSave

  return {
    draft,
    baseline,
    isDirty,
    validation,
    canSave,
    setDraft,
    setContent,
    setMethod,
    setUrl,
    setHeaders,
    setBody,
    addBody,
    clearBody,
    applySyncResult,
    applySaveResult,
    commitBaseline,
    setParseBlockingSave,
  }
}
