/** Loadable tool categories — `agent` meta tools are always available and not listed here. */
export const AGENT_TOOL_CATEGORIES = [
  {
    id: 'project',
    description: 'Project folder, create/list schematics and documents, active context',
  },
  {
    id: 'schematic',
    description: 'Place components, wire pins, labels, group boxes, validate and simulate circuits',
  },
  {
    id: 'catalog',
    description: 'Search the module catalog for names, pins, and properties',
  },
  {
    id: 'plan_space',
    description: 'System-design canvas — bubbles, arrows, connections, viewport',
  },
  {
    id: 'document',
    description: 'Read and write project documentation files',
  },
  {
    id: 'firmware',
    description: 'Arduino sketch files, board selection, libraries, pin maps',
  },
  {
    id: 'bom',
    description: 'Bill of materials — generate from schematic, edit lines, export CSV',
  },
  {
    id: 'assembly',
    description: 'Assembly checklists and build notes',
  },
  {
    id: 'requirements',
    description: 'Capture and edit product requirements',
  },
  {
    id: 'product',
    description: 'New product suite wizard and saved product definitions',
  },
  {
    id: 'validation',
    description: 'Cross-artifact project health checks',
  },
] as const

export type LoadableToolCategoryId = (typeof AGENT_TOOL_CATEGORIES)[number]['id']

export const LOADABLE_TOOL_CATEGORY_IDS: LoadableToolCategoryId[] = AGENT_TOOL_CATEGORIES.map(
  (c) => c.id
)

export const AGENT_META_CATEGORY = 'agent'
