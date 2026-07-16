import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CollectionsRefreshResponseType } from '@reqor/shared-types'

export function useRefreshCollections() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ signal }: { signal?: AbortSignal } = {}) => {
      const res = await fetch('/api/collections/refresh', { method: 'POST', signal })
      if (!res.ok) throw new Error('Failed to refresh collections')
      return res.json() as Promise<CollectionsRefreshResponseType>
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['collections'], data)
      queryClient.invalidateQueries({ queryKey: ['collection'] })
    },
  })
}
