export function resolveBrowserOpenCommand(
  url: string,
  platform: NodeJS.Platform,
): { command: string; args: string[] } {
  switch (platform) {
    case 'win32':
      return { command: 'cmd', args: ['/c', 'start', '', url] }
    case 'darwin':
      return { command: 'open', args: [url] }
    default:
      return { command: 'xdg-open', args: [url] }
  }
}
