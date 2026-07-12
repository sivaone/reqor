export interface ParsedRequest {
  method: string
  url: string
}

export interface Diagnostic {
  file?: string
  line: number
  message: string
}

export interface ParseResult {
  requests: ParsedRequest[]
  diagnostics: Diagnostic[]
}

export function parseHttpFile(_content: string): ParseResult {
  return { requests: [], diagnostics: [] }
}
