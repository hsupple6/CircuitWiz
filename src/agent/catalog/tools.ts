import { AgentTool } from '../types'
import { fail, makeTool, okRead } from '../helpers'
import { moduleRegistry, getModule, getCategories, resolveModuleName } from '../../modules/registry'
import { listConnectablePins } from '../../utils/pinNames'

export const catalogAgentTools: AgentTool[] = [
  makeTool(
    'catalog_list_modules',
    'List all available component modules. Includes disabled modules (e.g. ESP32) so AI can place them programmatically.',
    'catalog',
    [
      { name: 'category', type: 'string', description: 'Filter by category (optional)', required: false },
      { name: 'includeDisabled', type: 'boolean', description: 'Include disabled modules (default true)', required: false },
    ],
    (_ctx, args) => {
      const includeDisabled = args.includeDisabled !== false
      const category = args.category as string | undefined
      const entries = Object.entries(moduleRegistry)
        .filter(([, e]) => includeDisabled || !e.disabled)
        .filter(([, e]) => !category || e.category === category)

      return okRead(_ctx, 'Modules listed.', {
        modules: entries.map(([name, entry]) => ({
          name,
          category: entry.category,
          subcategory: entry.subcategory,
          keywords: entry.keywords,
          disabled: entry.disabled ?? false,
          gridSize: { x: entry.definition.gridX, y: entry.definition.gridY },
          pinCount: entry.definition.grid.filter((c) => c.isConnectable).length,
        })),
        categories: getCategories(),
      })
    }
  ),

  makeTool(
    'catalog_get_module',
    'Get full details for a module including pin definitions (relX/relY relative to placement origin) and properties.',
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
    'Search modules by keyword (e.g. "e-ink", "wifi", "battery", "i2c").',
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
