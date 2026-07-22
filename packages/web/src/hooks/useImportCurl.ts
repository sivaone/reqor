import { useMutation } from '@tanstack/react-query'
import type {
  ApiErrorEnvelopeType,
  ImportCurlRequestType,
  ImportCurlResponseType,
} from '@reqor/shared-types'

export class ImportCurlError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ImportCurlError'
  }
}

export function useImportCurl() {
  return useMutation({
    mutationFn: async (request: ImportCurlRequestType) => {
      const res = await fetch('/api/import/curl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorEnvelopeType | null
        const code = body?.error?.code
        const message = body?.error?.message ?? 'Failed to import cURL'
        throw new ImportCurlError(message, code)
      }

      const data = (await res.json().catch(() => null)) as ImportCurlResponseType | null
      if (!data) {
        throw new ImportCurlError('Invalid import response')
      }
      return data
    },
  })
}
