import { describe, expect, it } from 'vitest'
import { resolveBrowserOpenCommand } from './browser-open.js'
import { formatServeUrl, parseCliArgs } from './cli-args.js'
import { serve } from './index.js'
import { formatRepositoryAccessError } from './repository-path.js'

describe('@reqor/cli', () => {
  it('exports serve function', () => {
    expect(serve).toBeTypeOf('function')
  })

  describe('parseCliArgs', () => {
    it('parses serve without path', () => {
      expect(parseCliArgs(['serve'])).toEqual({ command: 'serve', repositoryPath: undefined })
    })

    it('parses serve with path', () => {
      expect(parseCliArgs(['serve', './api-tests'])).toEqual({
        command: 'serve',
        repositoryPath: './api-tests',
      })
    })

    it('returns undefined for unknown commands', () => {
      expect(parseCliArgs(['unknown'])).toBeUndefined()
    })
  })

  describe('formatServeUrl', () => {
    it('formats localhost URL', () => {
      expect(formatServeUrl('127.0.0.1', 3000)).toBe('http://127.0.0.1:3000')
    })
  })

  describe('resolveBrowserOpenCommand', () => {
    it('returns win32 command', () => {
      expect(resolveBrowserOpenCommand('http://127.0.0.1:3000', 'win32')).toEqual({
        command: 'cmd',
        args: ['/c', 'start', '', 'http://127.0.0.1:3000'],
      })
    })

    it('returns darwin command', () => {
      expect(resolveBrowserOpenCommand('http://127.0.0.1:3000', 'darwin')).toEqual({
        command: 'open',
        args: ['http://127.0.0.1:3000'],
      })
    })

    it('returns linux command', () => {
      expect(resolveBrowserOpenCommand('http://127.0.0.1:3000', 'linux')).toEqual({
        command: 'xdg-open',
        args: ['http://127.0.0.1:3000'],
      })
    })
  })

  describe('formatRepositoryAccessError', () => {
    it('reports missing paths as does not exist', () => {
      const err = Object.assign(new Error('noent'), { code: 'ENOENT' })
      expect(formatRepositoryAccessError('/tmp/missing', err)).toBe(
        'Path does not exist: /tmp/missing',
      )
    })

    it('reports other access failures with the underlying error', () => {
      const err = Object.assign(new Error('permission denied'), { code: 'EACCES' })
      expect(formatRepositoryAccessError('/tmp/locked', err)).toBe(
        'Cannot access path /tmp/locked: Error: permission denied',
      )
    })
  })
})
