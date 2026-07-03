import {
  AgentTool,
  AgentToolParameter,
  AgentProjectContext,
  AgentToolResult,
  OpenAIToolDefinition,
  PIPELINE_STAGE_TOOL_CATEGORIES,
  PipelineStage,
} from './types'
import { planSpaceAgentTools } from './planSpace/tools'
import { projectAgentTools } from './project/tools'
import { documentAgentTools } from './document/tools'
import { schematicAgentTools } from './schematic/tools'
import { catalogAgentTools } from './catalog/tools'
import { bomAgentTools } from './bom/tools'
import { firmwareAgentTools } from './firmware/tools'
import { requirementsAgentTools } from './requirements/tools'
import { productAgentTools } from './product/tools'
import { assemblyAgentTools } from './assembly/tools'
import { validationAgentTools } from './validation/tools'
import { buildMetaAgentTools } from './meta/buildMetaTools'
import { AGENT_META_CATEGORY } from './meta/catalog'

const toolMap = new Map<string, AgentTool>()

function registerTool(tool: AgentTool): void {
  if (toolMap.has(tool.name)) {
    throw new Error(`Duplicate agent tool name: ${tool.name}`)
  }
  toolMap.set(tool.name, tool)
}

function registerTools(tools: AgentTool[]): void {
  for (const tool of tools) {
    registerTool(tool)
  }
}

// ── Register all tool domains ────────────────────────────────────────────────
registerTools(planSpaceAgentTools)
registerTools(projectAgentTools)
registerTools(documentAgentTools)
registerTools(schematicAgentTools)
registerTools(catalogAgentTools)
registerTools(bomAgentTools)
registerTools(firmwareAgentTools)
registerTools(requirementsAgentTools)
registerTools(productAgentTools)
registerTools(assemblyAgentTools)
registerTools(validationAgentTools)

/** All registered agent tools */
export function getAllAgentTools(): AgentTool[] {
  return Array.from(toolMap.values())
}

registerTools(buildMetaAgentTools(() => getAllAgentTools()))

/** Meta discovery tools are always included; other tools require agent_load_tool_categories. */
export function getSessionAgentTools(loadedCategories: Iterable<string>): AgentTool[] {
  const loaded = new Set(loadedCategories)
  return getAllAgentTools().filter(
    (tool) => tool.category === AGENT_META_CATEGORY || loaded.has(tool.category)
  )
}

/** All tool-calling function names (snake_case) */
export function getAllToolCallingNames(): string[] {
  return getAllAgentTools().map((t) => t.name).sort()
}

/** Lookup a single tool by its calling name */
export function getAgentTool(name: string): AgentTool | undefined {
  return toolMap.get(name)
}

/** Tools filtered by category (e.g. `plan_space`, `schematic`) */
export function getAgentToolsByCategory(category: string): AgentTool[] {
  return getAllAgentTools().filter((t) => t.category === category)
}

/** Tools recommended for a pipeline stage */
export function getAgentToolsForPipelineStage(stage: PipelineStage): AgentTool[] {
  const categories = PIPELINE_STAGE_TOOL_CATEGORIES[stage]
  return getAllAgentTools().filter((t) => categories.includes(t.category))
}

/** Execute a tool by name against a project context */
export function executeAgentTool(
  name: string,
  context: AgentProjectContext,
  args: Record<string, unknown> = {}
): AgentToolResult {
  const tool = toolMap.get(name)
  if (!tool) {
    return { success: false, message: `Unknown tool: ${name}` }
  }
  try {
    return tool.execute(context, args)
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Tool execution failed',
    }
  }
}

function parameterToJsonSchema(param: AgentToolParameter): Record<string, unknown> {
  const schema: Record<string, unknown> = { type: param.type, description: param.description }
  if (param.enum) schema.enum = param.enum
  if (param.items) schema.items = parameterToJsonSchema(param.items)
  if (param.properties) {
    const props: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(param.properties)) {
      props[key] = parameterToJsonSchema(val)
    }
    schema.properties = props
    schema.required = Object.entries(param.properties)
      .filter(([, v]) => v.required)
      .map(([k]) => k)
  }
  return schema
}

/** Convert registered tools to OpenAI / Anthropic function-calling format */
export function agentToolsToOpenAIToolDefinitions(tools: AgentTool[]): OpenAIToolDefinition[] {
  return tools.map((tool) => {
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    for (const param of tool.parameters) {
      properties[param.name] = parameterToJsonSchema(param)
      if (param.required) required.push(param.name)
    }

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      },
    }
  })
}

export function getOpenAIToolDefinitions(): OpenAIToolDefinition[] {
  return agentToolsToOpenAIToolDefinitions(getAllAgentTools())
}

/** OpenAI tool definitions for a session with loaded categories */
export function getOpenAIToolDefinitionsForSession(
  loadedCategories: Iterable<string>
): OpenAIToolDefinition[] {
  return agentToolsToOpenAIToolDefinitions(getSessionAgentTools(loadedCategories))
}

/** OpenAI tool definitions filtered by category */
export function getOpenAIToolDefinitionsByCategory(category: string): OpenAIToolDefinition[] {
  const names = new Set(getAgentToolsByCategory(category).map((t) => t.name))
  return getOpenAIToolDefinitions().filter((d) => names.has(d.function.name))
}

/** OpenAI tool definitions for a pipeline stage */
export function getOpenAIToolDefinitionsForPipelineStage(
  stage: PipelineStage
): OpenAIToolDefinition[] {
  const names = new Set(getAgentToolsForPipelineStage(stage).map((t) => t.name))
  return getOpenAIToolDefinitions().filter((d) => names.has(d.function.name))
}

export { toolMap as agentToolRegistry }
