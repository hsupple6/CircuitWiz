export const CLAUDE_MODEL = 'claude-sonnet-4-6'
export const ANTHROPIC_API_VERSION = '2023-06-01'

export interface ClaudeToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export interface ClaudeApiUsage {
  input_tokens: number
  output_tokens: number
}

export interface ClaudeApiResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: ClaudeContentBlock[]
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null
  usage: ClaudeApiUsage
}

export interface ClaudeApiErrorBody {
  type: 'error'
  error: {
    type: string
    message: string
  }
}

export class ClaudeApiError extends Error {
  readonly status: number
  readonly errorType: string

  constructor(status: number, errorType: string, message: string) {
    super(message)
    this.name = 'ClaudeApiError'
    this.status = status
    this.errorType = errorType
  }
}
