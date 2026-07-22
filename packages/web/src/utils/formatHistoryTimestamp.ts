export function formatHistoryTimestamp(sentAt: string): string {
  const date = new Date(sentAt)
  if (Number.isNaN(date.getTime())) return sentAt
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
