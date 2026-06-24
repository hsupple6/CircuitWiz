/** Primary server env var — set in `.env` as ANTHROPIC_API_KEY=sk-ant-... */
export const ANTHROPIC_API_KEY_ENV_VAR = 'ANTHROPIC_API_KEY'

export function getAnthropicApiKeySetupHint(): string {
  return `Set ${ANTHROPIC_API_KEY_ENV_VAR} in your .env file and restart the backend (npm run dev:full or npm run dev:backend).`
}

export function getAgentBackendOfflineHint(): string {
  return 'Agent backend is offline. Start it with npm run dev:backend or npm run dev:full.'
}
