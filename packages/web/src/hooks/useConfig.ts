import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ApiErrorEnvelopeType,
  ConfigDtoType,
  ConfigUpdateRequestType,
} from '@reqor/shared-types'

export class ConfigUpdateError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ConfigUpdateError'
  }
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: async ({ signal }): Promise<ConfigDtoType> => {
      const res = await fetch('/api/config', { signal })
      if (!res.ok) throw new Error('Failed to load config')
      return res.json()
    },
  })
}

export function useUpdateConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: ConfigUpdateRequestType): Promise<ConfigDtoType> => {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const envelope = (await res.json().catch(() => null)) as ApiErrorEnvelopeType | null
        const code = envelope?.error?.code
        const message = envelope?.error?.message ?? 'Failed to update config'
        throw new ConfigUpdateError(message, code)
      }

      return res.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['config'], data)
    },
  })
}
