import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

describe('@reqor/server', () => {
  it('GET /api/health returns 200 with typed body', async () => {
    const app = buildApp()
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', version: '0.0.0' })
    await app.close()
  })
})
