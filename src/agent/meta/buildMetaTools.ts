import { fail, makeTool, okRead } from '../helpers'
import type { AgentTool } from '../types'
import {
  AGENT_META_CATEGORY,
  AGENT_TOOL_CATEGORIES,
  LOADABLE_TOOL_CATEGORY_IDS,
} from './catalog'

export function buildMetaAgentTools(getTools: () => AgentTool[]): AgentTool[] {
  function listToolCategories() {
    const counts = new Map<string, number>()
    for (const tool of getTools()) {
      if (tool.category === AGENT_META_CATEGORY) continue
      counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1)
    }
    return AGENT_TOOL_CATEGORIES.map((cat) => ({
      id: cat.id,
      description: cat.description,
      toolCount: counts.get(cat.id) ?? 0,
    }))
  }

  function validateCategories(categories: string[]) {
    const known = new Set<string>(LOADABLE_TOOL_CATEGORY_IDS)
    const valid: string[] = []
    const invalid: string[] = []
    for (const category of categories) {
      if (known.has(category)) valid.push(category)
      else invalid.push(category)
    }
    return { valid, invalid }
  }

  function searchTools(query?: string, category?: string, limit = 24) {
    const normalizedQuery = query?.trim().toLowerCase()
    let tools = getTools().filter((t) => t.category !== AGENT_META_CATEGORY)

    if (category) {
      tools = tools.filter((t) => t.category === category)
    }
    if (normalizedQuery) {
      tools = tools.filter(
        (t) =>
          t.name.includes(normalizedQuery) ||
          t.description.toLowerCase().includes(normalizedQuery) ||
          t.category.includes(normalizedQuery)
      )
    }

    return tools.slice(0, limit).map((t) => ({
      name: t.name,
      category: t.category,
      description: t.description,
    }))
  }

  function toolsForCategories(categories: string[]) {
    const names = new Set<string>()
    for (const tool of getTools()) {
      if (categories.includes(tool.category)) names.add(tool.name)
    }
    return [...names].sort()
  }

  return [
    makeTool(
      'agent_list_tool_categories',
      'List available tool categories with descriptions and tool counts. Call this before agent_load_tool_categories when you need capabilities beyond the meta tools.',
      AGENT_META_CATEGORY,
      [],
      (ctx) => okRead(ctx, 'Tool categories listed.', { categories: listToolCategories() })
    ),

    makeTool(
      'agent_search_tools',
      'Search registered tools by keyword and/or category. Use to find the right category before loading it.',
      AGENT_META_CATEGORY,
      [
        {
          name: 'query',
          type: 'string',
          description: 'Search text matched against tool name, description, or category',
          required: false,
        },
        {
          name: 'category',
          type: 'string',
          description: 'Restrict to one category id',
          required: false,
          enum: [...LOADABLE_TOOL_CATEGORY_IDS],
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Max results (default 24)',
          required: false,
        },
      ],
      (ctx, args) => {
        const results = searchTools(
          args.query as string | undefined,
          args.category as string | undefined,
          typeof args.limit === 'number' ? args.limit : 24
        )
        return okRead(ctx, `${results.length} tool(s) found.`, { tools: results })
      }
    ),

    makeTool(
      'agent_load_tool_categories',
      'Load one or more tool categories for this session. After loading, category tools become callable on the next step. Typical flows: schematic work → project + catalog + schematic; firmware → project + firmware + schematic.',
      AGENT_META_CATEGORY,
      [
        {
          name: 'categories',
          type: 'array',
          description: 'Category ids to load (from agent_list_tool_categories)',
          required: true,
          items: {
            name: 'category',
            type: 'string',
            description: 'Category id',
            required: true,
            enum: [...LOADABLE_TOOL_CATEGORY_IDS],
          },
        },
      ],
      (ctx, args) => {
        const raw = args.categories
        if (!Array.isArray(raw) || raw.length === 0) {
          return fail('Provide at least one category in categories.')
        }
        const { valid, invalid } = validateCategories(raw.map(String))
        if (valid.length === 0) {
          return fail(`Unknown categories: ${invalid.join(', ')}`)
        }
        return okRead(ctx, `Loaded ${valid.join(', ')}.`, {
          loadedCategories: valid,
          invalidCategories: invalid.length > 0 ? invalid : undefined,
          toolsNowAvailable: toolsForCategories(valid),
        })
      }
    ),
  ]
}
