import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SECRET_MASK } from '@reqor/shared-types'
import { SecretField } from './SecretField.js'

describe('SecretField', () => {
  it('renders SECRET_MASK with secret-masked styling', () => {
    render(<SecretField value={SECRET_MASK} />)

    const field = screen.getByLabelText('Secret value masked')
    expect(field.textContent).toBe(SECRET_MASK)
    expect(field.className).toContain('text-secret-masked')
    expect(field.textContent).not.toContain('plaintext')
  })

  it('never renders plaintext even if a raw value prop were passed', () => {
    render(<SecretField value="super-secret" />)
    expect(screen.getByLabelText('Secret value masked').textContent).toBe(SECRET_MASK)
    expect(screen.queryByText('super-secret')).toBeNull()
  })
})
