import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type {
  ApiErrorEnvelopeType,
  PreviewRequestType,
  PreviewResponseType,
} from '@reqor/shared-types'

const PREVIEW_DEBOUNCE_MS = 300

export type UsePreviewRequestParams = {
  collectionId: string | null
  requestIndex: number | null
  environment: string | null
  method: string
  url: string
  enabled: boolean
  /** Race-guard identity — included in query key so stale selection results are ignored */
  selectionIdentity: string | null
}

export function usePreviewRequest(params: UsePreviewRequestParams) {
  const [debounced, setDebounced] = useState(params)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(params)
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [
    params.collectionId,
    params.requestIndex,
    params.environment,
    params.method,
    params.url,
    params.enabled,
    params.selectionIdentity,
  ])

  const canQuery =
    debounced.enabled &&
    debounced.collectionId != null &&
    debounced.requestIndex != null &&
    debounced.selectionIdentity != null

  return useQuery({
    queryKey: [
      'preview',
      debounced.selectionIdentity,
      debounced.collectionId,
      debounced.requestIndex,
      debounced.environment,
      debounced.method,
      debounced.url,
    ],
    enabled: canQuery,
    queryFn: async ({ signal }): Promise<PreviewResponseType> => {
      const body: PreviewRequestType = {
        collectionId: debounced.collectionId!,
        requestIndex: debounced.requestIndex!,
        environment: debounced.environment,
        method: debounced.method,
        url: debounced.url,
      }

      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })

      if (!res.ok) {
        const envelope = (await res.json().catch(() => null)) as ApiErrorEnvelopeType | null
        const message = envelope?.error?.message ?? 'Failed to preview request'
        throw new Error(message)
      }

      return res.json()
    },
  })
}
