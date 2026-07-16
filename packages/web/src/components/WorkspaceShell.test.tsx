import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkspaceShell } from './WorkspaceShell.js'

const sampleRequest = {
  requestIndex: 0,
  fingerprint: 'c'.repeat(64),
  method: 'GET',
  url: 'https://httpbin.dev/get',
  headers: [],
}

describe('WorkspaceShell', () => {
  it('renders request and response regions with placeholder', () => {
    render(
      <WorkspaceShell
        activeRequest={null}
        isDetailPending={false}
        isDetailError={false}
      />,
    )

    expect(screen.getByRole('region', { name: 'Request' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Response' })).toBeDefined()
    expect(screen.getByText('Select a request')).toBeDefined()
  })

  it('renders request preview when active request is provided', () => {
    render(
      <WorkspaceShell
        activeRequest={sampleRequest}
        isDetailPending={false}
        isDetailError={false}
      />,
    )

    expect(screen.getByText('GET')).toBeDefined()
    expect(screen.getByText('https://httpbin.dev/get')).toBeDefined()
  })

  it('shows detail error even when a stale active request is present', () => {
    render(
      <WorkspaceShell
        activeRequest={sampleRequest}
        isDetailPending={false}
        isDetailError={true}
      />,
    )

    expect(screen.getByText('Could not load request')).toBeDefined()
    expect(screen.queryByText('https://httpbin.dev/get')).toBeNull()
  })
})
