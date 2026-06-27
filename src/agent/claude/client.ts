import {
  ClaudeApiError,
  ClaudeApiErrorBody,
  ClaudeApiResponse,
  ClaudeMessage,
  ClaudeToolDefinition,
} from './types'
import { parseClaudeSseStream, type StreamClaudeCallbacks } from './streamParser'

const AGENT_MESSAGES_URL = '/api/agent/messages'

export interface SendClaudeMessageParams {
  messages: ClaudeMessage[]
  system: string
  tools?: ClaudeToolDefinition[]
  maxTokens?: number
  signal?: AbortSignal
}

export type StreamClaudeMessageParams = SendClaudeMessageParams & StreamClaudeCallbacks

export async function streamClaudeMessage({
  messages,
  system,
  tools,
  maxTokens = 4096,
  signal,
  onTextDelta,
  onToolUseStart,
}: StreamClaudeMessageParams): Promise<ClaudeApiResponse> {
  const body: Record<string, unknown> = {
    max_tokens: maxTokens,
    system,
    messages,
    stream: true,
  }

  if (tools && tools.length > 0) {
    body.tools = tools
  }

  const response = await fetch(AGENT_MESSAGES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const err = (await response.json()) as ClaudeApiErrorBody
      throw new ClaudeApiError(
        response.status,
        err.error?.type ?? 'unknown_error',
        err.error?.message ?? `Agent API request failed (${response.status})`
      )
    }
    throw new ClaudeApiError(
      response.status,
      'unknown_error',
      `Agent API request failed (${response.status})`
    )
  }

  if (!response.body) {
    throw new ClaudeApiError(502, 'api_error', 'Empty streaming response from agent backend')
  }

  return parseClaudeSseStream(response.body, { onTextDelta, onToolUseStart })
}

/** @deprecated Use streamClaudeMessage for live token rendering */
export async function sendClaudeMessage(params: SendClaudeMessageParams): Promise<ClaudeApiResponse> {
  return streamClaudeMessage(params)
}
