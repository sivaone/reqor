import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceShell } from './WorkspaceShell.js'

const sampleRequest = {
  requestIndex: 0,
  fingerprint: 'c'.repeat(64),
  method: 'GET',
  url: 'https://httpbin.dev/get',
  headers: [],
}

const defaultExecuteProps = {
  collectionId: 'demo.http' as string | null,
  requestIndex: 0 as number | null,
  lineMethod: 'GET',
  lineUrl: 'https://httpbin.dev/get',
  onMethodChange: vi.fn(),
  onUrlChange: vi.fn(),
  followRedirects: true,
  onFollowRedirectsChange: vi.fn(),
  onSend: vi.fn(),
  isSending: false,
  executeResult: null,
  executeError: null,
}

describe('WorkspaceShell', () => {
  it('renders request and response regions with placeholder', () => {
    render(
      <WorkspaceShell
        activeRequest={null}
        isDetailPending={false}
        isDetailError={false}
        {...defaultExecuteProps}
        collectionId={null}
        requestIndex={null}
      />,
    )

    expect(screen.getByRole('region', { name: 'Request' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Response' })).toBeDefined()
    expect(screen.getByText('Select a request')).toBeDefined()
    expect(screen.getByText('Response will appear here')).toBeDefined()
  })

  it('renders request line when active request is provided', () => {
    render(
      <WorkspaceShell
        activeRequest={sampleRequest}
        isDetailPending={false}
        isDetailError={false}
        {...defaultExecuteProps}
      />,
    )

    expect(screen.getByLabelText('Request URL')).toHaveProperty('value', 'https://httpbin.dev/get')
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDefined()
  })

  it('shows detail error even when a stale active request is present', () => {
    render(
      <WorkspaceShell
        activeRequest={sampleRequest}
        isDetailPending={false}
        isDetailError={true}
        {...defaultExecuteProps}
      />,
    )

    expect(screen.getByText('Could not load request')).toBeDefined()
    expect(screen.queryByLabelText('Request URL')).toBeNull()
  })

  it('renders response status bar when execute result is present', () => {
    render(
      <WorkspaceShell
        activeRequest={sampleRequest}
        isDetailPending={false}
        isDetailError={false}
        {...defaultExecuteProps}
        executeResult={{
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'content-type', value: 'application/json' }],
          body: '{"ok":true}',
          timingMs: 50,
          sizeBytes: 11,
        }}
      />,
    )

    expect(screen.getByText(/200 OK · 50 ms · 11 B/)).toBeDefined()
  })
})
