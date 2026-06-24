import {
  ClaudeApiError,
  ClaudeApiErrorBody,
  ClaudeApiResponse,
  ClaudeMessage,
  ClaudeToolDefinition,
} from './types'

const AGENT_MESSAGES_URL = '/api/agent/messages'

export interface SendClaudeMessageParams {
  messages: ClaudeMessage[]
  system: string
  tools?: ClaudeToolDefinition[]
  maxTokens?: number
  signal?: AbortSignal
}

export async function sendClaudeMessage({
  messages,
  system,
  tools,
  maxTokens = 4096,
  signal,
}: SendClaudeMessageParams): Promise<ClaudeApiResponse> {
  const body: Record<string, unknown> = {
    max_tokens: maxTokens,
    system,
    messages,
  }

  if (tools && tools.length > 0) {
    body.tools = tools
  }

  const response = await fetch(AGENT_MESSAGES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  const payload = (await response.json()) as ClaudeApiResponse | ClaudeApiErrorBody

  if (!response.ok) {
    const err = payload as ClaudeApiErrorBody
    throw new ClaudeApiError(
      response.status,
      err.error?.type ?? 'unknown_error',
      err.error?.message ?? `Agent API request failed (${response.status})`
    )
  }

  return payload as ClaudeApiResponse
}
