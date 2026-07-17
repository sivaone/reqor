import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DotenvStore } from './dotenv-store.js'
import { EnvResolver } from './env-resolver.js'
import { EnvironmentStore } from './environment-store.js'
import { resolveRequest } from './resolve-request.js'

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reqor-resolve-req-'))
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, ...relativePath.split('/'))
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, contents, 'utf8')
  }
  return root
}

async function createResolver(files: Record<string, string>) {
  const root = await createTempRepo(files)
  const dotenvStore = new DotenvStore()
  const environmentStore = new EnvironmentStore()
  await Promise.all([dotenvStore.load(root), environmentStore.loadAll(root)])
  return { root, resolver: new EnvResolver(dotenvStore, environmentStore) }
}

describe('resolveRequest', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('resolves env placeholders with merge order env → dotenv', async () => {
    const { root, resolver } = await createResolver({
      'http-client.env.json': JSON.stringify({
        development: { host: 'env.example.com' },
      }),
      '.env': 'host=dotenv.example.com\nAPI_KEY=from-dotenv',
    })
    tempDirs.push(root)

    const result = resolveRequest(
      {
        method: 'GET',
        url: 'https://{{host}}/path',
        headers: [{ name: 'X-Key', value: '{{API_KEY}}' }],
        environmentName: 'development',
      },
      resolver,
    )

    expect(result.hasVariables).toBe(true)
    expect(result.unresolved).toBeNull()
    expect(result.resolved.url).toBe('https://env.example.com/path')
    expect(result.resolved.headers[0]?.value).toBe('from-dotenv')
  })

  it('resolves builtins and dotenv without an active environment', async () => {
    const { root, resolver } = await createResolver({
      '.env': 'API_KEY=dotenv-secret',
    })
    tempDirs.push(root)

    vi.spyOn(crypto, 'randomUUID').mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890)
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const result = resolveRequest(
      {
        method: 'POST',
        url: 'https://example.com/{{$uuid}}',
        headers: [
          { name: 'X-Time', value: '{{$timestamp}}' },
          { name: 'X-Rand', value: '{{$randomInt}}' },
          { name: 'Authorization', value: 'Bearer {{$dotenv API_KEY}}' },
        ],
        body: { kind: 'json', content: '{"n":{{$randomInt}}}' },
        environmentName: null,
      },
      resolver,
    )

    expect(result.unresolved).toBeNull()
    expect(result.resolved.url).toBe(
      'https://example.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    )
    expect(result.resolved.headers[0]?.value).toBe('1234567890')
    expect(result.resolved.headers[1]?.value).toBe('999')
    expect(result.resolved.headers[2]?.value).toBe('Bearer dotenv-secret')
    expect(result.resolved.body?.content).toBe('{"n":999}')
  })

  it('marks env-kind unresolved when no active environment', async () => {
    const { root, resolver } = await createResolver({
      '.env': 'host=dotenv-host',
    })
    tempDirs.push(root)

    const result = resolveRequest(
      {
        method: 'GET',
        url: 'https://{{host}}/get',
        headers: [],
        environmentName: null,
      },
      resolver,
    )

    expect(result.hasVariables).toBe(true)
    expect(result.unresolved).toEqual({ name: 'host', raw: '{{host}}' })
    expect(result.resolved.url).toBe('https://{{host}}/get')
  })

  it('replaces multiple placeholders right-to-left without offset drift', async () => {
    const { root, resolver } = await createResolver({
      'http-client.env.json': JSON.stringify({
        development: { a: 'AAA', b: 'BBB' },
      }),
    })
    tempDirs.push(root)

    const result = resolveRequest(
      {
        method: 'GET',
        url: 'https://example.com/{{a}}/{{b}}',
        headers: [],
        environmentName: 'development',
      },
      resolver,
    )

    expect(result.resolved.url).toBe('https://example.com/AAA/BBB')
  })

  it('does not recursively resolve placeholders inside env values (single-pass)', async () => {
    const { root, resolver } = await createResolver({
      'http-client.env.json': JSON.stringify({
        development: { host: 'https://{{nested}}' },
      }),
    })
    tempDirs.push(root)

    const result = resolveRequest(
      {
        method: 'GET',
        url: '{{host}}/path',
        headers: [],
        environmentName: 'development',
      },
      resolver,
    )

    expect(result.unresolved).toBeNull()
    expect(result.resolved.url).toBe('https://{{nested}}/path')
  })

  it('hasVariables is false when no placeholders are present', async () => {
    const { root, resolver } = await createResolver({})
    tempDirs.push(root)

    const result = resolveRequest(
      {
        method: 'GET',
        url: 'https://example.com/get',
        headers: [{ name: 'Accept', value: 'application/json' }],
      },
      resolver,
    )

    expect(result.hasVariables).toBe(false)
    expect(result.unresolved).toBeNull()
    expect(result.resolved.url).toBe('https://example.com/get')
  })

  it('includes secrets for redaction from dotenv and isSecret env vars', async () => {
    const { root, resolver } = await createResolver({
      'http-client.env.json': JSON.stringify({ development: { host: 'localhost' } }),
      'http-client.private.env.json': JSON.stringify({
        development: { password: 'super-secret' },
      }),
      '.env': 'API_KEY=dotenv-secret',
    })
    tempDirs.push(root)

    const result = resolveRequest(
      {
        method: 'GET',
        url: 'https://{{host}}',
        headers: [],
        environmentName: 'development',
      },
      resolver,
    )

    expect(result.secrets.sort()).toEqual(['dotenv-secret', 'super-secret'].sort())
  })

  it('stops at first unresolved and leaves later placeholders untouched', async () => {
    const { root, resolver } = await createResolver({
      'http-client.env.json': JSON.stringify({
        development: { known: 'ok' },
      }),
    })
    tempDirs.push(root)

    const result = resolveRequest(
      {
        method: 'GET',
        url: 'https://example.com/{{missing}}/{{known}}',
        headers: [],
        environmentName: 'development',
      },
      resolver,
    )

    expect(result.unresolved).toEqual({ name: 'missing', raw: '{{missing}}' })
    expect(result.resolved.url).toBe('https://example.com/{{missing}}/{{known}}')
  })
})
