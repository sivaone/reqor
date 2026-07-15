export function formatRepositoryAccessError(
  repositoryRoot: string,
  err: unknown,
): string {
  if (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  ) {
    return `Path does not exist: ${repositoryRoot}`
  }

  return `Cannot access path ${repositoryRoot}: ${String(err)}`
}
