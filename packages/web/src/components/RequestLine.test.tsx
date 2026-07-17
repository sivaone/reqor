import { fireEvent, render, screen } from '@testing-library/react'
import { SECRET_MASK } from '@reqor/shared-types'
import { describe, expect, it, vi } from 'vitest'
import { RequestLine } from './RequestLine.js'

const baseProps = {
  method: 'GET',
  url: 'https://httpbin.dev/get',
  headers: [] as { name: string; value: string }[],
  body: null as null,
  onMethodChange: vi.fn(),
  onUrlChange: vi.fn(),
  followRedirects: true,
  onFollowRedirectsChange: vi.fn(),
  onSend: vi.fn(),
  isSending: false,
  canSend: true,
}

describe('RequestLine', () => {
  it('calls onSend with current method, url, headers, and body', () => {
    const onSend = vi.fn()
    const onMethodChange = vi.fn()
    const onUrlChange = vi.fn()

    render(
      <RequestLine
        {...baseProps}
        method="GET"
        url="https://httpbin.dev/get"
        headers={[{ name: 'Accept', value: 'application/json' }]}
        body={null}
        onMethodChange={onMethodChange}
        onUrlChange={onUrlChange}
        onSend={onSend}
      />,
    )

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://httpbin.dev/post' },
    })
    expect(onUrlChange).toHaveBeenCalledWith('https://httpbin.dev/post')

    fireEvent.change(screen.getByLabelText('HTTP method'), {
      target: { value: 'POST' },
    })
    expect(onMethodChange).toHaveBeenCalledWith('POST')

    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))

    expect(onSend).toHaveBeenCalledWith({
      method: 'GET',
      url: 'https://httpbin.dev/get',
      headers: [{ name: 'Accept', value: 'application/json' }],
      body: null,
    })
  })

  it('disables Send when canSend is false', () => {
    const onFollowRedirectsChange = vi.fn()

    render(
      <RequestLine
        {...baseProps}
        onFollowRedirectsChange={onFollowRedirectsChange}
        isSending={true}
        canSend={false}
      />,
    )

    expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByLabelText('Follow redirects'))
    expect(onFollowRedirectsChange).toHaveBeenCalledWith(false)
  })

  it('hides Save when draft is clean', () => {
    render(<RequestLine {...baseProps} isDraftDirty={false} />)
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
  })

  it('shows enabled Save when dirty and canSave', () => {
    const onSave = vi.fn()
    render(
      <RequestLine {...baseProps} isDraftDirty={true} canSave={true} onSave={onSave} />,
    )
    const save = screen.getByRole('button', { name: /^save$/i })
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalled()
  })

  it('shows disabled Save when dirty but invalid', () => {
    render(
      <RequestLine
        {...baseProps}
        isDraftDirty={true}
        canSave={false}
        validationError="GET requests should not include a body"
      />,
    )
    expect(screen.getByRole('button', { name: /^save$/i })).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert').textContent).toBe('GET requests should not include a body')
  })

  it('includes focus ring classes on Send and Save when Save is visible', () => {
    render(<RequestLine {...baseProps} isDraftDirty={true} canSave={true} />)

    expect(screen.getByRole('button', { name: /^send$/i }).className).toContain(
      'focus-visible:outline-primary',
    )
    expect(screen.getByRole('button', { name: /^save$/i }).className).toContain(
      'focus-visible:outline-primary',
    )
  })

  it('shows environment label when activeEnvironment prop is set', () => {
    render(<RequestLine {...baseProps} activeEnvironment="production" />)
    expect(screen.getByText('Environment: production')).toBeDefined()
  })

  it('hides environment label when activeEnvironment is null', () => {
    render(<RequestLine {...baseProps} activeEnvironment={null} />)
    expect(screen.queryByText(/^Environment:/)).toBeNull()
  })

  it('shows environment variables strip with masked secrets', () => {
    render(
      <RequestLine
        {...baseProps}
        activeEnvironment="development"
        environmentVariables={[
          { key: 'host', value: 'localhost', isSecret: false },
          { key: 'token', value: '••••••', isSecret: true },
        ]}
      />,
    )

    expect(screen.getByText('localhost')).toBeDefined()
    expect(screen.getByLabelText('Secret value masked')).toBeDefined()
  })

  it('shows unresolved error microcopy and disables Send', () => {
    render(
      <RequestLine
        {...baseProps}
        method="GET"
        url="https://{{host}}/get"
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

    expect(screen.getByRole('alert').textContent).toBe('Unresolved variable: {{host}}')
    expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', true)
    expect(screen.getByText('Preview resolved request')).toBeDefined()
  })

  it('hides preview when hasVariables is false', () => {
    render(
      <RequestLine
        {...baseProps}
        preview={{
          url: 'https://httpbin.dev/get',
          headers: [],
          unresolved: null,
          hasVariables: false,
        }}
      />,
    )

    expect(screen.queryByText('Preview resolved request')).toBeNull()
  })

  it('shows redacted secret headers in preview', () => {
    render(
      <RequestLine
        {...baseProps}
        preview={{
          url: 'https://httpbin.dev/get',
          headers: [{ name: 'Authorization', value: SECRET_MASK }],
          unresolved: null,
          hasVariables: true,
        }}
      />,
    )

    expect(screen.getByLabelText('Secret value masked')).toBeDefined()
  })

  it('shows preview error status without blocking layout', () => {
    render(<RequestLine {...baseProps} previewError="Failed to preview request" />)

    expect(screen.getByRole('status').textContent).toBe('Failed to preview request')
  })
})
