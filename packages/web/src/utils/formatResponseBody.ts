export type ResponseBodyFormat = 'json' | 'xml' | 'plain'

export function detectResponseFormat(
  contentType: string | undefined,
  body: string,
): ResponseBodyFormat {
  const normalized = contentType?.toLowerCase() ?? ''

  if (normalized.includes('json') || normalized.includes('+json')) {
    return 'json'
  }
  if (normalized.includes('xml') || normalized.includes('+xml')) {
    return 'xml'
  }

  const trimmed = body.trim()
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // fall through
    }
  }

  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return 'xml'
  }

  return 'plain'
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function escapeJsonStringDisplay(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')
}

export function prettyPrintJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export type XmlToken = {
  type: 'tag' | 'attr' | 'text'
  value: string
}

export function tokenizeXml(body: string): XmlToken[] {
  const tokens: XmlToken[] = []
  const pattern = /(<[^>]+>)|([^<]+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(body)) !== null) {
    const [full, tag, text] = match
    if (tag) {
      const parsed = /^<\/?([\w:.-]+)([^>]*)(\/?>)$/.exec(tag)
      if (!parsed) {
        tokens.push({ type: 'tag', value: tag })
        continue
      }

      const [, name, attrsPart, end] = parsed
      const isClose = tag.startsWith('</')
      tokens.push({ type: 'tag', value: isClose ? `</${name}` : `<${name}` })

      const attrPattern = /(\s+)([\w:.-]+)="([^"]*)"/g
      let attrMatch: RegExpExecArray | null
      while ((attrMatch = attrPattern.exec(attrsPart)) !== null) {
        tokens.push({ type: 'text', value: attrMatch[1] ?? ' ' })
        tokens.push({ type: 'attr', value: `${attrMatch[2]}="${attrMatch[3]}"` })
      }

      tokens.push({ type: 'tag', value: end ?? '>' })
    } else if (text?.trim()) {
      tokens.push({ type: 'text', value: text })
    } else if (full) {
      tokens.push({ type: 'text', value: full })
    }
  }

  return tokens
}

export function formatStatusBar(
  status: number,
  statusText: string,
  timingMs: number,
  sizeBytes: number,
): string {
  const statusPart = statusText.trim()
    ? `${status} ${statusText.trim()}`
    : `${status}`
  return `${statusPart} · ${Math.round(timingMs)} ms · ${sizeBytes} B`
}

export function statusTone(status: number): 'success' | 'error' | 'neutral' {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 400) return 'error'
  return 'neutral'
}
