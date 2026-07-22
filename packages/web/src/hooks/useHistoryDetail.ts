import { useQuery } from '@tanstack/react-query'
import type { HistoryEntryDetailDtoType } from '@reqor/shared-types'

export function useHistoryDetail(id: number | null | undefined) {
  return useQuery({
    queryKey: ['history', id],
    queryFn: async ({ signal }): Promise<HistoryEntryDetailDtoType> => {
      const res = await fetch(`/api/history/${id}`, { signal })
      if (!res.ok) throw new Error('Failed to load history detail')
      return res.json()
    },
    enabled: id != null,
  })
}
