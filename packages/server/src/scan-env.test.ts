import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanEnvFiles } from './scan-env.js'

describe('scanEnvFiles', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  async function createRepo(structure: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-scan-env-'))
    tempDirs.push(root)

    for (const [relativePath, content] of Object.entries(structure)) {
      const absolutePath = path.join(root, ...relativePath.split('/'))
      await fs.mkdir(path.dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, content)
    }

    return root
  }

  it('excludes node_modules and .git directories', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({ development: { host: 'root' } }),
      'node_modules/pkg/http-client.env.json': JSON.stringify({ development: { host: 'hidden' } }),
      '.git/objects/http-client.env.json': JSON.stringify({ development: { host: 'git' } }),
    })

    const pairs = await scanEnvFiles(root)

    expect(pairs).toEqual([
      {
        directory: '.',
        publicFile: 'http-client.env.json',
      },
    ])
  })

  it('honors root .gitignore entries', async () => {
    const root = await createRepo({
      '.gitignore': 'ignored/\n',
      'http-client.env.json': JSON.stringify({ development: { host: 'included' } }),
      'ignored/http-client.env.json': JSON.stringify({ development: { host: 'secret' } }),
    })

    const pairs = await scanEnvFiles(root)

    expect(pairs).toEqual([
      {
        directory: '.',
        publicFile: 'http-client.env.json',
      },
    ])
  })

  it('excludes .reqor hard-ignore paths', async () => {
    const root = await createRepo({
      'http-client.env.json': JSON.stringify({ development: { host: 'root' } }),
      '.reqor/http-client.env.json': JSON.stringify({ development: { host: 'internal' } }),
    })

    const pairs = await scanEnvFiles(root)

    expect(pairs).toEqual([
      {
        directory: '.',
        publicFile: 'http-client.env.json',
      },
    ])
  })
})
