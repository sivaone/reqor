import fs from 'node:fs'
import path from 'node:path'
import { findGitRoot } from './resolve-repository-root.js'

const LOCAL_ENV_RELATIVE_PATH = path.join('.reqor', 'local.env')

function parseEnvLine(line: string): [string, string] | undefined {
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

function applyEnvFile(envPath: string): string {
  const contents = fs.readFileSync(envPath, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (!parsed) {
      continue
    }

    const [key, value] = parsed
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  return envPath
}

/**
 * Load `.reqor/local.env` for a repository root.
 * Prefers `<startDir>/.reqor/local.env` (CLI / explicit Repository Root),
 * then falls back to the nearest git root (dev convenience from nested cwd).
 */
export function loadReqorLocalEnv(startDir = process.cwd()): string | undefined {
  const resolvedStart = path.resolve(startDir)
  const directPath = path.join(resolvedStart, LOCAL_ENV_RELATIVE_PATH)
  if (fs.existsSync(directPath)) {
    return applyEnvFile(directPath)
  }

  const gitRoot = findGitRoot(resolvedStart)
  if (!gitRoot || gitRoot === resolvedStart) {
    return undefined
  }

  const envPath = path.join(gitRoot, LOCAL_ENV_RELATIVE_PATH)
  if (!fs.existsSync(envPath)) {
    return undefined
  }

  return applyEnvFile(envPath)
}
