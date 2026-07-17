import fs from 'node:fs/promises'
import path from 'node:path'
import { parseHttpClientEnvironments, type ParsedEnvironment } from '@reqor/http-parser'
import type { EnvironmentDtoType } from '@reqor/shared-types'
import { scanEnvFiles } from './scan-env.js'
import { toEnvironmentsDto } from './to-env-dto.js'

async function readEnvFile(absolutePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(absolutePath, 'utf8')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read environment file'
    console.warn(`[environments] Failed to read ${absolutePath}: ${message}`)
    return undefined
  }
}

export class EnvironmentStore {
  private environments = new Map<string, ParsedEnvironment>()
  private loadQueue: Promise<void> = Promise.resolve()

  async loadAll(repositoryRoot: string): Promise<EnvironmentDtoType[]> {
    const operation = this.loadQueue.then(async () => {
      const nextEnvironments = new Map<string, ParsedEnvironment>()
      const pairs = await scanEnvFiles(repositoryRoot)

      for (const pair of pairs) {
        let publicContent: string | undefined
        let privateContent: string | undefined

        if (pair.publicFile) {
          const absolutePath = path.join(repositoryRoot, ...pair.publicFile.split('/'))
          publicContent = await readEnvFile(absolutePath)
        }

        if (pair.privateFile) {
          const absolutePath = path.join(repositoryRoot, ...pair.privateFile.split('/'))
          privateContent = await readEnvFile(absolutePath)
        }

        if (publicContent === undefined && privateContent === undefined) {
          continue
        }

        const parseResult = parseHttpClientEnvironments({
          publicContent,
          privateContent,
          publicSourceFile: pair.publicFile,
          privateSourceFile: pair.privateFile,
        })

        for (const diagnostic of parseResult.diagnostics) {
          const location = diagnostic.file ?? pair.publicFile ?? pair.privateFile ?? 'unknown'
          console.warn(`[environments] ${location}: ${diagnostic.message}`)
        }

        for (const environment of parseResult.environments) {
          nextEnvironments.set(environment.name, environment)
        }
      }

      this.environments = nextEnvironments

      return this.list()
    })

    this.loadQueue = operation.then(
      () => undefined,
      () => undefined,
    )

    return operation
  }

  get(name: string): ParsedEnvironment | undefined {
    return this.environments.get(name)
  }

  list(): EnvironmentDtoType[] {
    return toEnvironmentsDto([...this.environments.values()])
  }
}
