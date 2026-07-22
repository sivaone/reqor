import { HISTORY_BODY_DISPLAY_LIMIT } from './constants.js'

export function truncateBodyForDisplay(
  body: string,
  limit = HISTORY_BODY_DISPLAY_LIMIT,
): { body: string; bodyTruncated: boolean } {
  const bytes = new TextEncoder().encode(body)
  if (bytes.length <= limit) {
    return { body, bodyTruncated: false }
  }

  // Walk back so we never split a multi-byte UTF-8 sequence (continuation bytes are 10xxxxxx).
  let end = limit
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) {
    end -= 1
  }

  return {
    body: new TextDecoder().decode(bytes.subarray(0, end)),
    bodyTruncated: true,
  }
}
