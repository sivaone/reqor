import type { RequestBodyDtoType, RequestHeaderDtoType } from '@reqor/shared-types'

/** Full draft overrides sent with preview/execute (Story 3.1). */
export type DraftSendOverrides = {
  method: string
  url: string
  headers: RequestHeaderDtoType[]
  /** `null` clears disk body; object overrides */
  body: RequestBodyDtoType | null
}
