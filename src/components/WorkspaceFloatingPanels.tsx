import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Focus } from 'lucide-react'
import { useAgent } from '../contexts/AgentContext'
import { AgentPanel } from './AgentPanel'
import { DevicePanel } from './DevicePanel'
import { FloatingPanel } from './FloatingPanel'
import { HoverStatsPanel } from './HoverStatsPanel'
import { PowerPanel } from './PowerPanel'
import { ResizableWorkspaceStack } from './ResizableWorkspaceStack'
import type { HoverStats } from '../utils/hoverStats'

type DevicePanelProps = ComponentProps<typeof DevicePanel>

interface WorkspaceFloatingPanelsProps {
  gridData: DevicePanelProps['gridData']
  wires: DevicePanelProps['wires']
  componentStates: DevicePanelProps['componentStates']
  projectPrograms?: DevicePanelProps['projectPrograms']
  programFlashes?: DevicePanelProps['programFlashes']
  onMicrocontrollerHighlight: DevicePanelProps['onMicrocontrollerHighlight']
  onModalStateChange: DevicePanelProps['onModalStateChange']
  onSimulationStateChange: DevicePanelProps['onSimulationStateChange']
  onWiresChange: DevicePanelProps['onWiresChange']
  onUpdatePowerSupply: ComponentProps<typeof PowerPanel>['onUpdatePowerSupply']
  onRecenter?: () => void
  recenterEnabled?: boolean
  hoverStats?: HoverStats | null
}

export function WorkspaceFloatingPanels({
  gridData,
  wires,
  componentStates,
  projectPrograms,
  programFlashes,
  onMicrocontrollerHighlight,
  onModalStateChange,
  onSimulationStateChange,
  onWiresChange,
  onUpdatePowerSupply,
  onRecenter,
  recenterEnabled = false,
  hoverStats = null,
}: WorkspaceFloatingPanelsProps) {
  const { isExpanded, toggleExpanded, ensureExpanded, revealPhase, showAgentChrome } = useAgent()
  const agentBodyVisible = revealPhase === 'expanded' && isExpanded

  const [deviceExpanded, setDeviceExpanded] = useState(true)
  const [powerExpanded, setPowerExpanded] = useState(false)
  const [monitorExpanded, setMonitorExpanded] = useState(false)

  useEffect(() => {
    showAgentChrome()
  }, [showAgentChrome])

  const handleAgentToggle = useCallback(() => {
    if (isExpanded) toggleExpanded()
    else ensureExpanded()
  }, [isExpanded, toggleExpanded, ensureExpanded])

  return (
    <FloatingPanel
      side="right"
      vertical="fill"
      sideClass="right-2"
      fillTopClass="top-4"
      fillBottomClass="bottom-4"
      className="w-[min(380px,calc(100%-1rem))]"
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white dark:bg-carbon-card">
        <ResizableWorkspaceStack
          deviceExpanded={deviceExpanded}
          powerExpanded={powerExpanded}
          monitorExpanded={monitorExpanded}
          agentExpanded={agentBodyVisible}
          device={
            <div className="flex h-full min-h-0 flex-col overflow-hidden border-b border-black/[0.06] dark:border-white/[0.06]">
              <DevicePanel
                embedded
                floating
                stacked
                gridData={gridData}
                wires={wires}
                componentStates={componentStates}
                projectPrograms={projectPrograms}
                programFlashes={programFlashes}
                onMicrocontrollerHighlight={onMicrocontrollerHighlight}
                onMicrocontrollerClick={() => {}}
                onModalStateChange={onModalStateChange}
                onSimulationStateChange={onSimulationStateChange}
                onWiresChange={onWiresChange}
                onExpandedChange={setDeviceExpanded}
              />
            </div>
          }
          power={
            <div className="flex h-full min-h-0 flex-col overflow-hidden border-b border-black/[0.06] dark:border-white/[0.06]">
              <PowerPanel
                floating
                embedded
                stacked
                gridData={gridData}
                onUpdatePowerSupply={onUpdatePowerSupply}
                onExpandedChange={setPowerExpanded}
              />
            </div>
          }
          monitor={
            <div className="flex h-full min-h-0 flex-col overflow-hidden border-b border-black/[0.06] dark:border-white/[0.06]">
              <HoverStatsPanel
                stats={hoverStats}
                embedded
                floating
                stacked
                onExpandedChange={setMonitorExpanded}
              />
            </div>
          }
          agent={
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <AgentPanel
                embedded
                floating
                onHeaderToggle={handleAgentToggle}
                className="h-full min-h-0 flex-1"
              />
            </div>
          }
          footer={
            onRecenter ? (
              <div className="border-t border-black/[0.06] p-2 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={onRecenter}
                  disabled={!recenterEnabled}
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 shadow-sm transition-all dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 ${
                    recenterEnabled
                      ? 'cursor-pointer bg-white text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      : 'cursor-default bg-white text-gray-700 opacity-40 dark:bg-gray-800'
                  }`}
                  title={recenterEnabled ? 'Zoom to last placed component' : 'Place a component first'}
                  aria-label="Zoom to last placed component"
                  data-control-buttons
                >
                  <Focus className="h-5 w-5" />
                </button>
              </div>
            ) : undefined
          }
        />
      </div>
    </FloatingPanel>
  )
}
