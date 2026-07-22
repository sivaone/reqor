export class CopyToClipboardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CopyToClipboardError'
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new CopyToClipboardError('Clipboard is not available in this browser')
  }

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    throw new CopyToClipboardError('Failed to copy to clipboard')
  }
}
