import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanHttpFiles } from './scan.js'

describe('scanHttpFiles', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-scan-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  it('includes nested .http files with POSIX ids', async () => {
    const root = await createRepo({
      'http/users.http': 'GET https://example.com/users',
      'api/items.http': 'GET https://example.com/items',
    })

    const ids = await scanHttpFiles(root)

    expect(ids).toEqual(['api/items.http', 'http/users.http'])
    expect(ids.every((id) => !id.includes('\\'))).toBe(true)
  })

  it('excludes node_modules and .git directories', async () => {
    const root = await createRepo({
      'valid.http': 'GET https://example.com/valid',
      'node_modules/pkg/sample.http': 'GET https://example.com/hidden',
      '.git/objects/sample.http': 'GET https://example.com/git',
    })

    const ids = await scanHttpFiles(root)

    expect(ids).toEqual(['valid.http'])
  })

  it('honors root .gitignore entries', async () => {
    const root = await createRepo({
      '.gitignore': 'ignored/\n*.local.http\n',
      'included.http': 'GET https://example.com/included',
      'ignored/secret.http': 'GET https://example.com/secret',
      'local.local.http': 'GET https://example.com/local',
    })

    const ids = await scanHttpFiles(root)

    expect(ids).toEqual(['included.http'])
  })

  it('includes files in non-excluded dot-directories', async () => {
    const root = await createRepo({
      '.requests/private.http': 'GET https://example.com/private',
      '.reqor/internal.http': 'GET https://example.com/internal',
    })

    const ids = await scanHttpFiles(root)

    expect(ids).toEqual(['.requests/private.http'])
  })

  it('does not follow directory symlinks outside the repository', async () => {
    const root = await createRepo({})
    const external = await createRepo({
      'secret.http': 'GET https://example.com/secret',
    })
    await fs.symlink(
      external,
      path.join(root, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    const ids = await scanHttpFiles(root)

    expect(ids).toEqual([])
  })
})
