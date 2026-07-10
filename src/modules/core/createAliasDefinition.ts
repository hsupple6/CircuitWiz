import type { ModuleDefinition } from '../types'
import type { AliasSpec } from './aliasTypes'

export function createAliasDefinition(
  anchor: ModuleDefinition,
  spec: AliasSpec
): ModuleDefinition {
  const def = structuredClone(anchor) as ModuleDefinition
  def.module = spec.name
  def.logicModule = spec.anchor
  if (spec.description !== undefined) def.description = spec.description
  if (spec.partNumber !== undefined) def.partNumber = spec.partNumber
  if (spec.manufacturer !== undefined) def.manufacturer = spec.manufacturer
  if (spec.datasheet !== undefined) def.datasheet = spec.datasheet
  if (spec.category !== undefined) def.category = spec.category
  if (spec.subcategory !== undefined) def.subcategory = spec.subcategory
  if (spec.propertyDefaults) {
    for (const [key, val] of Object.entries(spec.propertyDefaults)) {
      if (def.properties?.[key]) {
        def.properties[key].default = val
      }
    }
  }
  return def
}
