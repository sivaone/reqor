import fs from 'node:fs/promises'
import path from 'node:path'
import { parseEnvContents } from './parse-env-line.js'

/** Repo-root dotenv variants loaded in ascending precedence (later overrides earlier). */
export const DOTENV_VARIANT_FILES = ['.env', '.env.staging', '.env.local'] as const

async function readDotenvFile(absolutePath: string): Promise<Map<string, string>> {
  try {
    const contents = await fs.readFile(absolutePath, 'utf8')
    return parseEnvContents(contents)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    if (code === 'ENOENT') {
      return new Map()
    }

    const message = error instanceof Error ? error.message : 'Failed to read dotenv file'
    console.warn(`[dotenv] Failed to read ${absolutePath}: ${message}`)
    return new Map()
  }
}

export class DotenvStore {
  private values = new Map<string, string>()
  private loadQueue: Promise<void> = Promise.resolve()

  async load(repositoryRoot: string): Promise<void> {
    const operation = this.loadQueue.then(async () => {
      const merged = new Map<string, string>()

      for (const fileName of DOTENV_VARIANT_FILES) {
        const absolutePath = path.join(repositoryRoot, fileName)
        const fileValues = await readDotenvFile(absolutePath)
        for (const [key, value] of fileValues) {
          merged.set(key, value)
        }
      }

      this.values = merged
    })

    this.loadQueue = operation.then(
      () => undefined,
      () => undefined,
    )

    return operation
  }

  get(key: string): string | undefined {
    return this.values.get(key)
  }

  has(key: string): boolean {
    return this.values.has(key)
  }

  /** All merged values — server-internal only; never expose via API. */
  getAllValues(): ReadonlyMap<string, string> {
    return this.values
  }
}
