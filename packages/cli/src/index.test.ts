import { describe, expect, it } from 'vitest'
import { serve } from './index.js'

describe('@reqor/cli', () => {
  it('exports serve function', () => {
    expect(serve).toBeTypeOf('function')
  })
})
