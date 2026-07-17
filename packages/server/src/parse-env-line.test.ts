import { describe, expect, it } from 'vitest'
import { parseEnvContents, parseEnvLine } from './parse-env-line.js'

describe('parseEnvLine', () => {
  it('parses simple KEY=VALUE', () => {
    expect(parseEnvLine('API_KEY=secret123')).toEqual(['API_KEY', 'secret123'])
  })

  it('skips comments and blank lines', () => {
    expect(parseEnvLine('# comment')).toBeUndefined()
    expect(parseEnvLine('')).toBeUndefined()
    expect(parseEnvLine('   ')).toBeUndefined()
  })

  it('strips double and single quotes', () => {
    expect(parseEnvLine('A="quoted"')).toEqual(['A', 'quoted'])
    expect(parseEnvLine("B='single'")).toEqual(['B', 'single'])
  })

  it('rejects lines without separator or empty key', () => {
    expect(parseEnvLine('NO_SEPARATOR')).toBeUndefined()
    expect(parseEnvLine('=value')).toBeUndefined()
  })
})

describe('parseEnvContents', () => {
  it('merges lines with later keys overriding', () => {
    const map = parseEnvContents('A=1\nB=2\nA=3')
    expect(map.get('A')).toBe('3')
    expect(map.get('B')).toBe('2')
  })
})
