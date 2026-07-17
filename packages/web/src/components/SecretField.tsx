import { SECRET_MASK } from '@reqor/shared-types'

type SecretFieldProps = {
  /**
   * Ignored intentionally — callers may pass a server-redacted DTO value, but this
   * component always renders `SECRET_MASK` and never plaintext (UX-DR14).
   */
  value?: string
  className?: string
}

/** UX-DR14: masked secret display — always `SECRET_MASK`, never plaintext. */
export function SecretField({ className = '' }: SecretFieldProps) {
  return (
    <span
      className={`font-mono text-secret-masked ${className}`.trim()}
      aria-label="Secret value masked"
    >
      {SECRET_MASK}
    </span>
  )
}
