import { describe, expect, it } from 'vitest'
import { historyToExecuteResponse } from './historyToExecuteResponse.js'

describe('historyToExecuteResponse', () => {
  it('maps detail DTO fields to ExecuteResponseType', () => {
    const detail = {
      id: 1,
      sentAt: '2026-07-22T10:00:00.000Z',
      environmentName: 'dev',
      collectionId: 'demo.http',
      fingerprint: 'a'.repeat(64),
      method: 'GET',
      url: 'https://example.com',
      statusCode: 201,
      statusText: 'Created',
      durationMs: 123.4,
      sizeBytes: 512,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: '{"ok":true}',
      bodyTruncated: false as const,
    }

    expect(historyToExecuteResponse(detail)).toEqual({
      status: 201,
      statusText: 'Created',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      body: '{"ok":true}',
      timingMs: 123.4,
      sizeBytes: 512,
    })
  })
})
