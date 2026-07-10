import type { ModuleRegistryEntry } from './registryTypes'
import {
  getPaletteSubgroupLabel,
  OUTPUT_PALETTE_SUBGROUPS,
  PALETTE_SUBGROUPS,
} from './paletteGroups'

export const OUTPUT_SUBCATEGORIES = [
  { id: 'light', label: 'Light' },
  { id: 'electromechanical', label: 'Electromechanical' },
] as const

export type OutputSubcategoryId = (typeof OUTPUT_SUBCATEGORIES)[number]['id']

/** Top-level palette sections (implemented components only). */
export const COMPONENT_CATEGORIES = [
  { id: 'microcontrollers', label: 'Microcontrollers' },
  { id: 'power', label: 'Power' },
  { id: 'passives', label: 'Passives' },
  { id: 'semiconductors', label: 'Semiconductors' },
  { id: 'ics', label: 'Integrated Circuits' },
  { id: 'switches', label: 'Switches' },
  { id: 'output', label: 'Output' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'wireless', label: 'Wireless' },
  { id: 'sensors', label: 'Sensors' },
  { id: 'mechanical', label: 'Mechanical' },
  { id: 'test', label: 'Test & Debug' },
  { id: 'organization', label: 'Organization' },
] as const

export type ComponentCategoryId = (typeof COMPONENT_CATEGORIES)[number]['id']

export interface PaletteGroup {
  groupId: string
  label: string
  entries: ModuleRegistryEntry[]
  subgroups?: PaletteGroup[]
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

export function countPaletteGroupEntries(group: PaletteGroup): number {
  const nested = group.subgroups?.reduce((n, sub) => n + countPaletteGroupEntries(sub), 0) ?? 0
  return group.entries.length + nested
}

function buildNestedPaletteGroup(
  groupId: string,
  label: string,
  entries: ModuleRegistryEntry[],
  nestedConfig: Array<{ id: string; label: string }> | undefined,
  parentId?: string
): PaletteGroup {
  const topEntries = entries.filter((e) => !e.paletteGroup)
  const subgroups: PaletteGroup[] = []

  if (nestedConfig) {
    for (const spec of nestedConfig) {
      const nestedEntries = entries.filter((e) => e.paletteGroup === spec.id)
      if (nestedEntries.length === 0) continue
      subgroups.push({
        groupId: `${groupId}.${spec.id}`,
        label: spec.label,
        parentId: groupId,
        entries: nestedEntries,
      })
    }
  }

  return {
    groupId,
    label,
    parentId,
    entries: topEntries,
    subgroups: subgroups.length > 0 ? subgroups : undefined,
  }
}

export function moduleMatchesSearch(entry: ModuleRegistryEntry, query: string): boolean {
  const q = normalizeSearch(query)
  if (!q) return true

  const sub = entry.subcategory ?? entry.definition.subcategory
  const { definition, category, keywords = [], paletteGroup } = entry
  const haystack = [
    definition.module,
    definition.partNumber ?? '',
    definition.description ?? '',
    definition.manufacturer ?? '',
    category,
    sub ?? '',
    getCategoryLabel(category),
    sub ? getCategoryLabel(sub) : '',
    paletteGroup ? getPaletteSubgroupLabel(paletteGroup) : '',
    ...keywords,
  ]
    .join(' ')
    .toLowerCase()

  return q.split(/\s+/).every((token) => haystack.includes(token))
}

/** Palette tree: anchors at top level, variant aliases in nested folders. */
export function groupEntriesForPalette(entries: ModuleRegistryEntry[]): PaletteGroup[] {
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
      const outputSubgroups: PaletteGroup[] = []

      for (const sub of OUTPUT_SUBCATEGORIES) {
        const subEntries = catEntries.filter(
          (e) => (e.subcategory ?? e.definition.subcategory) === sub.id
        )
        if (subEntries.length === 0) continue
        outputSubgroups.push(
          buildNestedPaletteGroup(
            `output.${sub.id}`,
            sub.label,
            subEntries,
            OUTPUT_PALETTE_SUBGROUPS[sub.id],
            'output'
          )
        )
      }

      const uncategorized = catEntries.filter(
        (e) =>
          !OUTPUT_SUBCATEGORIES.some(
            (s) => (e.subcategory ?? e.definition.subcategory) === s.id
          )
      )
      if (uncategorized.length > 0) {
        outputSubgroups.push({
          groupId: 'output.other',
          label: 'Other',
          parentId: 'output',
          entries: uncategorized,
        })
      }

      groups.push({
        groupId: 'output',
        label: cat.label,
        entries: [],
        subgroups: outputSubgroups,
      })
    } else {
      groups.push(
        buildNestedPaletteGroup(cat.id, cat.label, catEntries, PALETTE_SUBGROUPS[cat.id])
      )
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
