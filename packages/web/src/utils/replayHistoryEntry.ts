import type {
  CollectionDetailDtoType,
  ExecuteResponseType,
  HistoryEntryDetailDtoType,
  HistoryEntrySummaryDtoType,
} from '@reqor/shared-types'
import type { SelectedRequest } from '../types/selection.js'
import { historyToExecuteResponse } from './historyToExecuteResponse.js'
import { findByFingerprint } from './rematchRequest.js'

export const HISTORY_REMATCH_ERROR =
  'Could not find request in collection for this history entry.'

export const HISTORY_DETAIL_ERROR = 'Failed to load history detail'

export type ReplayHistorySuccess = {
  ok: true
  selection: NonNullable<SelectedRequest>
  response: ExecuteResponseType
}

export type ReplayHistoryFailure = {
  ok: false
  error: string
}

export async function replayHistoryEntry(options: {
  entry: HistoryEntrySummaryDtoType
  fetchCollectionDetail: (collectionId: string) => Promise<CollectionDetailDtoType>
  fetchHistoryDetail: (historyId: number) => Promise<HistoryEntryDetailDtoType>
}): Promise<ReplayHistorySuccess | ReplayHistoryFailure> {
  const { entry, fetchCollectionDetail, fetchHistoryDetail } = options

  let collectionDetail: CollectionDetailDtoType
  try {
    collectionDetail = await fetchCollectionDetail(entry.collectionId)
  } catch {
    return { ok: false, error: HISTORY_REMATCH_ERROR }
  }

  const matched = findByFingerprint(collectionDetail, entry.fingerprint)
  if (!matched) {
    return { ok: false, error: HISTORY_REMATCH_ERROR }
  }

  try {
    const detailDto = await fetchHistoryDetail(entry.id)
    return {
      ok: true,
      selection: {
        collectionId: entry.collectionId,
        requestIndex: matched.requestIndex,
        fingerprint: matched.fingerprint,
      },
      response: historyToExecuteResponse(detailDto),
    }
  } catch {
    return { ok: false, error: HISTORY_DETAIL_ERROR }
  }
}
