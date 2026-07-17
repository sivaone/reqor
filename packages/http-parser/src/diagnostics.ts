import type { Diagnostic, ParseOptions } from './ast.js'

export const DIAG_PARSE_ERROR = 'PARSE_ERROR'
export const DIAG_UNSUPPORTED_CONSTRUCT = 'UNSUPPORTED_CONSTRUCT'
export const DIAG_UNSUPPORTED_VALUE = 'UNSUPPORTED_VALUE'

export function createDiagnostic(
  line: number,
  message: string,
  code: string,
  options?: ParseOptions,
): Diagnostic {
  return {
    file: options?.file,
    line,
    message,
    code,
  }
}

export function unsupportedConstruct(
  line: number,
  construct: string,
  options?: ParseOptions,
): Diagnostic {
  return createDiagnostic(
    line,
    `Unsupported construct: ${construct}`,
    DIAG_UNSUPPORTED_CONSTRUCT,
    options,
  )
}

export function parseError(
  line: number,
  message: string,
  options?: ParseOptions,
): Diagnostic {
  return createDiagnostic(line, message, DIAG_PARSE_ERROR, options)
}
