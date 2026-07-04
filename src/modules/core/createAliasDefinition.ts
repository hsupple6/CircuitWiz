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
  if (spec.category !== undefined) def.category = spec.category
  if (spec.subcategory !== undefined) def.subcategory = spec.subcategory
  return def
}
