import {
  PlanSpace,
  ProjectFolder,
  PipelineStage,
} from '../types/workspace'

export type { PipelineStage }

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

/** Full project context — all agent tools operate on the entire revisable project */
export interface AgentProjectContext {
  folder: ProjectFolder
  activeSchematicId?: string | null
  activeDocumentId?: string | null
}

/** @deprecated Use AgentProjectContext */
export type AgentPlanSpaceContext = AgentProjectContext

export interface AgentToolResult {
  success: boolean
  message: string
  folder?: ProjectFolder
  planSpace?: PlanSpace
  data?: unknown
}

export type AgentToolHandler<TArgs = Record<string, unknown>> = (
  context: AgentProjectContext,
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

export const PIPELINE_STAGES: PipelineStage[] = [
  'elicitation',
  'system_design',
  'schematic',
  'code_architecture',
  'bom',
  'assembly',
]

/** Suggested tool categories per pipeline stage for orchestrators */
export const PIPELINE_STAGE_TOOL_CATEGORIES: Record<PipelineStage, string[]> = {
  elicitation: ['requirements', 'document', 'plan_space', 'project'],
  system_design: ['plan_space', 'document', 'catalog', 'project'],
  schematic: ['schematic', 'catalog', 'validation', 'project'],
  code_architecture: ['firmware', 'schematic', 'document', 'validation', 'project'],
  bom: ['bom', 'catalog', 'schematic', 'project'],
  assembly: ['assembly', 'document', 'firmware', 'validation', 'project'],
}
