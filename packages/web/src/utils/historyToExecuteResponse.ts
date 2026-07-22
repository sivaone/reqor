import type {
  ExecuteResponseType,
  HistoryEntryDetailDtoType,
} from '@reqor/shared-types'

export function historyToExecuteResponse(
  detail: HistoryEntryDetailDtoType,
): ExecuteResponseType {
  return {
    status: detail.statusCode,
    statusText: detail.statusText,
    headers: detail.responseHeaders,
    body: detail.body,
    timingMs: detail.durationMs,
    sizeBytes: detail.sizeBytes,
  }
}
