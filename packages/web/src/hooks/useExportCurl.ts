import { useMutation } from '@tanstack/react-query'
import type {
  ApiErrorEnvelopeType,
  ExportCurlRequestType,
  ExportCurlResponseType,
} from '@reqor/shared-types'

export class ExportCurlError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ExportCurlError'
  }
}

export function useExportCurl() {
  return useMutation({
    mutationFn: async (request: ExportCurlRequestType) => {
      const res = await fetch('/api/export/curl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorEnvelopeType | null
        const code = body?.error?.code
        const message = body?.error?.message ?? 'Failed to export cURL'
        throw new ExportCurlError(message, code)
      }

      const data = (await res.json().catch(() => null)) as ExportCurlResponseType | null
      if (!data) {
        throw new ExportCurlError('Invalid export response')
      }
      return data
    },
  })
}
