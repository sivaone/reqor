import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveStaticRoot, resolveStaticRootFromPaths } from './resolve-static-root.js'

describe('resolveStaticRoot', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  it('prefers web-dist adjacent to the CLI package', async () => {
    const cliPackageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-cli-pkg-'))
    tempDirs.push(cliPackageDir)

    const webDist = path.join(cliPackageDir, 'web-dist')
    await fs.mkdir(webDist, { recursive: true })
    await fs.writeFile(path.join(webDist, 'index.html'), '<html></html>')

    expect(resolveStaticRootFromPaths(cliPackageDir)).toBe(webDist)
  })

  it('falls back to monorepo web/dist when web-dist is missing', async () => {
    const cliPackageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-cli-pkg-'))
    const webDist = path.join(cliPackageDir, '..', 'web', 'dist')
    tempDirs.push(cliPackageDir, path.dirname(webDist))

    await fs.mkdir(webDist, { recursive: true })
    await fs.writeFile(path.join(webDist, 'index.html'), '<html></html>')

    expect(resolveStaticRootFromPaths(cliPackageDir)).toBe(path.resolve(webDist))
  })

  it('throws a readable error when no static assets exist', () => {
    expect(() => resolveStaticRootFromPaths('/nonexistent/cli-package')).toThrow(
      /pnpm turbo build/i,
    )
  })

  it('resolves assets from the built workspace layout', async () => {
    const root = await resolveStaticRoot()
    await fs.access(path.join(root, 'index.html'))
  })
})
