import { render, screen } from '@testing-library/react'
import { SECRET_MASK } from '@reqor/shared-types'
import { describe, expect, it } from 'vitest'
import { PreSendPreview } from './PreSendPreview.js'

describe('PreSendPreview', () => {
  it('renders resolved URL and headers; masks secret values', () => {
    render(
      <PreSendPreview
        preview={{
          url: 'https://httpbin.dev/get',
          headers: [
            { name: 'Accept', value: 'application/json' },
            { name: 'Authorization', value: `Bearer ${SECRET_MASK}` },
          ],
          unresolved: null,
          hasVariables: true,
        }}
      />,
    )

    expect(screen.getByText('Preview resolved request')).toBeDefined()
    expect(screen.getByText('https://httpbin.dev/get')).toBeDefined()
    expect(screen.getByText('application/json')).toBeDefined()
    expect(screen.getByLabelText('Secret value masked')).toBeDefined()
  })
})
