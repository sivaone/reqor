import { fireEvent, render, screen } from '@testing-library/react'
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

  it('disables Send while pending and fires follow redirects toggle', () => {
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
      />,
    )

    expect(screen.queryByText(/^Environment:/)).toBeNull()
  })
})
