import type { OutputSubcategoryId } from './componentCatalog'

/** Palette alias: unique display name + optional KiCad shader override; shares anchor logic. */
export interface AliasSpec {
  name: string
  anchor: string
  category: string
  subcategory?: OutputSubcategoryId
  description?: string
  keywords?: string[]
  kicadSymbol?: string
  /** Nested palette folder within `category` (e.g. capacitors, motors). */
  paletteGroup?: string
  /** Override anchor property defaults (e.g. watt rating per alias). */
  propertyDefaults?: Record<string, number | string | boolean>
}
