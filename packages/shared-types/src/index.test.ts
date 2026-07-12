import { describe, expect, it } from 'vitest'
import { ApiErrorEnvelope, HealthResponse } from './index.js'

describe('@reqor/shared-types', () => {
  it('exports HealthResponse schema', () => {
    expect(HealthResponse).toBeDefined()
    expect(HealthResponse.properties.status).toBeDefined()
    expect(HealthResponse.properties.version).toBeDefined()
  })

  it('exports ApiErrorEnvelope schema', () => {
    expect(ApiErrorEnvelope).toBeDefined()
    expect(ApiErrorEnvelope.properties.error).toBeDefined()
  })
})
