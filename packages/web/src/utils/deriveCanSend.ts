/** Send enablement matrix — shared by Send button and Ctrl/⌘+Enter (UX-DR10, UX-DR21). */
export function deriveCanSend(options: {
  isSending: boolean
  hasActiveRequest: boolean
  previewPending: boolean
  previewFetching: boolean
  hasVariables: boolean | undefined
  unresolved: { name: string; raw: string } | null | undefined
}): boolean {
  const { isSending, hasActiveRequest, previewPending, previewFetching, hasVariables, unresolved } =
    options

  if (isSending || !hasActiveRequest) return false

  // Waiting for first preview result — gate Send (unknown hasVariables).
  if (hasVariables === undefined) return false

  if (hasVariables === false) return true

  // hasVariables === true — block while preview in flight; gate on unresolved when settled.
  if (previewPending || previewFetching) return false
  return unresolved == null
}
