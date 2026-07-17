import fs from 'node:fs'
import path from 'node:path'
import { parseEnvLine } from './parse-env-line.js'
import { findGitRoot } from './resolve-repository-root.js'

const LOCAL_ENV_RELATIVE_PATH = path.join('.reqor', 'local.env')

function applyEnvFile(envPath: string): string {
  const contents = fs.readFileSync(envPath, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (!parsed) {
      continue
    }

    const [key, value] = parsed
    // Process-env override rule (not dotenv Map merge): never clobber an existing value.
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
