import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureReqorBootstrap } from './bootstrap-reqor-dir.js'

describe('ensureReqorBootstrap', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  it('creates .reqor directory and appends .gitignore entry', async () => {
    const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-bootstrap-'))
    tempDirs.push(repositoryRoot)

    await ensureReqorBootstrap(repositoryRoot)

    const reqorStat = await fs.stat(path.join(repositoryRoot, '.reqor'))
    expect(reqorStat.isDirectory()).toBe(true)

    const gitignore = await fs.readFile(path.join(repositoryRoot, '.gitignore'), 'utf8')
    expect(gitignore).toContain('.reqor/')
  })

  it('is idempotent on repeated runs', async () => {
    const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-bootstrap-'))
    tempDirs.push(repositoryRoot)

    await ensureReqorBootstrap(repositoryRoot)
    await ensureReqorBootstrap(repositoryRoot)

    const gitignore = await fs.readFile(path.join(repositoryRoot, '.gitignore'), 'utf8')
    expect(gitignore.match(/\.reqor\//g)?.length).toBe(1)
  })

  it('creates .gitignore when missing', async () => {
    const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-bootstrap-'))
    tempDirs.push(repositoryRoot)

    await ensureReqorBootstrap(repositoryRoot)

    const gitignore = await fs.readFile(path.join(repositoryRoot, '.gitignore'), 'utf8')
    expect(gitignore.trim()).toBe('.reqor/')
  })
})
