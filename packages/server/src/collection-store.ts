import fs from 'node:fs/promises'
import path from 'node:path'
import { parseHttpFile } from '@reqor/http-parser'
import type { CollectionDetailDtoType, CollectionSummaryDtoType } from '@reqor/shared-types'
import { scanHttpFiles } from './scan.js'
import {
  createErrorCollectionDetail,
  toCollectionDetail,
  toCollectionSummary,
} from './to-dto.js'

export class CollectionStore {
  private collections = new Map<string, CollectionDetailDtoType>()
  private loadQueue: Promise<void> = Promise.resolve()

  async loadAll(repositoryRoot: string): Promise<CollectionSummaryDtoType[]> {
    const operation = this.loadQueue.then(async () => {
      const nextCollections = new Map<string, CollectionDetailDtoType>()
      const ids = await scanHttpFiles(repositoryRoot)

      for (const id of ids) {
        const absolutePath = path.join(repositoryRoot, ...id.split('/'))

        try {
          const content = await fs.readFile(absolutePath, 'utf8')
          const parseResult = parseHttpFile(content, { file: id })
          nextCollections.set(id, toCollectionDetail(id, content, parseResult))
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to read collection file'
          nextCollections.set(id, createErrorCollectionDetail(id, '', message))
        }
      }

      this.collections = nextCollections

      return this.list()
    })

    this.loadQueue = operation.then(
      () => undefined,
      () => undefined,
    )

    return operation
  }

  get(id: string): CollectionDetailDtoType | undefined {
    return this.collections.get(id)
  }

  list(): CollectionSummaryDtoType[] {
    return [...this.collections.values()]
      .map(toCollectionSummary)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }
}
