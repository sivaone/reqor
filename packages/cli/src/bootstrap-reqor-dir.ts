import fs from 'node:fs/promises'
import path from 'node:path'

const REQOR_DIR_NAME = '.reqor'
const GITIGNORE_ENTRY = '.reqor/'

function gitignoreHasReqorEntry(contents: string): boolean {
  return contents
    .split(/\r?\n/)
    .some((line) => line.trim() === GITIGNORE_ENTRY || line.trim() === '.reqor')
}

export async function ensureReqorBootstrap(repositoryRoot: string): Promise<void> {
  const reqorDir = path.join(repositoryRoot, REQOR_DIR_NAME)
  await fs.mkdir(reqorDir, { recursive: true })

  const gitignorePath = path.join(repositoryRoot, '.gitignore')
  let contents = ''

  try {
    contents = await fs.readFile(gitignorePath, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Failed to read .gitignore at ${gitignorePath}: ${String(err)}`)
    }
  }

  if (gitignoreHasReqorEntry(contents)) {
    return
  }

  const separator = contents.length > 0 && !contents.endsWith('\n') ? '\n' : ''
  const nextContents = `${contents}${separator}${GITIGNORE_ENTRY}\n`

  try {
    await fs.writeFile(gitignorePath, nextContents, 'utf8')
  } catch (err) {
    throw new Error(`Failed to update .gitignore at ${gitignorePath}: ${String(err)}`)
  }
}
