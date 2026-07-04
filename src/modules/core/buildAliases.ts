import { createAliasDefinition } from './createAliasDefinition'
import type { AliasSpec } from './aliasTypes'
import type { ModuleRegistryEntry } from './registryTypes'

export function buildAliasRegistryEntries(
  specs: AliasSpec[],
  anchors: Record<string, ModuleRegistryEntry>
): Record<string, ModuleRegistryEntry> {
  const entries: Record<string, ModuleRegistryEntry> = {}

  for (const spec of specs) {
    const anchorEntry = anchors[spec.anchor]
    if (!anchorEntry) {
      console.warn(`[aliases] missing anchor "${spec.anchor}" for "${spec.name}"`)
      continue
    }

    entries[spec.name] = {
      definition: createAliasDefinition(anchorEntry.definition, spec),
      type: anchorEntry.type,
      category: spec.category,
      subcategory: spec.subcategory ?? anchorEntry.subcategory,
      paletteGroup: spec.paletteGroup,
      keywords: [...(anchorEntry.keywords ?? []), ...(spec.keywords ?? [])],
    }
  }

  return entries
}

export function mergeKicadSymbolMap(
  baseMap: Record<string, string>,
  specs: AliasSpec[]
): Record<string, string> {
  const map = { ...baseMap }
  for (const spec of specs) {
    map[spec.name] = spec.kicadSymbol ?? baseMap[spec.anchor] ?? map[spec.name]
  }
  return map
}
