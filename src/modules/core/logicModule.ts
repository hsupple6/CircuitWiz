import type { ModuleDefinition } from '../types'

/** Simulation / chain / body-label identity (anchor). Display name is `definition.module`. */
export function resolveLogicModule(
  definition: Pick<ModuleDefinition, 'module' | 'logicModule'>
): string {
  return definition.logicModule ?? definition.module
}

export function resolveLogicModuleName(moduleName: string, logicModule?: string): string {
  return logicModule ?? moduleName
}
