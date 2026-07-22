import type { RequestDtoType } from '@reqor/shared-types'

export function findByFingerprint(
  detail: { requests: RequestDtoType[] },
  fingerprint: string,
  preferIndex?: number,
): RequestDtoType | null {
  if (preferIndex != null) {
    const byIndex = detail.requests.find((request) => request.requestIndex === preferIndex)
    if (byIndex?.fingerprint === fingerprint) return byIndex
  }
  return detail.requests.find((request) => request.fingerprint === fingerprint) ?? null
}
