import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import ignore from 'ignore'

const HARD_IGNORE = ['**/node_modules/**', '**/.git/**', '**/.reqor/**']

const PUBLIC_ENV_FILE = 'http-client.env.json'
const PRIVATE_ENV_FILE = 'http-client.private.env.json'

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

export interface EnvFilePair {
  directory: string
  publicFile?: string
  privateFile?: string
}

export async function scanEnvFiles(repositoryRoot: string): Promise<EnvFilePair[]> {
  const shouldInclude = await buildIgnoreFilter(repositoryRoot)

  const [publicFiles, privateFiles] = await Promise.all([
    fg(`**/${PUBLIC_ENV_FILE}`, {
      cwd: repositoryRoot,
      onlyFiles: true,
      absolute: false,
      dot: true,
      followSymbolicLinks: false,
      ignore: HARD_IGNORE,
    }),
    fg(`**/${PRIVATE_ENV_FILE}`, {
      cwd: repositoryRoot,
      onlyFiles: true,
      absolute: false,
      dot: true,
      followSymbolicLinks: false,
      ignore: HARD_IGNORE,
    }),
  ])

  const pairsByDirectory = new Map<string, EnvFilePair>()

  for (const file of publicFiles.map(toPosixPath).filter(shouldInclude)) {
    const directory = path.posix.dirname(file)
    const existing = pairsByDirectory.get(directory) ?? { directory }
    existing.publicFile = file
    pairsByDirectory.set(directory, existing)
  }

  for (const file of privateFiles.map(toPosixPath).filter(shouldInclude)) {
    const directory = path.posix.dirname(file)
    const existing = pairsByDirectory.get(directory) ?? { directory }
    existing.privateFile = file
    pairsByDirectory.set(directory, existing)
  }

  return [...pairsByDirectory.values()].sort((a, b) =>
    a.directory < b.directory ? -1 : a.directory > b.directory ? 1 : 0,
  )
}
