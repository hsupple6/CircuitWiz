import { useEffect, useState } from 'react'

interface AgentStatus {
  configured: boolean
  model: string
  loading: boolean
  backendOnline: boolean
}

export function useAgentApiKey() {
  const [status, setStatus] = useState<AgentStatus>({
    configured: false,
    model: '',
    loading: true,
    backendOnline: false,
  })

  useEffect(() => {
    let cancelled = false

    fetch('/api/agent/status')
      .then(async (response) => {
        if (!response.ok) throw new Error('Agent status unavailable')
        return response.json() as Promise<{ configured: boolean; model: string }>
      })
      .then((data) => {
        if (cancelled) return
        setStatus({
          configured: Boolean(data.configured),
          model: data.model ?? '',
          loading: false,
          backendOnline: true,
        })
      })
      .catch(() => {
        if (cancelled) return
        setStatus({
          configured: false,
          model: '',
          loading: false,
          backendOnline: false,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    hasApiKey: status.configured,
    model: status.model,
    loading: status.loading,
    backendOnline: status.backendOnline,
  }
}
