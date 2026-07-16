import { useQuery } from '@tanstack/react-query'
import type { CollectionDetailDtoType } from '@reqor/shared-types'

export function useCollectionDetail(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['collection', collectionId],
    queryFn: async ({ signal }): Promise<CollectionDetailDtoType> => {
      const res = await fetch(`/api/collections/${collectionId}`, { signal })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        if (body?.error?.code === 'NOT_FOUND') {
          throw new Error('NOT_FOUND')
        }
        throw new Error('Failed to load collection detail')
      }
      return res.json()
    },
    enabled: !!collectionId,
  })
}
