import { executeAgentTool } from '../registry'
import type { AgentProjectContext, AgentUiAction } from '../types'
import type { ProjectFolder } from '../../types/workspace'
import { streamClaudeMessage } from './client'
import { getAnthropicToolDefinitionsForSession } from './convertTools'
import { AGENT_SYSTEM_PROMPT } from './systemPrompt'
import type { ClaudeContentBlock, ClaudeMessage } from './types'
import { appendAgentDevLog } from '../../services/agentDevLog'

const MAX_TOOL_ROUNDS = 24

export interface AgentTurnResult {
  messages: ClaudeMessage[]
  assistantText: string
  toolCallsExecuted: number
  updatedContext?: AgentProjectContext
  uiActions?: AgentUiAction[]
  openSchematicId?: string | null
  hitToolRoundLimit?: boolean
  loadedToolCategories?: string[]
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
  loadedToolCategories?: Iterable<string>
  signal?: AbortSignal
  onTextDelta?: (text: string) => void
  onToolUseStart?: (toolName: string, toolUseId?: string) => void
  onToolUseComplete?: (toolName: string, success: boolean) => void
  onFolderUpdate?: (
    folder: ProjectFolder,
    meta?: { activeSchematicId?: string | null; activeDocumentId?: string | null }
  ) => void
}): Promise<AgentTurnResult> {
  const {
    history,
    userMessage,
    signal,
    onTextDelta,
    onToolUseStart,
    onToolUseComplete,
    onFolderUpdate,
  } = params
  let { projectContext } = params
  const loadedCategories = new Set(params.loadedToolCategories ?? [])

  const toolsEnabled = Boolean(projectContext)
  const getTools = () =>
    toolsEnabled ? getAnthropicToolDefinitionsForSession(loadedCategories) : undefined

  const conversation: ClaudeMessage[] = [
    ...history,
    { role: 'user', content: userMessage },
  ]

  let toolCallsExecuted = 0
  let assistantText = ''
  const uiActions: AgentUiAction[] = []
  const turnId = `${Date.now()}`
  let hitToolRoundLimit = false

  appendAgentDevLog({
    type: 'turn_start',
    turnId,
    payload: {
      userMessage,
      hasProject: Boolean(projectContext),
      loadedCategories: [...loadedCategories],
      exposedToolCount: getTools()?.length ?? 0,
    },
  })

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (signal?.aborted) {
      throw new DOMException('Agent turn aborted', 'AbortError')
    }

    const response = await streamClaudeMessage({
      messages: conversation,
      system: AGENT_SYSTEM_PROMPT,
      tools: getTools(),
      signal,
      onTextDelta,
      onToolUseStart,
    })

    conversation.push({ role: 'assistant', content: response.content })
    const roundText = extractText(response.content)
    assistantText += roundText

    appendAgentDevLog({
      type: 'api_response',
      turnId,
      round,
      payload: {
        stop_reason: response.stop_reason,
        content: response.content,
      },
    })

    if (roundText.trim()) {
      appendAgentDevLog({
        type: 'assistant_text',
        turnId,
        round,
        payload: roundText,
      })
    }

    if (response.stop_reason !== 'tool_use') {
      break
    }

    const toolUses = extractToolUses(response.content)
    if (toolUses.length === 0) break

    const toolResults: ClaudeContentBlock[] = []

    for (const toolUse of toolUses) {
      if (signal?.aborted) {
        throw new DOMException('Agent turn aborted', 'AbortError')
      }

      toolCallsExecuted++

      appendAgentDevLog({
        type: 'tool_call',
        turnId,
        round,
        toolName: toolUse.name,
        toolUseId: toolUse.id,
        payload: toolUse.input,
      })

      if (!projectContext) {
        const errMsg = 'No project is open. Open a project folder to use tools.'
        appendAgentDevLog({
          type: 'tool_result',
          turnId,
          round,
          toolName: toolUse.name,
          toolUseId: toolUse.id,
          payload: { success: false, message: errMsg },
        })
        onToolUseComplete?.(toolUse.name, false)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: errMsg,
          is_error: true,
        })
        continue
      }

      const result = executeAgentTool(toolUse.name, projectContext, toolUse.input)

      if (
        toolUse.name === 'agent_load_tool_categories' &&
        result.success &&
        result.data &&
        typeof result.data === 'object' &&
        Array.isArray((result.data as { loadedCategories?: unknown }).loadedCategories)
      ) {
        for (const category of (result.data as { loadedCategories: string[] }).loadedCategories) {
          loadedCategories.add(category)
        }
      }

      if (result.folder) {
        projectContext = {
          ...projectContext,
          folder: result.folder,
        }
        onFolderUpdate?.(result.folder, {
          activeSchematicId: result.activeSchematicId ?? projectContext.activeSchematicId,
          activeDocumentId: result.activeDocumentId ?? projectContext.activeDocumentId,
        })
      }
      if (result.activeSchematicId !== undefined) {
        projectContext = {
          ...projectContext,
          activeSchematicId: result.activeSchematicId,
        }
      }
      if (result.activeDocumentId !== undefined) {
        projectContext = {
          ...projectContext,
          activeDocumentId: result.activeDocumentId,
        }
      }
      if (result.uiAction) {
        uiActions.push(result.uiAction)
      }

      const resultPayload = {
        success: result.success,
        message: result.message,
        data: result.data,
        activeSchematicId: result.activeSchematicId,
      }

      appendAgentDevLog({
        type: 'tool_result',
        turnId,
        round,
        toolName: toolUse.name,
        toolUseId: toolUse.id,
        payload: resultPayload,
      })

      onToolUseComplete?.(toolUse.name, result.success)

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(resultPayload),
        is_error: !result.success,
      })
    }

    conversation.push({ role: 'user', content: toolResults })

    if (round === MAX_TOOL_ROUNDS - 1) {
      hitToolRoundLimit = true
    }
  }

  appendAgentDevLog({
    type: 'turn_end',
    turnId,
    payload: {
      toolCallsExecuted,
      hitToolRoundLimit,
      activeSchematicId: projectContext?.activeSchematicId ?? null,
      assistantTextLength: assistantText.length,
    },
  })

  return {
    messages: conversation,
    assistantText: assistantText.trim(),
    toolCallsExecuted,
    updatedContext: projectContext ?? undefined,
    uiActions: uiActions.length > 0 ? uiActions : undefined,
    openSchematicId: projectContext?.activeSchematicId ?? undefined,
    hitToolRoundLimit,
    loadedToolCategories: [...loadedCategories],
  }
}
