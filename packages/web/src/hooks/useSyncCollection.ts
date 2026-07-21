import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ApiErrorEnvelopeType,
  CollectionDetailDtoType,
  SyncCollectionRequestType,
  SyncCollectionResponseType,
} from '@reqor/shared-types'

export class SyncCollectionError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'SyncCollectionError'
    this.code = code
  }
}

export type SyncCollectionVariables = {
  collectionId: string
  body: SyncCollectionRequestType
}

export function useSyncCollection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      collectionId,
      body,
    }: SyncCollectionVariables): Promise<SyncCollectionResponseType> => {
      const res = await fetch(`/api/collections/${collectionId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const envelope = (await res.json().catch(() => null)) as ApiErrorEnvelopeType | null
        throw new SyncCollectionError(
          envelope?.error?.message ?? 'Failed to sync collection',
          envelope?.error?.code,
        )
      }
      return res.json()
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<CollectionDetailDtoType>(
        ['collection', variables.collectionId],
        (previous) => {
          // Keep prior request list when re-parse fails with zero requests so selection/draft survive.
          const requests =
            data.parseStatus === 'error' && data.requests.length === 0 && previous
              ? previous.requests
              : data.requests
          if (!previous) {
            return {
              id: variables.collectionId,
              content: data.content,
              parseStatus: data.parseStatus,
              requests,
              diagnostics: data.diagnostics,
            }
          }
          return {
            ...previous,
            content: data.content,
            parseStatus: data.parseStatus,
            requests,
            diagnostics: data.diagnostics,
          }
        },
      )
    },
  })
}
