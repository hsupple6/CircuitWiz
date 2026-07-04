import type { ModuleDefinition, ModuleType } from '../types'
import type { OutputSubcategoryId } from './componentCatalog'

export interface ModuleRegistryEntry {
  definition: ModuleDefinition
  type?: ModuleType
  category: string
  subcategory?: OutputSubcategoryId
  keywords?: string[]
  /** Nested palette folder within category (e.g. capacitors, batteries). */
  paletteGroup?: string
  /** Hidden from the component palette; existing placements still load via getModule */
  disabled?: boolean
}
