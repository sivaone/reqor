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

  private resolveAbsolutePath(repositoryRoot: string, id: string): string | null {
    const root = path.resolve(repositoryRoot)
    const absolute = path.resolve(root, ...id.split('/'))
    const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`
    if (absolute !== root && !absolute.startsWith(rootWithSep)) {
      return null
    }
    return absolute
  }

  async save(
    id: string,
    content: string,
    repositoryRoot: string,
  ): Promise<
    | { ok: true; detail: CollectionDetailDtoType }
    | { ok: false; code: 'NOT_FOUND' | 'WRITE_FAILED'; message: string }
  > {
    if (!this.collections.has(id)) {
      return { ok: false, code: 'NOT_FOUND', message: 'Collection not found' }
    }

    const absolutePath = this.resolveAbsolutePath(repositoryRoot, id)
    if (!absolutePath) {
      return {
        ok: false,
        code: 'WRITE_FAILED',
        message: 'Collection path is outside repository root',
      }
    }

    const dir = path.dirname(absolutePath)
    const basename = path.basename(absolutePath)
    const tempPath = path.join(dir, `.${basename}.${process.pid}.${Date.now()}.tmp`)

    try {
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(tempPath, content, 'utf8')
      await fs.rename(tempPath, absolutePath)
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code === 'EACCES' || code === 'EPERM' || code === 'ENOSPC') {
        return {
          ok: false,
          code: 'WRITE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to write collection file',
        }
      }
      return {
        ok: false,
        code: 'WRITE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to write collection file',
      }
    }

    const parseResult = parseHttpFile(content, { file: id })
    const detail = toCollectionDetail(id, content, parseResult)
    this.collections.set(id, detail)
    return { ok: true, detail }
  }
}
