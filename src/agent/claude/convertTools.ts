import { getOpenAIToolDefinitions } from '../registry'
import type { ClaudeToolDefinition } from './types'

/** Convert registered CircuitWiz tools to Anthropic tool format */
export function getAnthropicToolDefinitions(): ClaudeToolDefinition[] {
  return getOpenAIToolDefinitions().map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: {
      type: 'object',
      properties: tool.function.parameters.properties,
      required: tool.function.parameters.required,
    },
  }))
}
