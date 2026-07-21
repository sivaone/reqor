import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RequestDraft } from '../utils/requestDraft.js'
import { RequestEditor } from './RequestEditor.js'

const draft: RequestDraft = {
  content: 'GET https://httpbin.dev/get\n',
  method: 'GET',
  url: 'https://httpbin.dev/get',
  headers: [{ name: 'Accept', value: 'application/json' }],
}

const syncOk = {
  content: 'GET https://httpbin.dev/get\n',
  parseStatus: 'ok' as const,
  requests: [
    {
      requestIndex: 0,
      fingerprint: 'a'.repeat(64),
      method: 'GET',
      url: 'https://httpbin.dev/get',
      headers: [{ name: 'Accept', value: 'application/json' }],
    },
  ],
  diagnostics: [],
}

const baseProps = {
  draft,
  collectionId: 'demo.http',
  requestIndex: 0,
  requestFingerprint: 'a'.repeat(64),
  onMethodChange: vi.fn(),
  onUrlChange: vi.fn(),
  onHeadersChange: vi.fn(),
  onBodyChange: vi.fn(),
  onAddBody: vi.fn(),
  onClearBody: vi.fn(),
  onContentChange: vi.fn(),
  onSyncSuccess: vi.fn(),
  onParseDiagnostics: vi.fn(),
  syncCollection: vi.fn().mockResolvedValue(syncOk),
  followRedirects: true,
  onFollowRedirectsChange: vi.fn(),
  onSend: vi.fn(),
  isSending: false,
  canSend: true,
  isDraftDirty: false,
  canSave: false,
  validationError: null,
  onSave: vi.fn(),
}

describe('RequestEditor', () => {
  it('preserves header edits when switching sub-tabs', () => {
    const onHeadersChange = vi.fn()
    const { rerender } = render(
      <RequestEditor {...baseProps} onHeadersChange={onHeadersChange} />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Headers (1)' }))
    fireEvent.change(screen.getByLabelText('Header 1 value'), {
      target: { value: 'text/plain' },
    })
    expect(onHeadersChange).toHaveBeenCalledWith([{ name: 'Accept', value: 'text/plain' }])

    const editedDraft: RequestDraft = {
      ...draft,
      headers: [{ name: 'Accept', value: 'text/plain' }],
    }
    rerender(
      <RequestEditor
        {...baseProps}
        draft={editedDraft}
        onHeadersChange={onHeadersChange}
        isDraftDirty={true}
        canSave={true}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Params' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Headers (1)' }))
    expect(screen.getByLabelText('Header 1 value')).toHaveProperty('value', 'text/plain')
  })

  it('hides Save when clean and shows when dirty', () => {
    const { rerender } = render(<RequestEditor {...baseProps} />)
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()

    rerender(<RequestEditor {...baseProps} isDraftDirty={true} canSave={true} />)
    expect(screen.getByRole('button', { name: /^save$/i })).toHaveProperty('disabled', false)
  })

  it('resets sub-tab to Params when selection changes', () => {
    const { rerender } = render(
      <RequestEditor {...baseProps} draftSelectionKey="demo:0" />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Headers (1)' }))
    expect(screen.getByRole('tab', { name: 'Headers (1)' })).toHaveProperty('ariaSelected', 'true')

    rerender(
      <RequestEditor
        {...baseProps}
        draft={{ ...draft, method: 'POST', url: 'https://httpbin.dev/post' }}
        draftSelectionKey="demo:1"
      />,
    )

    expect(screen.getByRole('tab', { name: 'Params' })).toHaveProperty('ariaSelected', 'true')
  })

  it('stays on Raw tab when fingerprint updates after visual-to-raw sync', async () => {
    const syncCollection = vi.fn().mockResolvedValue({
      ...syncOk,
      requests: [
        {
          ...syncOk.requests[0]!,
          url: 'https://httpbin.dev/get?raw=1',
          fingerprint: 'b'.repeat(64),
        },
      ],
    })
    render(
      <RequestEditor
        {...baseProps}
        draftSelectionKey="demo:0"
        syncCollection={syncCollection}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Raw .http' }))

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Raw .http' }).getAttribute('aria-selected')).toBe(
        'true',
      )
    })
  })

  it('syncs when switching to Raw tab', async () => {
    const syncCollection = vi.fn().mockResolvedValue(syncOk)
    const onSyncSuccess = vi.fn()
    render(
      <RequestEditor
        {...baseProps}
        syncCollection={syncCollection}
        onSyncSuccess={onSyncSuccess}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Raw .http' }))

    await waitFor(() => {
      expect(syncCollection).toHaveBeenCalled()
    })
    expect(syncCollection.mock.calls[0]![0].body.patch).toBeDefined()
    await waitFor(() => {
      expect(onSyncSuccess).toHaveBeenCalled()
    })
    expect(screen.getByLabelText('Raw HTTP file')).toBeDefined()
  })

  it('updates structured fields when switching from Raw to Headers after raw edit', async () => {
    const syncCollection = vi.fn().mockResolvedValue({
      content: 'GET https://httpbin.dev/get?from=raw\n',
      parseStatus: 'ok' as const,
      requests: [
        {
          requestIndex: 0,
          fingerprint: 'b'.repeat(64),
          method: 'GET',
          url: 'https://httpbin.dev/get?from=raw',
          headers: [{ name: 'Accept', value: 'application/json' }],
        },
      ],
      diagnostics: [],
    })
    const onSyncSuccess = vi.fn()
    render(
      <RequestEditor
        {...baseProps}
        draft={{
          ...draft,
          content: 'GET https://httpbin.dev/get?from=raw\n',
        }}
        syncCollection={syncCollection}
        onSyncSuccess={onSyncSuccess}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Raw .http' }))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Raw .http' }).getAttribute('aria-selected')).toBe(
        'true',
      )
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Headers (1)' }))

    await waitFor(() => {
      expect(onSyncSuccess).toHaveBeenCalled()
    })
    expect(screen.getByRole('tab', { name: 'Headers (1)' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })

  it('shows parse error alert and stays on Raw when reparse fails', async () => {
    const errorResponse = {
      content: 'NOT_VALID',
      parseStatus: 'error' as const,
      requests: [],
      diagnostics: [{ line: 1, message: 'Expected request line' }],
    }
    const syncCollection = vi.fn().mockImplementation(
      async (input: { body: { patch?: unknown } }) => {
        if (input.body.patch) return syncOk
        return errorResponse
      },
    )

    render(
      <RequestEditor
        {...baseProps}
        draft={{ ...draft, content: 'NOT_VALID' }}
        syncCollection={syncCollection}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Raw .http' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Raw HTTP file')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Headers (1)' }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Line 1:/)
    })
    expect(screen.getByRole('tab', { name: 'Raw .http' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })
})
