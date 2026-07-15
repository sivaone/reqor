import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('static serve', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  it('serves static assets and SPA fallback while preserving API routes', async () => {
    const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-static-root-'))
    const staticRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-static-assets-'))
    tempDirs.push(repositoryRoot, staticRoot)

    await fs.mkdir(path.join(staticRoot, 'assets'), { recursive: true })
    await fs.writeFile(
      path.join(staticRoot, 'index.html'),
      '<!DOCTYPE html><html><body><script src="/assets/test.js"></script></body></html>',
    )
    await fs.writeFile(path.join(staticRoot, 'assets', 'test.js'), 'console.log("ok")')

    const app = await buildApp({ repositoryRoot, staticRoot })

    const indexResponse = await app.inject({ method: 'GET', url: '/' })
    expect(indexResponse.statusCode).toBe(200)
    expect(indexResponse.headers['content-type']).toMatch(/text\/html/)
    expect(indexResponse.body).toContain('/assets/test.js')

    const assetResponse = await app.inject({ method: 'GET', url: '/assets/test.js' })
    expect(assetResponse.statusCode).toBe(200)
    expect(assetResponse.body).toBe('console.log("ok")')

    const healthResponse = await app.inject({ method: 'GET', url: '/api/health' })
    expect(healthResponse.statusCode).toBe(200)
    expect(healthResponse.json()).toEqual({ status: 'ok', version: '0.0.0' })

    const apiNotFoundResponse = await app.inject({ method: 'GET', url: '/api/foo' })
    expect(apiNotFoundResponse.statusCode).toBe(404)
    expect(apiNotFoundResponse.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    })

    const apiRootNotFoundResponse = await app.inject({ method: 'GET', url: '/api' })
    expect(apiRootNotFoundResponse.statusCode).toBe(404)
    expect(apiRootNotFoundResponse.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    })

    const apiQueryNotFoundResponse = await app.inject({
      method: 'GET',
      url: '/api/foo?x=1',
    })
    expect(apiQueryNotFoundResponse.statusCode).toBe(404)
    expect(apiQueryNotFoundResponse.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    })

    const spaFallbackResponse = await app.inject({
      method: 'GET',
      url: '/some-spa-route',
    })
    expect(spaFallbackResponse.statusCode).toBe(200)
    expect(spaFallbackResponse.headers['content-type']).toMatch(/text\/html/)
    expect(spaFallbackResponse.body).toContain('/assets/test.js')

    await app.close()
  })
})
