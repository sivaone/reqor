export function getMethodColorClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-method-get'
    case 'POST':
      return 'bg-method-post'
    case 'PUT':
      return 'bg-method-put'
    case 'PATCH':
      return 'bg-method-patch'
    case 'DELETE':
      return 'bg-method-delete'
    case 'HEAD':
      return 'bg-method-head'
    case 'OPTIONS':
      return 'bg-method-options'
    default:
      return 'bg-foreground-muted'
  }
}
