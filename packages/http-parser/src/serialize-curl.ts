export type SerializeCurlHeader = {
  name: string
  value: string
}

export type SerializeCurlBody = {
  kind: string
  content: string
}

export type SerializeCurlInput = {
  method: string
  url: string
  headers: SerializeCurlHeader[]
  body?: SerializeCurlBody
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function isJsonContentType(header: SerializeCurlHeader): boolean {
  if (header.name.toLowerCase() !== 'content-type') return false
  // Exact application/json only (optional params); do not match json-patch/jsonl/etc.
  return /^application\/json(\s*;|$)/i.test(header.value.trim())
}

export function serializeCurl(input: SerializeCurlInput): string {
  const parts: string[] = ['curl']
  const method = input.method.toUpperCase().trim()

  if (method !== 'GET') {
    parts.push('-X', method)
  }

  parts.push(shellQuote(input.url))

  const isJsonBody = input.body?.kind === 'json'
  const headers = isJsonBody
    ? input.headers.filter((header) => !isJsonContentType(header))
    : input.headers

  for (const header of headers) {
    parts.push('-H', shellQuote(`${header.name}: ${header.value}`))
  }

  if (input.body && method !== 'GET' && method !== 'HEAD') {
    const { content } = input.body
    if (input.body.kind === 'json') {
      parts.push('--json', shellQuote(content))
    } else if (content.includes('\n') || content.startsWith('@')) {
      // --data-raw: multiline, or leading @ (curl would treat -d @path as a file)
      parts.push('--data-raw', shellQuote(content))
    } else {
      parts.push('-d', shellQuote(content))
    }
  }

  return parts.join(' ')
}
