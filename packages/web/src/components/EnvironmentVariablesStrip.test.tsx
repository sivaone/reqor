import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SECRET_MASK } from '@reqor/shared-types'
import { EnvironmentVariablesStrip } from './EnvironmentVariablesStrip.js'

describe('EnvironmentVariablesStrip', () => {
  it('shows plaintext for non-secrets and mask for secrets', () => {
    render(
      <EnvironmentVariablesStrip
        environmentName="development"
        variables={[
          { key: 'host', value: 'localhost', isSecret: false },
          { key: 'password', value: SECRET_MASK, isSecret: true },
        ]}
      />,
    )

    expect(screen.getByText('localhost')).toBeDefined()
    expect(screen.getByLabelText('Secret value masked').textContent).toBe(SECRET_MASK)
    expect(screen.queryByText('actual-password')).toBeNull()
  })

  it('returns null when variables list is empty', () => {
    const { container } = render(
      <EnvironmentVariablesStrip environmentName="development" variables={[]} />,
    )
    expect(container.firstChild).toBeNull()
  })
})
