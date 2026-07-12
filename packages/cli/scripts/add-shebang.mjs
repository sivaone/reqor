import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const target = join(__dirname, '..', 'dist', 'index.js')
const content = readFileSync(target, 'utf8')

if (!content.startsWith('#!')) {
  writeFileSync(target, `#!/usr/bin/env node\n${content}`)
}
