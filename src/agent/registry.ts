import {
  AgentTool,
  AgentToolParameter,
  AgentPlanSpaceContext,
  AgentToolResult,
  OpenAIToolDefinition,
} from './types'
import { planSpaceAgentTools } from './planSpace/tools'

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

/** All registered agent tools */
export function getAllAgentTools(): AgentTool[] {
  return Array.from(toolMap.values())
}

/** All tool-calling function names (snake_case) */
export function getAllToolCallingNames(): string[] {
  return getAllAgentTools().map((t) => t.name).sort()
}

/** Lookup a single tool by its calling name */
export function getAgentTool(name: string): AgentTool | undefined {
  return toolMap.get(name)
}

/** Tools filtered by category (e.g. `plan_space`) */
export function getAgentToolsByCategory(category: string): AgentTool[] {
  return getAllAgentTools().filter((t) => t.category === category)
}

/** Execute a tool by name against a plan-space context */
export function executeAgentTool(
  name: string,
  context: AgentPlanSpaceContext,
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
export function getOpenAIToolDefinitions(): OpenAIToolDefinition[] {
  return getAllAgentTools().map((tool) => {
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

export { toolMap as agentToolRegistry }
