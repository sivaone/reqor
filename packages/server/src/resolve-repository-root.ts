import fs from 'node:fs'
import path from 'node:path'

export function findGitRoot(startDir = process.cwd()): string | undefined {
  let current = path.resolve(startDir)
  const filesystemRoot = path.parse(current).root

  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current || parent === filesystemRoot) {
      return undefined
    }
    current = parent
  }
}

/**
 * Resolve the repository root for collection scanning.
 * Prefers REQOR_REPOSITORY_ROOT (absolute or relative to git root), then walks
 * up to the nearest `.git` directory (so `pnpm dev` from a monorepo package
 * still scans the project root).
 */
export function resolveRepositoryRoot(startDir = process.cwd()): string {
  const gitRoot = findGitRoot(startDir)
  const baseDir = gitRoot ?? path.resolve(startDir)

  if (process.env.REQOR_REPOSITORY_ROOT) {
    const configured = process.env.REQOR_REPOSITORY_ROOT
    return path.isAbsolute(configured)
      ? path.resolve(configured)
      : path.resolve(baseDir, configured)
  }

  return baseDir
}
