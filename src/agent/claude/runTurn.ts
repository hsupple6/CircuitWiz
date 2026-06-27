import { executeAgentTool } from '../registry'
import type { AgentProjectContext, AgentUiAction } from '../types'
import { streamClaudeMessage } from './client'
import { getAnthropicToolDefinitions } from './convertTools'
import { AGENT_SYSTEM_PROMPT } from './systemPrompt'
import type { ClaudeContentBlock, ClaudeMessage } from './types'

const MAX_TOOL_ROUNDS = 8

export interface AgentTurnResult {
  messages: ClaudeMessage[]
  assistantText: string
  toolCallsExecuted: number
  updatedContext?: AgentProjectContext
  uiActions?: AgentUiAction[]
}

function extractText(blocks: ClaudeContentBlock[]): string {
  return blocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

function extractToolUses(blocks: ClaudeContentBlock[]) {
  return blocks.filter(
    (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
      b.type === 'tool_use'
  )
}

export async function runAgentTurn(params: {
  history: ClaudeMessage[]
  userMessage: string
  projectContext: AgentProjectContext | null
  signal?: AbortSignal
  onTextDelta?: (text: string) => void
  onToolUseStart?: (toolName: string) => void
}): Promise<AgentTurnResult> {
  const { history, userMessage, signal, onTextDelta, onToolUseStart } = params
  let { projectContext } = params

  const toolsEnabled = Boolean(projectContext)
  const tools = toolsEnabled ? getAnthropicToolDefinitions() : undefined

  const conversation: ClaudeMessage[] = [
    ...history,
    { role: 'user', content: userMessage },
  ]

  let toolCallsExecuted = 0
  let assistantText = ''
  const uiActions: AgentUiAction[] = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await streamClaudeMessage({
      messages: conversation,
      system: AGENT_SYSTEM_PROMPT,
      tools,
      signal,
      onTextDelta,
      onToolUseStart,
    })

    conversation.push({ role: 'assistant', content: response.content })
    assistantText += extractText(response.content)

    if (response.stop_reason !== 'tool_use') {
      break
    }

    const toolUses = extractToolUses(response.content)
    if (toolUses.length === 0) break

    const toolResults: ClaudeContentBlock[] = []

    for (const toolUse of toolUses) {
      toolCallsExecuted++

      if (!projectContext) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'No project is open. Open a project folder to use tools.',
          is_error: true,
        })
        continue
      }

      const result = executeAgentTool(toolUse.name, projectContext, toolUse.input)
      if (result.folder) {
        projectContext = {
          ...projectContext,
          folder: result.folder,
        }
      }
      if (result.uiAction) {
        uiActions.push(result.uiAction)
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({
          success: result.success,
          message: result.message,
          data: result.data,
        }),
        is_error: !result.success,
      })
    }

    conversation.push({ role: 'user', content: toolResults })
  }

  return {
    messages: conversation,
    assistantText: assistantText.trim(),
    toolCallsExecuted,
    updatedContext: projectContext ?? undefined,
    uiActions: uiActions.length > 0 ? uiActions : undefined,
  }
}
