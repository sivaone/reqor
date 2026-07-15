import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveRepositoryRoot } from './resolve-repository-root.js'

describe('resolveRepositoryRoot', () => {
  const tempDirs: string[] = []
  const originalEnv = process.env.REQOR_REPOSITORY_ROOT

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.REQOR_REPOSITORY_ROOT
    } else {
      process.env.REQOR_REPOSITORY_ROOT = originalEnv
    }

    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  it('uses absolute REQOR_REPOSITORY_ROOT when set', () => {
    const absoluteRoot = path.join(os.tmpdir(), 'reqor-custom-root')
    const ignoredCwd = path.join(os.tmpdir(), 'reqor-ignored-cwd')
    process.env.REQOR_REPOSITORY_ROOT = absoluteRoot

    expect(resolveRepositoryRoot(ignoredCwd)).toBe(path.resolve(absoluteRoot))
  })

  it('resolves relative REQOR_REPOSITORY_ROOT against git root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-git-root-'))
    tempDirs.push(root)
    await fs.mkdir(path.join(root, '.git'))
    const sandbox = path.join(root, 'local-dev', 'collections')
    await fs.mkdir(sandbox, { recursive: true })
    process.env.REQOR_REPOSITORY_ROOT = 'local-dev/collections'

    expect(resolveRepositoryRoot(root)).toBe(sandbox)
  })

  it('walks up from a nested package dir to the git root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-git-root-'))
    tempDirs.push(root)
    await fs.mkdir(path.join(root, '.git'))
    const nested = path.join(root, 'packages', 'server')
    await fs.mkdir(nested, { recursive: true })

    expect(resolveRepositoryRoot(nested)).toBe(root)
  })

  it('falls back to startDir when no .git ancestor exists', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-no-git-'))
    tempDirs.push(root)
    const nested = path.join(root, 'packages', 'server')
    await fs.mkdir(nested, { recursive: true })

    expect(resolveRepositoryRoot(nested)).toBe(nested)
  })
})
