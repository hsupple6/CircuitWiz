import { useCallback } from 'react'
import { useAgent } from '../contexts/AgentContext'
import { AgentPanel } from './AgentPanel'
import { DEVICE_PANEL_SLOT_ID, POWER_PANEL_SLOT_ID } from './VerticalSplitPane'

interface RightWorkspaceRailProps {
  showDevicePanel?: boolean
  showPowerPanel?: boolean
}

export function RightWorkspaceRail({
  showDevicePanel = false,
  showPowerPanel = false,
}: RightWorkspaceRailProps) {
  const { isExpanded, toggleExpanded, ensureExpanded, revealPhase } = useAgent()

  const agentBodyVisible = revealPhase === 'expanded' && isExpanded

  const handleAgentToggle = useCallback(() => {
    if (isExpanded) toggleExpanded()
    else ensureExpanded()
  }, [isExpanded, toggleExpanded, ensureExpanded])

  return (
    <div className="agent-slot flex h-full min-h-0 w-80 shrink-0 flex-col border-l border-white/[0.06] bg-carbon-matte/50 xl:w-[22rem] dark:border-dark-border dark:bg-dark-surface/80">
      {showDevicePanel && (
        <div
          id={DEVICE_PANEL_SLOT_ID}
          className="shrink-0 border-b border-white/[0.06] bg-carbon-card/40 dark:bg-dark-surface/60"
        />
      )}

      {showPowerPanel && (
        <div id={POWER_PANEL_SLOT_ID} className="shrink-0 border-b border-white/[0.06] p-2" />
      )}

      <div className={`flex min-h-0 flex-col p-2 ${agentBodyVisible ? 'flex-1' : 'shrink-0'}`}>
        <AgentPanel embedded onHeaderToggle={handleAgentToggle} className={agentBodyVisible ? 'h-full flex-1' : undefined} />
      </div>
    </div>
  )
}
