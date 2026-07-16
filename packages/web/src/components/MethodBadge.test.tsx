import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MethodBadge } from './MethodBadge.js'

describe('MethodBadge', () => {
  it('renders GET with method-get color class', () => {
    render(<MethodBadge method="GET" />)
    const badge = screen.getByText('GET')
    expect(badge.className).toContain('bg-method-get')
  })

  it('renders POST with method-post color class', () => {
    render(<MethodBadge method="post" />)
    const badge = screen.getByText('POST')
    expect(badge.className).toContain('bg-method-post')
  })

  it('renders unknown method with muted color class', () => {
    render(<MethodBadge method="CUSTOM" />)
    const badge = screen.getByText('CUSTOM')
    expect(badge.className).toContain('bg-foreground-muted')
  })
})
