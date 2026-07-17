import { fireEvent, render, screen } from '@testing-library/react'
import { SECRET_MASK } from '@reqor/shared-types'
import { describe, expect, it, vi } from 'vitest'
import { RequestLine } from './RequestLine.js'

describe('RequestLine', () => {
  it('calls onSend with current method and url', () => {
    const onSend = vi.fn()
    const onMethodChange = vi.fn()
    const onUrlChange = vi.fn()

    render(
      <RequestLine
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={onMethodChange}
        onUrlChange={onUrlChange}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={onSend}
        isSending={false}
        canSend={true}
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
    })
  })

  it('disables Send when canSend is false', () => {
    const onFollowRedirectsChange = vi.fn()

    render(
      <RequestLine
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={onFollowRedirectsChange}
        onSend={vi.fn()}
        isSending={true}
        canSend={false}
      />,
    )

    expect(screen.getByRole('button', { name: /^send$/i })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByLabelText('Follow redirects'))
    expect(onFollowRedirectsChange).toHaveBeenCalledWith(false)
  })

  it('includes focus ring classes on Send and Save', () => {
    render(
      <RequestLine
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={vi.fn()}
        isSending={false}
        canSend={true}
      />,
    )

    expect(screen.getByRole('button', { name: /^send$/i }).className).toContain(
      'focus-visible:outline-primary',
    )
    expect(screen.getByRole('button', { name: /^save$/i }).className).toContain(
      'focus-visible:outline-primary',
    )
  })

  it('shows environment label when activeEnvironment prop is set', () => {
    render(
      <RequestLine
        activeEnvironment="production"
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={vi.fn()}
        isSending={false}
        canSend={true}
      />,
    )

    expect(screen.getByText('Environment: production')).toBeDefined()
  })

  it('hides environment label when activeEnvironment is null', () => {
    render(
      <RequestLine
        activeEnvironment={null}
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={vi.fn()}
        isSending={false}
        canSend={true}
      />,
    )

    expect(screen.queryByText(/^Environment:/)).toBeNull()
  })

  it('shows environment variables strip with masked secrets', () => {
    render(
      <RequestLine
        activeEnvironment="development"
        environmentVariables={[
          { key: 'host', value: 'localhost', isSecret: false },
          { key: 'token', value: '••••••', isSecret: true },
        ]}
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={vi.fn()}
        isSending={false}
        canSend={true}
      />,
    )

    expect(screen.getByText('localhost')).toBeDefined()
    expect(screen.getByLabelText('Secret value masked')).toBeDefined()
  })

  it('shows unresolved error microcopy and disables Send', () => {
    render(
      <RequestLine
        method="GET"
        url="https://{{host}}/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={vi.fn()}
        isSending={false}
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
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={vi.fn()}
        isSending={false}
        canSend={true}
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
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={vi.fn()}
        isSending={false}
        canSend={true}
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
    render(
      <RequestLine
        method="GET"
        url="https://httpbin.dev/get"
        onMethodChange={vi.fn()}
        onUrlChange={vi.fn()}
        followRedirects={true}
        onFollowRedirectsChange={vi.fn()}
        onSend={vi.fn()}
        isSending={false}
        canSend={true}
        previewError="Failed to preview request"
      />,
    )

    expect(screen.getByRole('status').textContent).toBe('Failed to preview request')
  })
})
