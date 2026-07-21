import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RequestDraft } from '../utils/requestDraft.js'
import { WorkspaceShell } from './WorkspaceShell.js'

const sampleRequest = {
  requestIndex: 0,
  fingerprint: 'c'.repeat(64),
  method: 'GET',
  url: 'https://httpbin.dev/get',
  headers: [],
}

const sampleDraft: RequestDraft = {
  content: 'GET https://httpbin.dev/get\n',
  method: 'GET',
  url: 'https://httpbin.dev/get',
  headers: [],
}

const defaultExecuteProps = {
  draft: sampleDraft as RequestDraft | null,
  activeEnvironment: null as string | null,
  environmentVariables: [] as import('@reqor/shared-types').EnvironmentVariableDtoType[],
  collectionId: 'demo.http' as string | null,
  requestIndex: 0 as number | null,
  requestFingerprint: 'c'.repeat(64) as string | null,
  draftSelectionKey: 'demo:0' as string | null,
  onMethodChange: vi.fn(),
  onUrlChange: vi.fn(),
  onHeadersChange: vi.fn(),
  onBodyChange: vi.fn(),
  onAddBody: vi.fn(),
  onClearBody: vi.fn(),
  onContentChange: vi.fn(),
  onSyncSuccess: vi.fn(),
  onParseDiagnostics: vi.fn(),
  syncCollection: vi.fn().mockResolvedValue({
    content: 'GET https://httpbin.dev/get\n',
    parseStatus: 'ok' as const,
    requests: [sampleRequest],
    diagnostics: [],
  }),
  parseDiagnostics: [] as import('@reqor/shared-types').DiagnosticDtoType[],
  syncPending: false,
  followRedirects: true,
  onFollowRedirectsChange: vi.fn(),
  onSend: vi.fn(),
  isSending: false,
  canSend: true,
  isDraftDirty: false,
  canSave: false,
  validationError: null as string | null,
  onSave: vi.fn(),
  preview: null,
  unresolvedError: null,
  previewError: null,
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
        draft={null}
        collectionId={null}
        requestIndex={null}
        requestFingerprint={null}
        draftSelectionKey={null}
      />,
    )

    expect(screen.getByRole('region', { name: 'Request' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Response' })).toBeDefined()
    expect(screen.getByText('Select a request')).toBeDefined()
    expect(screen.getByText('Response will appear here')).toBeDefined()
  })

  it('renders request editor when active request and draft are provided', () => {
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
    expect(screen.getByRole('tab', { name: 'Params' })).toBeDefined()
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

  it('disables Send when canSend is false and shows unresolved error', () => {
    render(
      <WorkspaceShell
        activeRequest={sampleRequest}
        isDetailPending={false}
        isDetailError={false}
        {...defaultExecuteProps}
        canSend={false}
        unresolvedError="Unresolved variable: {{host}}"
        preview={{
          url: 'https://{{host}}/get',
          headers: [],
          unresolved: { name: 'host', raw: '{{host}}' },
          hasVariables: true,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', true)
    expect(screen.getByText('Unresolved variable: {{host}}')).toBeDefined()
  })
})
