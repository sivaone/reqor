import { useMutation } from '@tanstack/react-query'
import type { ApiErrorEnvelopeType, ExecuteRequestType, ExecuteResponseType } from '@reqor/shared-types'

export class ExecuteRequestError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ExecuteRequestError'
  }
}

export function useExecuteRequest() {
  return useMutation({
    mutationFn: async (request: ExecuteRequestType) => {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorEnvelopeType | null
        const code = body?.error?.code
        const message = body?.error?.message ?? 'Failed to execute request'
        throw new ExecuteRequestError(message, code)
      }

      const data = (await res.json().catch(() => null)) as ExecuteResponseType | null
      if (!data) {
        throw new ExecuteRequestError('Invalid execute response')
      }
      return data
    },
  })
}
