import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('@reqor/server', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  it('GET /api/health returns 200 with typed body', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-health-'))
    tempDirs.push(root)

    const app = await buildApp({ repositoryRoot: root })
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', version: '0.0.0' })
    await app.close()
  })
})
