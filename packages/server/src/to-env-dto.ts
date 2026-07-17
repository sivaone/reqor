import type { ParsedEnvironment } from '@reqor/http-parser'
import type { EnvironmentDtoType } from '@reqor/shared-types'
import { SECRET_MASK } from '@reqor/shared-types'

export function toEnvironmentDto(environment: ParsedEnvironment): EnvironmentDtoType {
  return {
    name: environment.name,
    sourceFile: environment.sourceFile,
    variables: environment.variables.map((variable) => ({
      key: variable.key,
      value: variable.isSecret ? SECRET_MASK : variable.value,
      isSecret: variable.isSecret,
    })),
  }
}

export function toEnvironmentsDto(environments: ParsedEnvironment[]): EnvironmentDtoType[] {
  return environments
    .map(toEnvironmentDto)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}
