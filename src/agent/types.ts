import { PlanSpace } from '../types/workspace'

export type AgentToolParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'

export interface AgentToolParameter {
  name: string
  type: AgentToolParameterType
  description: string
  required?: boolean
  enum?: string[]
  items?: AgentToolParameter
  properties?: Record<string, AgentToolParameter>
}

export interface AgentToolSchema {
  name: string
  description: string
  category: string
  parameters: AgentToolParameter[]
}

export interface AgentPlanSpaceContext {
  planSpace: PlanSpace
}

export interface AgentToolResult {
  success: boolean
  message: string
  planSpace?: PlanSpace
  data?: unknown
}

export type AgentToolHandler<TArgs = Record<string, unknown>> = (
  context: AgentPlanSpaceContext,
  args: TArgs
) => AgentToolResult

export interface AgentTool<TArgs = Record<string, unknown>> extends AgentToolSchema {
  execute: AgentToolHandler<TArgs>
}

export interface OpenAIToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required: string[]
    }
  }
}
