import {
  agentToolsToOpenAIToolDefinitions,
  getOpenAIToolDefinitionsForSession,
} from '../registry'
import { LOADABLE_TOOL_CATEGORY_IDS } from '../meta/catalog'
import type { ClaudeToolDefinition } from './types'

function toAnthropic(tools: ReturnType<typeof agentToolsToOpenAIToolDefinitions>): ClaudeToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: {
      type: 'object',
      properties: tool.function.parameters.properties,
      required: tool.function.parameters.required,
    },
  }))
}

/** All tools — for tests and tooling only; agent turns use getAnthropicToolDefinitionsForSession. */
export function getAnthropicToolDefinitions(): ClaudeToolDefinition[] {
  return toAnthropic(getOpenAIToolDefinitionsForSession(LOADABLE_TOOL_CATEGORY_IDS))
}

/** Tools exposed to the model for the current session (meta + loaded categories). */
export function getAnthropicToolDefinitionsForSession(
  loadedCategories: Iterable<string>
): ClaudeToolDefinition[] {
  return toAnthropic(getOpenAIToolDefinitionsForSession(loadedCategories))
}
