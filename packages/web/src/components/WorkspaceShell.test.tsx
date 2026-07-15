import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkspaceShell } from './WorkspaceShell.js'

describe('WorkspaceShell', () => {
  it('renders request and response regions with placeholder', () => {
    render(<WorkspaceShell />)

    expect(screen.getByRole('region', { name: 'Request' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Response' })).toBeDefined()
    expect(screen.getByText('Select a request')).toBeDefined()
  })
})
