import type { HistoryEntrySummaryDtoType } from '@reqor/shared-types'

export function filterHistory(
  entries: HistoryEntrySummaryDtoType[],
  search: string,
): HistoryEntrySummaryDtoType[] {
  const query = search.trim()
  if (!query) return entries

  const lowerQuery = query.toLowerCase()

  return entries.filter((entry) => {
    const methodMatch = entry.method.toLowerCase().includes(lowerQuery)
    const urlMatch = entry.url.toLowerCase().includes(lowerQuery)
    const statusMatch = String(entry.statusCode).includes(lowerQuery)
    return methodMatch || urlMatch || statusMatch
  })
}
