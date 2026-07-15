import { useQuery } from '@tanstack/react-query'
import type { CollectionsListResponseType } from '@reqor/shared-types'

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async ({ signal }): Promise<CollectionsListResponseType> => {
      const res = await fetch('/api/collections', { signal })
      if (!res.ok) throw new Error('Failed to load collections')
      return res.json()
    },
  })
}
