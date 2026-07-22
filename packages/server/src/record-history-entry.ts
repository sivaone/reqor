import type { ExecuteResponseType } from '@reqor/shared-types'
import type { ExecuteHistoryContext } from './proxy/execute-request.js'
import type { HistoryStore } from './history-store.js'
import { redactSecrets } from './redact-secrets.js'

export interface HistoryRecorderLogger {
  warn: (obj: Record<string, unknown>, message: string) => void
}

export function recordHistoryEntry(
  store: HistoryStore,
  context: ExecuteHistoryContext,
  response: ExecuteResponseType,
  log: HistoryRecorderLogger,
): void {
  try {
    const secrets = context.secrets
    const redactedHeaders = response.headers.map((header) => ({
      name: header.name,
      value: redactSecrets(header.value, secrets),
    }))

    store.insert({
      sentAt: new Date().toISOString(),
      environmentName: context.environmentName,
      collectionId: context.collectionId,
      fingerprint: context.fingerprint,
      method: context.method,
      url: redactSecrets(context.url, secrets),
      statusCode: response.status,
      statusText: redactSecrets(response.statusText, secrets),
      durationMs: response.timingMs,
      sizeBytes: response.sizeBytes,
      responseHeaders: redactedHeaders,
      responseBody: redactSecrets(response.body, secrets),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'History insert failed'
    log.warn({ code: 'HISTORY_INSERT_FAILED' }, message)
  }
}
