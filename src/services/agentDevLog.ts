export type AgentDevLogEntryType =
  | 'turn_start'
  | 'turn_end'
  | 'api_response'
  | 'assistant_text'
  | 'tool_call'
  | 'tool_result'
  | 'error'

export interface AgentDevLogEntry {
  id: string
  timestamp: string
  type: AgentDevLogEntryType
  turnId?: string
  round?: number
  toolName?: string
  toolUseId?: string
  payload?: unknown
}

const MAX_ENTRIES = 400
const entries: AgentDevLogEntry[] = []
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function appendAgentDevLog(
  entry: Omit<AgentDevLogEntry, 'id' | 'timestamp'>
): AgentDevLogEntry {
  const full: AgentDevLogEntry = {
    ...entry,
    id: newId(),
    timestamp: new Date().toISOString(),
  }
  entries.push(full)
  while (entries.length > MAX_ENTRIES) entries.shift()
  notify()
  return full
}

export function getAgentDevLog(): AgentDevLogEntry[] {
  return [...entries]
}

export function clearAgentDevLog(): void {
  entries.length = 0
  notify()
}

export function subscribeAgentDevLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
