import type { ClaudeApiResponse, ClaudeContentBlock } from './types'

export interface StreamClaudeCallbacks {
  onTextDelta?: (text: string) => void
  onToolUseStart?: (toolName: string) => void
}

interface ParsedSseEvent {
  event: string
  data: Record<string, unknown>
}

function parseSseChunk(buffer: string): { events: ParsedSseEvent[]; remainder: string } {
  const events: ParsedSseEvent[] = []
  const parts = buffer.split('\n\n')
  const remainder = parts.pop() ?? ''

  for (const part of parts) {
    if (!part.trim()) continue

    let event = 'message'
    let dataLine = ''

    for (const line of part.split('\n')) {
      if (line.startsWith('event: ')) {
        event = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        dataLine = line.slice(6)
      }
    }

    if (!dataLine) continue

    try {
      events.push({ event, data: JSON.parse(dataLine) as Record<string, unknown> })
    } catch {
      // skip malformed chunks
    }
  }

  return { events, remainder }
}

export async function parseClaudeSseStream(
  body: ReadableStream<Uint8Array>,
  callbacks: StreamClaudeCallbacks = {}
): Promise<ClaudeApiResponse> {
  const reader = body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''
  let messageId = ''
  const contentBlocks: ClaudeContentBlock[] = []
  const toolInputJson: string[] = []
  let stopReason: ClaudeApiResponse['stop_reason'] = null
  let usage: ClaudeApiResponse['usage'] = { input_tokens: 0, output_tokens: 0 }

  const ensureTextBlock = (index: number) => {
    while (contentBlocks.length <= index) {
      contentBlocks.push({ type: 'text', text: '' })
    }
    const block = contentBlocks[index]
    if (block.type !== 'text') {
      contentBlocks[index] = { type: 'text', text: '' }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    const { events, remainder } = parseSseChunk(buffer)
    buffer = remainder

    for (const { event, data } of events) {
      const type = data.type as string | undefined

      if (event === 'error' || type === 'error') {
        const err = data.error as { type?: string; message?: string } | undefined
        throw new Error(err?.message ?? 'Stream error from Anthropic')
      }

      if (type === 'message_start') {
        const message = data.message as { id?: string } | undefined
        messageId = message?.id ?? messageId
      }

      if (type === 'content_block_start') {
        const index = data.index as number
        const block = data.content_block as { type?: string; id?: string; name?: string } | undefined
        if (block?.type === 'tool_use') {
          contentBlocks[index] = {
            type: 'tool_use',
            id: block.id ?? '',
            name: block.name ?? '',
            input: {},
          }
          toolInputJson[index] = ''
          callbacks.onToolUseStart?.(block.name ?? 'tool')
        } else {
          ensureTextBlock(index)
        }
      }

      if (type === 'content_block_delta') {
        const index = data.index as number
        const delta = data.delta as { type?: string; text?: string; partial_json?: string } | undefined

        if (delta?.type === 'text_delta' && delta.text) {
          ensureTextBlock(index)
          const block = contentBlocks[index]
          if (block.type === 'text') {
            block.text += delta.text
            callbacks.onTextDelta?.(delta.text)
          }
        }

        if (delta?.type === 'input_json_delta' && delta.partial_json) {
          toolInputJson[index] = (toolInputJson[index] ?? '') + delta.partial_json
        }
      }

      if (type === 'content_block_stop') {
        const index = data.index as number
        const block = contentBlocks[index]
        if (block?.type === 'tool_use') {
          try {
            block.input = JSON.parse(toolInputJson[index] || '{}') as Record<string, unknown>
          } catch {
            block.input = {}
          }
        }
      }

      if (type === 'message_delta') {
        const delta = data.delta as { stop_reason?: ClaudeApiResponse['stop_reason'] } | undefined
        if (delta?.stop_reason) stopReason = delta.stop_reason
        const usageData = data.usage as ClaudeApiResponse['usage'] | undefined
        if (usageData) usage = usageData
      }
    }
  }

  const filteredContent = contentBlocks.filter(
    (b) => (b.type === 'text' && b.text.length > 0) || b.type === 'tool_use'
  )

  return {
    id: messageId || 'streamed-message',
    type: 'message',
    role: 'assistant',
    content: filteredContent.length > 0 ? filteredContent : [{ type: 'text', text: '' }],
    stop_reason: stopReason,
    usage,
  }
}
