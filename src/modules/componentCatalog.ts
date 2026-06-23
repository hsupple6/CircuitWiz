import { ModuleRegistryEntry } from './registry'

export const OUTPUT_SUBCATEGORIES = [
  { id: 'light', label: 'Light' },
  { id: 'electromechanical', label: 'Electromechanical' },
  { id: 'rotary', label: 'Rotary' },
] as const

export type OutputSubcategoryId = (typeof OUTPUT_SUBCATEGORIES)[number]['id']

/** Top-level palette sections (implemented components only). */
export const COMPONENT_CATEGORIES = [
  { id: 'microcontrollers', label: 'Microcontrollers' },
  { id: 'power', label: 'Power' },
  { id: 'passives', label: 'Passives' },
  { id: 'switches', label: 'Switches' },
  { id: 'output', label: 'Output', nested: true },
  { id: 'sensors', label: 'Sensors' },
  { id: 'organization', label: 'Organization' },
] as const

export type ComponentCategoryId = (typeof COMPONENT_CATEGORIES)[number]['id']

export interface PaletteGroup {
  groupId: string
  label: string
  entries: ModuleRegistryEntry[]
  parentId?: string
}

export function getCategoryLabel(categoryId: string): string {
  const top = COMPONENT_CATEGORIES.find((c) => c.id === categoryId)
  if (top) return top.label
  const sub = OUTPUT_SUBCATEGORIES.find((s) => s.id === categoryId)
  if (sub) return sub.label
  return categoryId
}

export function getOrderedCategoryIds(): string[] {
  return COMPONENT_CATEGORIES.map((c) => c.id)
}

function normalizeSearch(text: string): string {
  return text.trim().toLowerCase()
}

export function moduleMatchesSearch(entry: ModuleRegistryEntry, query: string): boolean {
  const q = normalizeSearch(query)
  if (!q) return true

  const sub = entry.subcategory ?? entry.definition.subcategory
  const { definition, category, keywords = [] } = entry
  const haystack = [
    definition.module,
    definition.description ?? '',
    definition.manufacturer ?? '',
    category,
    sub ?? '',
    getCategoryLabel(category),
    sub ? getCategoryLabel(sub) : '',
    ...keywords,
  ]
    .join(' ')
    .toLowerCase()

  return q.split(/\s+/).every((token) => haystack.includes(token))
}

/** Flat groups for simple categories; Output expands into Light / Electromechanical / Rotary. */
export function groupEntriesForPalette(
  entries: ModuleRegistryEntry[]
): PaletteGroup[] {
  const byCategory = new Map<string, ModuleRegistryEntry[]>()
  entries.forEach((entry) => {
    const list = byCategory.get(entry.category) ?? []
    list.push(entry)
    byCategory.set(entry.category, list)
  })

  const groups: PaletteGroup[] = []

  for (const cat of COMPONENT_CATEGORIES) {
    const catEntries = byCategory.get(cat.id)
    if (!catEntries?.length) continue

    if (cat.id === 'output') {
      for (const sub of OUTPUT_SUBCATEGORIES) {
        const subEntries = catEntries.filter(
          (e) => (e.subcategory ?? e.definition.subcategory) === sub.id
        )
        if (subEntries.length === 0) continue
        groups.push({
          groupId: `output.${sub.id}`,
          label: sub.label,
          parentId: 'output',
          entries: subEntries,
        })
      }
      const uncategorized = catEntries.filter(
        (e) => !OUTPUT_SUBCATEGORIES.some((s) => (e.subcategory ?? e.definition.subcategory) === s.id)
      )
      if (uncategorized.length > 0) {
        groups.push({
          groupId: 'output.other',
          label: 'Other',
          parentId: 'output',
          entries: uncategorized,
        })
      }
    } else {
      groups.push({
        groupId: cat.id,
        label: cat.label,
        entries: catEntries,
      })
    }
  }

  return groups
}

/** @deprecated use groupEntriesForPalette */
export function groupEntriesByCategory(
  entries: ModuleRegistryEntry[],
  _categoryOrder?: string[]
): Array<{ categoryId: string; label: string; entries: ModuleRegistryEntry[] }> {
  return groupEntriesForPalette(entries).map((g) => ({
    categoryId: g.groupId,
    label: g.parentId ? `Output › ${g.label}` : g.label,
    entries: g.entries,
  }))
}
