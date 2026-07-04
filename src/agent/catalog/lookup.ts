import type { ModuleRegistryEntry } from '../../modules/core/registryTypes'
import { getCategoryLabel } from '../../modules/core/componentCatalog'
import { getPaletteSubgroupLabel } from '../../modules/core/paletteGroups'
import { resolveModuleName } from '../../modules/registry'

export const DEFAULT_LOOKUP_MIN_SCORE = 0.48
export const DEFAULT_LOOKUP_MAX_RESULTS = 6

export interface ComponentLookupMatch {
  name: string
  category: string
  score: number
  matchType: 'exact' | 'fuzzy'
  keywords?: string[]
  disabled?: boolean
}

export interface ComponentLookupResult {
  query: string
  matches: ComponentLookupMatch[]
  message?: string
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
}

function compact(text: string): string {
  return normalize(text).replace(/\s+/g, '')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost)
      row[j - 1] = prev
      prev = next
    }
    row[b.length] = prev
  }
  return row[b.length]
}

function stringSimilarity(a: string, b: string): number {
  const ca = compact(a)
  const cb = compact(b)
  if (!ca || !cb) return 0
  if (ca === cb) return 1
  if (ca.includes(cb) || cb.includes(ca)) {
    return 0.82 + (0.18 * Math.min(ca.length, cb.length)) / Math.max(ca.length, cb.length)
  }
  const dist = levenshtein(ca, cb)
  const maxLen = Math.max(ca.length, cb.length)
  return 1 - dist / maxLen
}

function buildHaystack(name: string, entry: ModuleRegistryEntry): string {
  const sub = entry.subcategory ?? entry.definition.subcategory
  return [
    name,
    entry.definition.description ?? '',
    entry.definition.manufacturer ?? '',
    entry.category,
    sub ?? '',
    getCategoryLabel(entry.category),
    sub ? getCategoryLabel(sub) : '',
    entry.paletteGroup ? getPaletteSubgroupLabel(entry.paletteGroup) : '',
    ...(entry.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase()
}

function tokenCoverageScore(query: string, haystack: string): number {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0

  const matched = tokens.filter((token) => haystack.includes(token))
  if (matched.length === 0) return 0
  if (matched.length === tokens.length) {
    return 0.72 + (0.18 * matched.length) / tokens.length
  }
  return (0.45 * matched.length) / tokens.length
}

function scoreEntry(query: string, name: string, entry: ModuleRegistryEntry): number {
  const trimmed = query.trim()
  if (!trimmed) return 0

  const resolved = resolveModuleName(trimmed)
  if (resolved === name) return 1

  const normalizedQuery = normalize(trimmed)
  const normalizedName = normalize(name)
  if (normalizedQuery === normalizedName) return 0.98

  const haystack = buildHaystack(name, entry)
  const nameSim = stringSimilarity(trimmed, name)
  const descSim = stringSimilarity(trimmed, entry.definition.description ?? '')
  const tokenScore = tokenCoverageScore(trimmed, haystack)

  return Math.max(nameSim, descSim * 0.88, tokenScore)
}

export function lookupComponents(
  queries: string[],
  entries: Array<[string, ModuleRegistryEntry]>,
  options?: {
    minScore?: number
    maxResults?: number
    includeDisabled?: boolean
  }
): ComponentLookupResult[] {
  const minScore = options?.minScore ?? DEFAULT_LOOKUP_MIN_SCORE
  const maxResults = options?.maxResults ?? DEFAULT_LOOKUP_MAX_RESULTS
  const includeDisabled = options?.includeDisabled !== false

  const pool = entries.filter(([, entry]) => includeDisabled || !entry.disabled)

  return queries.map((rawQuery) => {
    const query = rawQuery.trim()
    if (!query) {
      return {
        query: rawQuery,
        matches: [],
        message: 'Nothing for ""',
      }
    }

    const scored = pool
      .map(([name, entry]) => {
        const score = scoreEntry(query, name, entry)
        return {
          name,
          category: entry.category,
          score,
          matchType: score >= 0.95 ? ('exact' as const) : ('fuzzy' as const),
          keywords: entry.keywords,
          disabled: entry.disabled ?? false,
        }
      })
      .filter((match) => match.score >= minScore)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, maxResults)

    if (scored.length === 0) {
      return {
        query,
        matches: [],
        message: `Nothing for "${query}"`,
      }
    }

    return { query, matches: scored }
  })
}
