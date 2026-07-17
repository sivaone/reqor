/** Parse a single KEY=VALUE line from a dotenv-style file. */
export function parseEnvLine(line: string): [string, string] | undefined {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) {
    return undefined
  }

  const separator = trimmed.indexOf('=')
  if (separator <= 0) {
    return undefined
  }

  const key = trimmed.slice(0, separator).trim()
  let value = trimmed.slice(separator + 1).trim()

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return [key, value]
}

/** Parse dotenv file contents into a key-value map (later keys override earlier). */
export function parseEnvContents(contents: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (!parsed) {
      continue
    }
    const [key, value] = parsed
    values.set(key, value)
  }
  return values
}
