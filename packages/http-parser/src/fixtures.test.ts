import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DIAG_PARSE_ERROR, DIAG_UNSUPPORTED_CONSTRUCT, parseHttpFile } from './index.js'

interface ManifestEntry {
  path: string
  source: string
  expect: 'pass' | 'fail'
  notes?: string
}

interface Manifest {
  version: number
  files: ManifestEntry[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesRoot = join(__dirname, '..', 'fixtures')

function loadManifest(): Manifest {
  const raw = readFileSync(join(fixturesRoot, 'manifest.json'), 'utf8')
  return JSON.parse(raw) as Manifest
}

function filePasses(content: string, filePath: string): { pass: boolean; reason?: string } {
  const result = parseHttpFile(content, { file: filePath })

  const parseErrors = result.diagnostics.filter((d) => d.code === DIAG_PARSE_ERROR)
  if (parseErrors.length > 0) {
    return {
      pass: false,
      reason: parseErrors.map((d) => `L${d.line}: ${d.message}`).join('; '),
    }
  }

  const isEmpty = content.trim() === ''
  if (!isEmpty && result.requests.length === 0) {
    return { pass: false, reason: 'No requests extracted from non-empty file' }
  }

  const silentOut = result.diagnostics.some(
    (d) =>
      d.message.includes('Unsupported') === false &&
      (d.message.includes('@') ||
        d.message.includes('script') ||
        d.message.includes('inclusion') ||
        d.message.includes('OAuth')),
  )

  if (silentOut) {
    return { pass: false, reason: 'OUT construct may have been silently skipped' }
  }

  for (const d of result.diagnostics) {
    if (
      d.code &&
      d.code !== DIAG_UNSUPPORTED_CONSTRUCT &&
      d.code !== DIAG_PARSE_ERROR
    ) {
      continue
    }
  }

  return { pass: true }
}

describe('fixture corpus SM-2 gate', () => {
  const manifest = loadManifest()

  it('manifest lists 50 corpus files', () => {
    expect(manifest.files).toHaveLength(50)
    expect(manifest.version).toBe(1)
    for (const entry of manifest.files) {
      expect(entry.source).toBeTruthy()
      expect(entry.path).toMatch(/^corpus\/.+\.http$/)
    }
  })

  it('achieves ≥90% parse pass rate (≥45/50)', () => {
    const failures: string[] = []
    let passCount = 0

    for (const entry of manifest.files) {
      if (entry.expect !== 'pass') continue

      const content = readFileSync(join(fixturesRoot, entry.path), 'utf8')
      const outcome = filePasses(content, entry.path)

      if (outcome.pass) {
        passCount++
      } else {
        failures.push(`${entry.path}: ${outcome.reason ?? 'unknown failure'}`)
      }
    }

    if (passCount < 45) {
      console.error('\nFixture gate failures:')
      for (const f of failures) {
        console.error(`  - ${f}`)
      }
      console.error(`\nPass rate: ${passCount}/50 (${((passCount / 50) * 100).toFixed(1)}%)`)
    }

    expect(passCount).toBeGreaterThanOrEqual(45)
  })
})
