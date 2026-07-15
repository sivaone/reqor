import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function hasIndexHtml(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'index.html'))
}

export function resolveStaticRootFromPaths(cliPackageDir: string): string {
  const publishedRoot = path.join(cliPackageDir, 'web-dist')

  if (hasIndexHtml(publishedRoot)) {
    return publishedRoot
  }

  const monorepoFallback = path.resolve(cliPackageDir, '..', 'web', 'dist')
  if (hasIndexHtml(monorepoFallback)) {
    return monorepoFallback
  }

  throw new Error(
    'Web UI assets not found. Run `pnpm turbo build` to build @reqor/web and copy assets into @reqor/cli.',
  )
}

export function resolveStaticRoot(): string {
  const cliSrcDir = path.dirname(fileURLToPath(import.meta.url))
  const cliPackageDir = path.resolve(cliSrcDir, '..')
  return resolveStaticRootFromPaths(cliPackageDir)
}
