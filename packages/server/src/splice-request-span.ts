import type { SourceSpan } from '@reqor/http-parser'

export function splitLines(content: string): string[] {
  return content.split(/\r?\n/)
}

export function joinLines(lines: string[], original: string): string {
  const newline = original.includes('\r\n') ? '\r\n' : '\n'
  return lines.join(newline)
}

export type SpliceRequestSpanResult =
  | { ok: true; content: string }
  | { ok: false; code: 'INVALID_SPAN' }

export function spliceRequestSpan(
  content: string,
  span: SourceSpan,
  serializedBlock: string,
): SpliceRequestSpanResult {
  const lines = splitLines(content)
  if (span.startLine < 1 || span.endLine < span.startLine || span.endLine > lines.length) {
    return { ok: false, code: 'INVALID_SPAN' }
  }

  const before = lines.slice(0, span.startLine - 1)
  const after = lines.slice(span.endLine)
  const blockLines = splitLines(serializedBlock)
  return {
    ok: true,
    content: joinLines([...before, ...blockLines, ...after], content),
  }
}
