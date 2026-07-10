import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from './registryTypes'
import { getPartMetadata } from './partMetadata'

export function applyPartMetadataToDefinition(
  definition: ModuleDefinition,
  registryKey: string
): ModuleDefinition {
  const meta = getPartMetadata(registryKey)
  if (!meta) return definition

  return {
    ...definition,
    partNumber: meta.partNumber,
    manufacturer: meta.manufacturer ?? definition.manufacturer,
    datasheet: meta.datasheet ?? definition.datasheet,
  }
}

export function applyPartMetadataToRegistry(
  registry: Record<string, ModuleRegistryEntry>
): Record<string, ModuleRegistryEntry> {
  const result: Record<string, ModuleRegistryEntry> = {}

  for (const [key, entry] of Object.entries(registry)) {
    result[key] = {
      ...entry,
      definition: applyPartMetadataToDefinition(entry.definition, key),
    }
  }

  return result
}
