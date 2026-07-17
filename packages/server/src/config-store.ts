import fs from 'node:fs/promises'
import path from 'node:path'

export interface ReqorConfig {
  activeEnvironment: string | null
}

function coerceActiveEnvironment(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  if (value === '') return null
  return value
}

export class ConfigStore {
  private config: ReqorConfig = { activeEnvironment: null }

  constructor(private readonly configPath: string) {}

  async load(): Promise<ReqorConfig> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      this.config = {
        activeEnvironment: coerceActiveEnvironment(parsed.activeEnvironment),
      }
    } catch {
      this.config = { activeEnvironment: null }
    }

    return this.get()
  }

  async save(update: Partial<ReqorConfig>): Promise<ReqorConfig> {
    const next: ReqorConfig = {
      activeEnvironment:
        update.activeEnvironment !== undefined
          ? update.activeEnvironment
          : this.config.activeEnvironment,
    }

    const dir = path.dirname(this.configPath)
    await fs.mkdir(dir, { recursive: true })

    const tempPath = path.join(dir, `.config.${process.pid}.${Date.now()}.tmp`)
    const content = `${JSON.stringify(next, null, 2)}\n`

    try {
      await fs.writeFile(tempPath, content, 'utf8')
      await fs.rename(tempPath, this.configPath)
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined)
      throw error
    }

    this.config = next
    return this.get()
  }

  get(): ReqorConfig {
    return { ...this.config }
  }
}
