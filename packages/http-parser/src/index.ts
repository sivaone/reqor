export type {
  BodyKind,
  Diagnostic,
  ParseOptions,
  ParseResult,
  ParsedBody,
  ParsedHeader,
  ParsedRequest,
  SourceSpan,
} from './ast.js'

export {
  astEquivalent,
  classifyBodyKind,
  isHttpMethod,
  normalizeMethod,
} from './ast.js'

export {
  DIAG_PARSE_ERROR,
  DIAG_UNSUPPORTED_CONSTRUCT,
  DIAG_UNSUPPORTED_VALUE,
  createDiagnostic,
  parseError,
  unsupportedConstruct,
} from './diagnostics.js'

export { parseHttpFile } from './parse.js'
export { serializeHttpFile } from './serialize.js'

export type {
  VariableKind,
  VariableLocation,
  VariableReference,
} from './variables.js'

export { collectRequestVariables, scanVariables } from './variables.js'

export type {
  EnvVariable,
  ParsedEnvironment,
  ParseEnvironmentsResult,
} from './environments.js'

export { parseHttpClientEnvironments } from './environments.js'
