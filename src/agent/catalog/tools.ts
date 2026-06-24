import { AgentTool } from '../types'
import { fail, makeTool, okRead } from '../helpers'
import { moduleRegistry, getModule, getCategories } from '../../modules/registry'

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
    'Get full details for a module including pin definitions and properties.',
    'catalog',
    [{ name: 'moduleName', type: 'string', description: 'Module name', required: true }],
    (_ctx, args) => {
      const def = getModule(args.moduleName as string)
      if (!def) return fail(`Module not found: ${args.moduleName}`)
      const entry = moduleRegistry[args.moduleName as string]
      return okRead(_ctx, 'Module retrieved.', {
        module: {
          name: def.module,
          category: entry?.category,
          keywords: entry?.keywords,
          disabled: entry?.disabled ?? false,
          gridX: def.gridX,
          gridY: def.gridY,
          pins: def.grid
            .filter((c) => c.isConnectable)
            .map((c) => ({ name: c.pin || c.type, type: c.type, x: c.x, y: c.y })),
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
      const q = (args.query as string).toLowerCase()
      const includeDisabled = args.includeDisabled !== false
      const matches = Object.entries(moduleRegistry)
        .filter(([, e]) => includeDisabled || !e.disabled)
        .filter(([name, entry]) => {
          const kw = entry.keywords ?? []
          return (
            name.toLowerCase().includes(q) ||
            entry.category.includes(q) ||
            kw.some((k) => k.includes(q))
          )
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
