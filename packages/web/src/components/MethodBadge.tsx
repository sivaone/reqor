import { getMethodColorClass } from '../utils/methodColorClass.js'

type MethodBadgeProps = {
  method: string
}

export function MethodBadge({ method }: MethodBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm px-inset-sm text-label text-white ${getMethodColorClass(method)}`}
    >
      {method.toUpperCase()}
    </span>
  )
}
