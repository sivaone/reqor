import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ApiErrorEnvelopeType,
  CollectionDetailDtoType,
  SaveCollectionRequestType,
  SaveCollectionResponseType,
} from '@reqor/shared-types'

export class SaveCollectionError extends Error {
  readonly code?: string
  readonly line?: number

  constructor(message: string, code?: string, line?: number) {
    super(message)
    this.name = 'SaveCollectionError'
    this.code = code
    this.line = line
  }
}

export type SaveCollectionVariables = {
  collectionId: string
  content: string
}

export function useSaveCollection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      collectionId,
      content,
    }: SaveCollectionVariables): Promise<SaveCollectionResponseType> => {
      const body: SaveCollectionRequestType = { content }
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const envelope = (await res.json().catch(() => null)) as ApiErrorEnvelopeType | null
        const details = envelope?.error?.details as { line?: number } | undefined
        const line = typeof details?.line === 'number' ? details.line : undefined
        throw new SaveCollectionError(
          envelope?.error?.message ?? 'Failed to save collection',
          envelope?.error?.code,
          line,
        )
      }
      return res.json()
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<CollectionDetailDtoType>(['collection', variables.collectionId], {
        id: variables.collectionId,
        content: data.content,
        parseStatus: data.parseStatus,
        requests: data.requests,
        diagnostics: data.diagnostics,
      })
    },
  })
}
