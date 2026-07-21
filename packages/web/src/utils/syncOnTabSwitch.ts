import type {
  DiagnosticDtoType,
  RequestDtoType,
  SyncCollectionPatchType,
  SyncCollectionRequestType,
  SyncCollectionResponseType,
} from '@reqor/shared-types'
import type { RequestDraft } from './requestDraft.js'

export type TabSyncDirection = 'to-raw' | 'to-visual'

function buildStructuredPatch(draft: RequestDraft): SyncCollectionPatchType {
  return {
    method: draft.method,
    url: draft.url,
    headers: draft.headers,
    ...(draft.body !== undefined ? { body: draft.body } : {}),
  }
}

export function buildSyncPayload(
  direction: TabSyncDirection,
  draft: RequestDraft,
  requestIndex: number,
  options?: { includeStructuredPatch?: boolean },
): SyncCollectionRequestType {
  if (direction === 'to-raw') {
    return {
      content: draft.content,
      requestIndex,
      patch: buildStructuredPatch(draft),
    }
  }
  if (options?.includeStructuredPatch) {
    return {
      content: draft.content,
      requestIndex,
      patch: buildStructuredPatch(draft),
    }
  }
  return { content: draft.content }
}

export function matchRequestAfterSync(
  response: SyncCollectionResponseType,
  requestIndex: number,
  previousFingerprint: string,
  direction: TabSyncDirection,
): RequestDtoType | null {
  const byIndex = response.requests.find((request) => request.requestIndex === requestIndex)
  const byFingerprint = response.requests.find(
    (request) => request.fingerprint === previousFingerprint,
  )

  if (direction === 'to-raw') {
    return byIndex ?? null
  }

  // Raw → visual: unchanged request at index, then fingerprint rematch when blocks move,
  // then same index after in-place raw edits (fingerprint change is expected).
  if (byIndex?.fingerprint === previousFingerprint) return byIndex
  if (byFingerprint) return byFingerprint
  if (byIndex) return byIndex
  return null
}

export function formatParseDiagnostic(diagnostic: DiagnosticDtoType): string {
  return `Line ${diagnostic.line}: ${diagnostic.message}`
}

export function isVisualTab(tab: string): boolean {
  return tab === 'params' || tab === 'headers' || tab === 'body'
}
