import type { RequestDtoType } from '@reqor/shared-types'
import { MethodBadge } from './MethodBadge.js'

type RequestPreviewProps = {
  request: RequestDtoType
}

export function RequestPreview({ request }: RequestPreviewProps) {
  return (
    <div className="flex w-full items-center gap-inset px-inset py-inset">
      <MethodBadge method={request.method} />
      <span className="min-w-0 truncate text-mono" title={request.url}>
        {request.url}
      </span>
    </div>
  )
}
