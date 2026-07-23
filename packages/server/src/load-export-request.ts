import {
  SECRET_MASK,
  SECRET_SNIPPET_PLACEHOLDER,
  type PreviewRequestType,
} from '@reqor/shared-types'
import type { CollectionStore } from './collection-store.js'
import type { ConfigStore } from './config-store.js'
import type { EnvResolver } from './env-resolver.js'
import type { EnvironmentStore } from './environment-store.js'
import { mergeDraftOverrides, type MergedRequestFields } from './merge-draft-overrides.js'
import { ExecuteError } from './proxy/execute-request.js'
import { redactSecrets } from './redact-secrets.js'
import { resolveEnvironmentName } from './resolve-environment-name.js'
import { resolveRequest } from './resolve-request.js'

const ALLOWED_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

export type RedactedExportRequest = MergedRequestFields

type LoadMergedRequestOptions = {
  secretReplacement?: string
}

function loadMergedRequest(
  collectionStore: CollectionStore,
  body: PreviewRequestType,
  configStore: ConfigStore,
  environmentStore: EnvironmentStore,
  envResolver: EnvResolver,
  options: LoadMergedRequestOptions = {},
): RedactedExportRequest {
  const secretReplacement = options.secretReplacement ?? SECRET_MASK

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

  const environmentName = resolveEnvironmentName(
    body.environment,
    configStore,
    environmentStore,
  )

  const merged = mergeDraftOverrides(req, body)
  const method = merged.method

  if (!ALLOWED_METHODS.has(method)) {
    throw new ExecuteError('INVALID_REQUEST', 'Invalid HTTP method', 400, { method })
  }

  const resolution = resolveRequest(
    {
      ...merged,
      environmentName,
    },
    envResolver,
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

  const url = resolution.resolved.url
  if (!isHttpUrl(url)) {
    throw new ExecuteError(
      'INVALID_REQUEST',
      'Only http:// and https:// URLs are supported',
      400,
    )
  }

  const secrets = resolution.secrets
  const redactedHeaders = resolution.resolved.headers.map((header) => ({
    name: header.name,
    value: redactSecrets(header.value, secrets, secretReplacement),
  }))

  const redactedBody = resolution.resolved.body
    ? {
        kind: resolution.resolved.body.kind,
        content: redactSecrets(resolution.resolved.body.content, secrets, secretReplacement),
      }
    : undefined

  return {
    method: resolution.resolved.method,
    url: redactSecrets(url, secrets, secretReplacement),
    headers: redactedHeaders,
    ...(redactedBody ? { body: redactedBody } : {}),
  }
}

export function loadMergedRequestForExport(
  collectionStore: CollectionStore,
  body: PreviewRequestType,
  configStore: ConfigStore,
  environmentStore: EnvironmentStore,
  envResolver: EnvResolver,
): RedactedExportRequest {
  return loadMergedRequest(
    collectionStore,
    body,
    configStore,
    environmentStore,
    envResolver,
    { secretReplacement: SECRET_MASK },
  )
}

export function loadMergedRequestForSnippetExport(
  collectionStore: CollectionStore,
  body: PreviewRequestType,
  configStore: ConfigStore,
  environmentStore: EnvironmentStore,
  envResolver: EnvResolver,
): RedactedExportRequest {
  return loadMergedRequest(
    collectionStore,
    body,
    configStore,
    environmentStore,
    envResolver,
    { secretReplacement: SECRET_SNIPPET_PLACEHOLDER },
  )
}
