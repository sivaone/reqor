export interface ParsedCliArgs {
  command: 'serve'
  repositoryPath?: string
}

export function parseCliArgs(argv: string[]): ParsedCliArgs | undefined {
  const command = argv[0]

  if (command === 'serve') {
    return {
      command: 'serve',
      repositoryPath: argv[1],
    }
  }

  return undefined
}

export function formatServeUrl(host: string, port: number): string {
  return `http://${host}:${port}`
}
