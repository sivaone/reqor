import { describe, expect, it } from 'vitest'
import { DIAG_PARSE_ERROR, DIAG_UNSUPPORTED_VALUE } from './diagnostics.js'
import { parseHttpClientEnvironments } from './environments.js'

describe('parseHttpClientEnvironments', () => {
  it('parses public-only file with string and number values coerced', () => {
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({
        development: { host: 'localhost', 'id-value': 12345 },
        production: { host: 'example.com', enabled: true },
      }),
      publicSourceFile: 'http-client.env.json',
    })

    expect(result.diagnostics).toEqual([])
    expect(result.environments).toHaveLength(2)
    expect(result.environments[0]).toEqual({
      name: 'development',
      sourceFile: 'http-client.env.json',
      variables: [
        { key: 'host', value: 'localhost', isSecret: false },
        { key: 'id-value', value: '12345', isSecret: false },
      ],
    })
    expect(result.environments[1]).toEqual({
      name: 'production',
      sourceFile: 'http-client.env.json',
      variables: [
        { key: 'enabled', value: 'true', isSecret: false },
        { key: 'host', value: 'example.com', isSecret: false },
      ],
    })
  })

  it('preserves empty string values from public file', () => {
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({
        development: { username: '' },
      }),
    })

    expect(result.environments[0]?.variables).toEqual([
      { key: 'username', value: '', isSecret: false },
    ])
  })

  it('strips UTF-8 BOM before parsing JSON', () => {
    const result = parseHttpClientEnvironments({
      publicContent: `\uFEFF${JSON.stringify({
        development: { host: 'localhost' },
      })}`,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.environments).toEqual([
      {
        name: 'development',
        sourceFile: 'http-client.env.json',
        variables: [{ key: 'host', value: 'localhost', isSecret: false }],
      },
    ])
  })

  it('merges public and private with private override and isSecret flags', () => {
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({
        development: { host: 'localhost', username: 'public-user', password: 'public-pass' },
      }),
      privateContent: JSON.stringify({
        development: { username: 'secret-user', password: 'secret-pass', token: 'abc' },
      }),
      publicSourceFile: 'api/http-client.env.json',
      privateSourceFile: 'api/http-client.private.env.json',
    })

    const dev = result.environments.find((e) => e.name === 'development')
    expect(dev?.sourceFile).toBe('api/http-client.env.json')
    expect(dev?.variables).toEqual([
      { key: 'host', value: 'localhost', isSecret: false },
      { key: 'password', value: 'secret-pass', isSecret: true },
      { key: 'token', value: 'abc', isSecret: true },
      { key: 'username', value: 'secret-user', isSecret: true },
    ])
  })

  it('marks private-only keys and empty private strings as secret', () => {
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({
        development: { host: 'localhost' },
      }),
      privateContent: JSON.stringify({
        development: { apiKey: 'key123', note: '' },
      }),
    })

    const dev = result.environments[0]
    expect(dev?.variables).toEqual([
      { key: 'apiKey', value: 'key123', isSecret: true },
      { key: 'host', value: 'localhost', isSecret: false },
      { key: 'note', value: '', isSecret: true },
    ])
  })

  it('parses private-only file when public is absent', () => {
    const result = parseHttpClientEnvironments({
      privateContent: JSON.stringify({
        staging: { host: 'staging.example.com' },
      }),
      privateSourceFile: 'services/http-client.private.env.json',
    })

    expect(result.environments).toEqual([
      {
        name: 'staging',
        sourceFile: 'services/http-client.private.env.json',
        variables: [{ key: 'host', value: 'staging.example.com', isSecret: true }],
      },
    ])
  })

  it('returns parse error diagnostic and empty environments for invalid JSON', () => {
    const result = parseHttpClientEnvironments({
      publicContent: '{ not json',
      publicSourceFile: 'bad/http-client.env.json',
    })

    expect(result.environments).toEqual([])
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({
      line: 1,
      code: DIAG_PARSE_ERROR,
      file: 'bad/http-client.env.json',
    })
  })

  it('skips empty-string environment names with diagnostic', () => {
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({
        '': { host: 'localhost' },
        development: { host: 'dev.example.com' },
      }),
    })

    expect(result.environments).toHaveLength(1)
    expect(result.environments[0]?.name).toBe('development')
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: DIAG_UNSUPPORTED_VALUE,
        message: 'Skipping environment with empty name',
      }),
    ])
  })

  it('skips non-object environment entries with diagnostic', () => {
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({
        development: { host: 'localhost' },
        invalid: 'not-an-object',
        broken: null,
      }),
    })

    expect(result.environments).toHaveLength(1)
    expect(result.environments[0]?.name).toBe('development')
    expect(result.diagnostics).toHaveLength(2)
    expect(result.diagnostics[0]?.code).toBe(DIAG_UNSUPPORTED_VALUE)
    expect(result.diagnostics[0]?.message).toContain('invalid')
    expect(result.diagnostics[1]?.message).toContain('broken')
  })

  it('skips unsupported variable value types with diagnostic', () => {
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({
        development: { host: 'localhost', meta: { nested: true }, tags: ['a'] },
      }),
    })

    const dev = result.environments[0]
    expect(dev?.variables).toEqual([{ key: 'host', value: 'localhost', isSecret: false }])
    expect(result.diagnostics).toHaveLength(2)
    expect(result.diagnostics.every((d) => d.code === DIAG_UNSUPPORTED_VALUE)).toBe(true)
  })

  it('returns stable sort order for environments and variables', () => {
    const result = parseHttpClientEnvironments({
      publicContent: JSON.stringify({
        zebra: { z: '1', a: '2' },
        alpha: { m: '3', b: '4' },
      }),
    })

    expect(result.environments.map((e) => e.name)).toEqual(['alpha', 'zebra'])
    expect(result.environments[1]?.variables.map((v) => v.key)).toEqual(['a', 'z'])
  })
})
