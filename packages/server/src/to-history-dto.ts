import type {
  HistoryEntryDetailDtoType,
  HistoryEntrySummaryDtoType,
} from '@reqor/shared-types'
import { truncateBodyForDisplay } from './history-truncate.js'
import type { HistoryRow } from './history-store.js'

export function toHistorySummaryDto(row: HistoryRow): HistoryEntrySummaryDtoType {
  const { body, bodyTruncated } = truncateBodyForDisplay(row.responseBody)

  return {
    id: row.id,
    sentAt: row.sentAt,
    environmentName: row.environmentName,
    collectionId: row.collectionId,
    fingerprint: row.fingerprint,
    method: row.method,
    url: row.url,
    statusCode: row.statusCode,
    durationMs: row.durationMs,
    sizeBytes: row.sizeBytes,
    body,
    bodyTruncated,
  }
}

export function toHistoryDetailDto(row: HistoryRow): HistoryEntryDetailDtoType {
  return {
    id: row.id,
    sentAt: row.sentAt,
    environmentName: row.environmentName,
    collectionId: row.collectionId,
    fingerprint: row.fingerprint,
    method: row.method,
    url: row.url,
    statusCode: row.statusCode,
    statusText: row.statusText,
    durationMs: row.durationMs,
    sizeBytes: row.sizeBytes,
    responseHeaders: row.responseHeaders,
    body: row.responseBody,
    bodyTruncated: false,
  }
}
