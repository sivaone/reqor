import type {
  CollectionDetailDtoType,
  CollectionSummaryDtoType,
} from '@reqor/shared-types'

export type FilteredCollection = {
  summary: CollectionSummaryDtoType
  autoExpand: boolean
}

export function filterCollections(
  summaries: CollectionSummaryDtoType[],
  detailById: Record<string, CollectionDetailDtoType>,
  search: string,
): FilteredCollection[] {
  const query = search.trim()
  if (!query) {
    return summaries.map((summary) => ({ summary, autoExpand: false }))
  }

  const lowerQuery = query.toLowerCase()

  return summaries.flatMap((summary) => {
    const pathMatches = summary.id.toLowerCase().includes(lowerQuery)
    const detail = detailById[summary.id]
    const requestMatches =
      detail?.requests.some((request) =>
        `${request.method} ${request.url}`.toLowerCase().includes(lowerQuery),
      ) ?? false

    if (!pathMatches && !requestMatches) {
      return []
    }

    return [
      {
        summary,
        autoExpand: !pathMatches && requestMatches,
      },
    ]
  })
}
