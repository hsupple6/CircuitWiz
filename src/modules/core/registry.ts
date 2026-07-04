import type { ModuleDefinition } from '../types'
import { getOrderedCategoryIds } from './componentCatalog'
import { resolveLogicModule } from './logicModule'
import { buildAliasRegistryEntries } from './buildAliases'
import { ALL_ALIASES } from './allAliases'
import type { ModuleRegistryEntry } from './registryTypes'

import { passiveAnchors } from '../passives/anchors'
import { powerAnchors } from '../power/anchors'
import { semiconductorAnchors } from '../semiconductors/anchors'
import { switchAnchors } from '../switches/anchors'
import { outputAnchors } from '../output/anchors'
import { driverAnchors } from '../drivers/anchors'
import { sensorAnchors } from '../sensors/index'
import { microcontrollerAnchors } from '../microcontrollers/index'
import { organizationAnchors } from '../organization/index'
import { connectorAnchors } from '../connectors/index'

export type { ModuleRegistryEntry } from './registryTypes'

export const baseModuleRegistry: Record<string, ModuleRegistryEntry> = {
  ...microcontrollerAnchors,
  ...powerAnchors,
  ...passiveAnchors,
  ...semiconductorAnchors,
  ...switchAnchors,
  ...outputAnchors,
  ...driverAnchors,
  ...sensorAnchors,
  ...organizationAnchors,
  ...connectorAnchors,
}

export const moduleRegistry: Record<string, ModuleRegistryEntry> = {
  ...baseModuleRegistry,
  ...buildAliasRegistryEntries(ALL_ALIASES, baseModuleRegistry),
}

export function resolveModuleName(name: string): string {
  const trimmed = name.trim()
  if (moduleRegistry[trimmed]) return trimmed

  const compact = trimmed.toLowerCase().replace(/[\s_-]+/g, '')
  for (const key of Object.keys(moduleRegistry)) {
    if (key.toLowerCase().replace(/[\s_-]+/g, '') === compact) return key
  }
  return trimmed
}

export const getModule = (name: string): ModuleDefinition | undefined => {
  return moduleRegistry[resolveModuleName(name)]?.definition
}

export const getModuleWithType = (name: string): ModuleRegistryEntry | undefined => {
  return moduleRegistry[resolveModuleName(name)]
}

export const getModuleType = (name: string) => {
  return moduleRegistry[resolveModuleName(name)]?.type
}

const availableRegistryEntries = (): ModuleRegistryEntry[] =>
  Object.values(moduleRegistry).filter((entry) => !entry.disabled)

export const getAllModules = (): ModuleDefinition[] => {
  return availableRegistryEntries().map((entry) => entry.definition)
}

export const getAllModulesWithTypes = (): ModuleRegistryEntry[] => {
  return availableRegistryEntries()
}

export const getModulesByCategory = (category: string): ModuleDefinition[] => {
  return availableRegistryEntries()
    .filter((entry) => entry.category === category)
    .map((entry) => entry.definition)
}

export const getModulesWithTypesByCategory = (category: string): ModuleRegistryEntry[] => {
  return availableRegistryEntries().filter((entry) => entry.category === category)
}

export const getCategories = (): string[] => {
  const used = new Set(availableRegistryEntries().map((entry) => entry.category))
  return getOrderedCategoryIds().filter((id) => used.has(id))
}

export const OUTPUT_MODULE_NAMES = new Set([
  'LED',
  'RGBLED',
  'Motor',
  'StepperMotor',
  'Buzzer',
  'Speaker',
  'Servo',
  'Potentiometer',
])

export function isOutputModule(definition: Pick<ModuleDefinition, 'module' | 'logicModule'>): boolean {
  return OUTPUT_MODULE_NAMES.has(resolveLogicModule(definition))
}

export const validateModule = (module: ModuleDefinition): boolean => {
  if (!module.module || !module.gridX || !module.gridY || !module.grid) {
    return false
  }

  const expectedCells = module.gridX * module.gridY
  if (module.grid.length !== expectedCells) {
    return false
  }

  return module.grid.every(
    (cell) =>
      typeof cell.x === 'number' &&
      typeof cell.y === 'number' &&
      typeof cell.isConnectable === 'boolean' &&
      typeof cell.type === 'string'
  )
}
