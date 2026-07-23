import { useMutation } from '@tanstack/react-query'
import type {
  ApiErrorEnvelopeType,
  ExportSnippetRequestType,
  ExportSnippetResponseType,
} from '@reqor/shared-types'

export class ExportSnippetError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ExportSnippetError'
  }
}

export function useExportSnippet() {
  return useMutation({
    mutationFn: async (request: ExportSnippetRequestType) => {
      const res = await fetch('/api/export/snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorEnvelopeType | null
        const code = body?.error?.code
        const message = body?.error?.message ?? 'Failed to export snippet'
        throw new ExportSnippetError(message, code)
      }

      const data = (await res.json().catch(() => null)) as ExportSnippetResponseType | null
      if (!data || typeof data.snippet !== 'string' || typeof data.language !== 'string') {
        throw new ExportSnippetError('Invalid export response')
      }
      return data
    },
  })
}
