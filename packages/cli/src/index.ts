import { pathToFileURL } from 'node:url'

export function serve(): void {
  console.log('CLI scaffold ready — server start implemented in Story 1.4')
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const command = process.argv[2]

  if (command === 'serve') {
    serve()
    process.exit(0)
  }

  console.error('Usage: reqor serve')
  process.exit(1)
}
