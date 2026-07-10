import { AgentTool } from '../types'
import { fail, makeTool, okRead } from '../helpers'
import { moduleRegistry, getModule, getCategories, resolveModuleName } from '../../modules/registry'
import { listConnectablePins } from '../../utils/pinNames'
import {
  DEFAULT_LOOKUP_MAX_RESULTS,
  DEFAULT_LOOKUP_MIN_SCORE,
  lookupComponents,
} from './lookup'

export const catalogAgentTools: AgentTool[] = [
  makeTool(
    'catalog_lookup_components',
    `Resolve component names before placing parts. Pass the parts you need (e.g. ["10k resistor", "Arduino Uno", "red LED"]) — returns closest catalog matches per query with fuzzy tolerance for typos and synonyms. If nothing matches, the result includes Nothing for "<query>". Prefer this over listing the whole catalog. Follow up with catalog_get_module for exact pin names.`,
    'catalog',
    [
      {
        name: 'queries',
        type: 'array',
        description: 'Component names or descriptions to look up (batch supported)',
        required: true,
        items: {
          name: 'query',
          type: 'string',
          description: 'One component lookup string',
          required: true,
        },
      },
      {
        name: 'maxResults',
        type: 'number',
        description: `Max matches per query (default ${DEFAULT_LOOKUP_MAX_RESULTS})`,
        required: false,
      },
      {
        name: 'minScore',
        type: 'number',
        description: `Minimum fuzzy match score 0–1 (default ${DEFAULT_LOOKUP_MIN_SCORE})`,
        required: false,
      },
      {
        name: 'includeDisabled',
        type: 'boolean',
        description: 'Include disabled modules (default true)',
        required: false,
      },
    ],
    (_ctx, args) => {
      if (!Array.isArray(args.queries) || args.queries.length === 0) {
        return fail('queries must be a non-empty array of lookup strings')
      }

      const queries = args.queries
        .filter((q): q is string => typeof q === 'string')
        .map((q) => q.trim())
        .filter(Boolean)

      if (queries.length === 0) {
        return fail('queries must contain at least one non-empty string')
      }

      const maxResults =
        typeof args.maxResults === 'number' && args.maxResults > 0
          ? Math.min(Math.floor(args.maxResults), 20)
          : DEFAULT_LOOKUP_MAX_RESULTS

      const minScore =
        typeof args.minScore === 'number' && args.minScore >= 0 && args.minScore <= 1
          ? args.minScore
          : DEFAULT_LOOKUP_MIN_SCORE

      const includeDisabled = args.includeDisabled !== false
      const lookups = lookupComponents(queries, Object.entries(moduleRegistry), {
        maxResults,
        minScore,
        includeDisabled,
      })

      const matchedCount = lookups.filter((l) => l.matches.length > 0).length
      return okRead(_ctx, `Resolved ${matchedCount}/${lookups.length} lookups.`, { lookups })
    }
  ),

  makeTool(
    'catalog_get_module',
    'Get full details for a module including pin definitions (relX/relY relative to placement origin) and properties. Use catalog_lookup_components first to resolve the exact catalog name.',
    'catalog',
    [{ name: 'moduleName', type: 'string', description: 'Module name', required: true }],
    (_ctx, args) => {
      const resolved = resolveModuleName(args.moduleName as string)
      const def = getModule(resolved)
      if (!def) return fail(`Module not found: ${args.moduleName}`)
      const entry = moduleRegistry[resolved]
      return okRead(_ctx, 'Module retrieved.', {
        module: {
          name: def.module,
          category: entry?.category,
          partNumber: def.partNumber,
          manufacturer: def.manufacturer,
          datasheet: def.datasheet,
          keywords: entry?.keywords,
          disabled: entry?.disabled ?? false,
          gridX: def.gridX,
          gridY: def.gridY,
          pins: listConnectablePins(def.module, def),
          properties: (def as { properties?: Record<string, unknown> }).properties,
        },
      })
    }
  ),

  makeTool(
    'catalog_search_modules',
    'Keyword search across the catalog (single query). For batch part resolution before placement, prefer catalog_lookup_components.',
    'catalog',
    [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'includeDisabled', type: 'boolean', description: 'Include disabled modules', required: false },
    ],
    (_ctx, args) => {
      const q = (args.query as string).toLowerCase().trim()
      const tokens = q.split(/[\s_-]+/).filter(Boolean)
      const includeDisabled = args.includeDisabled !== false
      const matches = Object.entries(moduleRegistry)
        .filter(([, e]) => includeDisabled || !e.disabled)
        .filter(([name, entry]) => {
          const kw = entry.keywords ?? []
          const haystack = [name.toLowerCase(), entry.category, ...kw].join(' ')
          if (haystack.includes(q)) return true
          return tokens.length > 0 && tokens.every((t) => haystack.includes(t))
        })
        .map(([name, entry]) => ({ name, category: entry.category, keywords: entry.keywords }))

      return okRead(_ctx, `Found ${matches.length} modules.`, { modules: matches })
    }
  ),

  makeTool(
    'catalog_list_categories',
    'List component categories available in the catalog.',
    'catalog',
    [],
    (_ctx) => okRead(_ctx, 'Categories listed.', { categories: getCategories() })
  ),
]
