import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import ignore from 'ignore'

const HARD_IGNORE = ['**/node_modules/**', '**/.git/**', '**/.reqor/**']

function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/')
}

async function buildIgnoreFilter(root: string) {
  const ig = ignore().add(HARD_IGNORE)

  try {
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8')
    ig.add(gitignore)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  return (relativePath: string) => !ig.ignores(toPosixPath(relativePath))
}

export async function scanHttpFiles(repositoryRoot: string): Promise<string[]> {
  const shouldInclude = await buildIgnoreFilter(repositoryRoot)

  const discovered = await fg('**/*.http', {
    cwd: repositoryRoot,
    onlyFiles: true,
    absolute: false,
    dot: true,
    followSymbolicLinks: false,
    ignore: HARD_IGNORE,
  })

  return discovered
    .map(toPosixPath)
    .filter(shouldInclude)
    .sort()
}
