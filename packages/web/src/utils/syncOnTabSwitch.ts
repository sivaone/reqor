import type {
  DiagnosticDtoType,
  RequestDtoType,
  SyncCollectionRequestType,
  SyncCollectionResponseType,
} from '@reqor/shared-types'
import type { RequestDraft } from './requestDraft.js'

export type TabSyncDirection = 'to-raw' | 'to-visual'

export function buildSyncPayload(
  direction: TabSyncDirection,
  draft: RequestDraft,
  requestIndex: number,
): SyncCollectionRequestType {
  if (direction === 'to-raw') {
    return {
      content: draft.content,
      requestIndex,
      patch: {
        method: draft.method,
        url: draft.url,
        headers: draft.headers,
        body: draft.body ?? null,
      },
    }
  }
  return { content: draft.content }
}

export function matchRequestAfterSync(
  response: SyncCollectionResponseType,
  requestIndex: number,
  previousFingerprint: string,
): RequestDtoType | null {
  const byIndex = response.requests.find((request) => request.requestIndex === requestIndex)
  if (byIndex) return byIndex

  const byFingerprint = response.requests.find(
    (request) => request.fingerprint === previousFingerprint,
  )
  return byFingerprint ?? null
}

export function formatParseDiagnostic(diagnostic: DiagnosticDtoType): string {
  return `Line ${diagnostic.line}: ${diagnostic.message}`
}

export function isVisualTab(tab: string): boolean {
  return tab === 'params' || tab === 'headers' || tab === 'body'
}
