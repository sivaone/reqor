import type {
  ExecuteErrorCodeType,
  ExecuteRequestType,
  ExecuteResponseType,
} from '@reqor/shared-types'
import type { CollectionStore } from '../collection-store.js'
import type { EnvResolver } from '../env-resolver.js'
import { mergeDraftOverrides } from '../merge-draft-overrides.js'
import { redactSecrets } from '../redact-secrets.js'
import { resolveRequest } from '../resolve-request.js'

export const PROXY_TIMEOUT_MS = 30_000
const MAX_REDIRECT_HOPS = 10

const ALLOWED_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

export type ExecuteErrorCode = ExecuteErrorCodeType

export class ExecuteError extends Error {
  constructor(
    public readonly code: ExecuteErrorCodeType,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ExecuteError'
  }
}

export interface ExecuteRequestDeps {
  envResolver: EnvResolver
  /** Resolved active environment name (body.environment ?? config); null when none/invalid */
  environmentName: string | null
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    if (response.body) {
      await response.body.cancel()
      return
    }
    await response.arrayBuffer()
  } catch {
    // Ignore drain/cancel failures; hop loop continues with next fetch.
  }
}

function combineSignals(
  requestAbort: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): AbortSignal {
  if (!requestAbort) return timeoutSignal
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([requestAbort, timeoutSignal])
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (requestAbort.aborted || timeoutSignal.aborted) {
    controller.abort()
  } else {
    requestAbort.addEventListener('abort', abort, { once: true })
    timeoutSignal.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

function headersToDto(headers: Headers): Array<{ name: string; value: string }> {
  const result: Array<{ name: string; value: string }> = []
  headers.forEach((value, name) => {
    result.push({ name, value })
  })
  return result
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export async function executeRequest(
  collectionStore: CollectionStore,
  body: ExecuteRequestType,
  deps: ExecuteRequestDeps,
  requestAbort?: AbortSignal,
): Promise<ExecuteResponseType> {
  const collection = collectionStore.get(body.collectionId)
  if (!collection) {
    throw new ExecuteError('NOT_FOUND', 'Collection not found', 404, {
      collectionId: body.collectionId,
    })
  }

  if (collection.parseStatus === 'error') {
    throw new ExecuteError('INVALID_REQUEST', 'Collection has parse errors', 400, {
      collectionId: body.collectionId,
    })
  }

  if (collection.requests.length === 0) {
    throw new ExecuteError('INVALID_REQUEST', 'Collection has no requests', 400, {
      collectionId: body.collectionId,
    })
  }

  const req = collection.requests[body.requestIndex]
  if (!req) {
    throw new ExecuteError('NOT_FOUND', 'Request not found', 404, {
      collectionId: body.collectionId,
      requestIndex: body.requestIndex,
    })
  }

  const followRedirects = body.followRedirects ?? true
  const merged = mergeDraftOverrides(req, body)
  const method = merged.method

  if (!ALLOWED_METHODS.has(method)) {
    throw new ExecuteError('INVALID_REQUEST', 'Invalid HTTP method', 400, { method })
  }

  const resolution = resolveRequest(
    {
      ...merged,
      environmentName: deps.environmentName,
    },
    deps.envResolver,
  )

  if (resolution.unresolved) {
    throw new ExecuteError(
      'UNRESOLVED_VARIABLE',
      `Unresolved variable: ${resolution.unresolved.raw}`,
      400,
      {
        name: resolution.unresolved.name,
        raw: resolution.unresolved.raw,
      },
    )
  }

  let currentUrl = resolution.resolved.url

  if (!isHttpUrl(currentUrl)) {
    throw new ExecuteError(
      'INVALID_REQUEST',
      'Only http:// and https:// URLs are supported',
      400,
    )
  }

  const headers = new Headers()
  for (const h of resolution.resolved.headers) {
    const name = h.name.toLowerCase()
    if (name === 'host' || name === 'content-length') continue
    headers.set(h.name, h.value)
  }

  let fetchBody: string | undefined
  if (resolution.resolved.body && method !== 'GET' && method !== 'HEAD') {
    fetchBody = resolution.resolved.body.content
  }

  const timeoutSignal = AbortSignal.timeout(PROXY_TIMEOUT_MS)
  const signal = combineSignals(requestAbort, timeoutSignal)

  const started = performance.now()
  const safeUrlForLog = redactSecrets(currentUrl, resolution.secrets)

  try {
    let response = await fetch(currentUrl, {
      method,
      headers,
      body: fetchBody,
      redirect: 'manual',
      signal,
    })

    let hops = 0
    let nextMethod = method
    let nextBody = fetchBody

    while (followRedirects && isRedirect(response.status) && hops < MAX_REDIRECT_HOPS) {
      const location = response.headers.get('location')
      if (!location) break

      try {
        currentUrl = new URL(location, currentUrl).href
      } catch {
        throw new ExecuteError('INVALID_REQUEST', 'Invalid redirect Location', 400, {
          location: redactSecrets(location, resolution.secrets),
        })
      }

      if (!isHttpUrl(currentUrl)) {
        throw new ExecuteError(
          'INVALID_REQUEST',
          'Redirect target must be http:// or https://',
          400,
        )
      }

      if ([301, 302, 303].includes(response.status) && !['GET', 'HEAD'].includes(nextMethod)) {
        nextMethod = 'GET'
        nextBody = undefined
      }

      await discardResponseBody(response)

      response = await fetch(currentUrl, {
        method: nextMethod,
        headers,
        body: nextBody,
        redirect: 'manual',
        signal,
      })
      hops++
    }

    if (followRedirects && isRedirect(response.status) && hops >= MAX_REDIRECT_HOPS) {
      throw new ExecuteError('TOO_MANY_REDIRECTS', 'Too many redirects', 502)
    }

    const responseBody = await response.text()
    const timingMs = performance.now() - started

    return {
      status: response.status,
      statusText: response.statusText ?? '',
      headers: headersToDto(response.headers),
      body: responseBody,
      timingMs,
      sizeBytes: byteLength(responseBody),
    }
  } catch (error) {
    if (error instanceof ExecuteError) throw error

    const message = error instanceof Error ? error.message : 'Proxy request failed'
    const cause = error instanceof Error ? error.name : undefined
    const safeMessage = redactSecrets(message, resolution.secrets)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExecuteError('PROXY_FAILED', 'Request aborted or timed out', 502, {
        cause: cause ?? 'AbortError',
        url: safeUrlForLog,
      })
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ExecuteError('PROXY_FAILED', 'Request timed out', 502, {
        cause: 'TimeoutError',
        url: safeUrlForLog,
      })
    }

    throw new ExecuteError('PROXY_FAILED', safeMessage, 502, {
      cause,
      url: safeUrlForLog,
    })
  }
}
