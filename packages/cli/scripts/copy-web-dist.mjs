import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliPackageDir = join(__dirname, '..')
const sourceDir = join(cliPackageDir, '..', 'web', 'dist')
const targetDir = join(cliPackageDir, 'web-dist')

if (!existsSync(sourceDir)) {
  console.error(
    `Web build output not found at ${sourceDir}. Run pnpm --filter @reqor/web build first.`,
  )
  process.exit(1)
}

rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })
cpSync(sourceDir, targetDir, { recursive: true })

console.log(`Copied ${sourceDir} -> ${targetDir}`)
