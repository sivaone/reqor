import { useQuery } from '@tanstack/react-query'
import type { HistoryListResponseType } from '@reqor/shared-types'

export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: async ({ signal }): Promise<HistoryListResponseType> => {
      const res = await fetch('/api/history', { signal })
      if (!res.ok) throw new Error('Failed to load history')
      return res.json()
    },
  })
}
