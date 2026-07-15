import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadReqorLocalEnv } from './load-local-env.js'
import { resolveRepositoryRoot } from './resolve-repository-root.js'

describe('loadReqorLocalEnv', () => {
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

  it('loads REQOR_REPOSITORY_ROOT from .reqor/local.env', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-local-env-'))
    tempDirs.push(root)
    await fs.mkdir(path.join(root, '.git'))
    await fs.mkdir(path.join(root, '.reqor'))
    await fs.writeFile(
      path.join(root, '.reqor', 'local.env'),
      'REQOR_REPOSITORY_ROOT=.\n',
    )

    delete process.env.REQOR_REPOSITORY_ROOT
    const nested = path.join(root, 'packages', 'server')
    await fs.mkdir(nested, { recursive: true })

    const loadedFrom = loadReqorLocalEnv(nested)
    expect(loadedFrom).toBe(path.join(root, '.reqor', 'local.env'))
    expect(resolveRepositoryRoot(nested)).toBe(root)
  })

  it('does not override existing environment variables', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-local-env-'))
    tempDirs.push(root)
    await fs.mkdir(path.join(root, '.git'))
    await fs.mkdir(path.join(root, '.reqor'))
    await fs.writeFile(
      path.join(root, '.reqor', 'local.env'),
      'REQOR_REPOSITORY_ROOT=.\n',
    )

    process.env.REQOR_REPOSITORY_ROOT = 'C:\\already-set'
    loadReqorLocalEnv(root)

    expect(process.env.REQOR_REPOSITORY_ROOT).toBe('C:\\already-set')
  })
})
