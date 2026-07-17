import { useQuery } from '@tanstack/react-query'
import type { EnvironmentsListResponseType } from '@reqor/shared-types'

export function useEnvironments() {
  return useQuery({
    queryKey: ['environments'],
    queryFn: async ({ signal }): Promise<EnvironmentsListResponseType> => {
      const res = await fetch('/api/environments', { signal })
      if (!res.ok) throw new Error('Failed to load environments')
      return res.json()
    },
  })
}
