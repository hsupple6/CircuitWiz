import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react'
import { Activity, BookOpen, Cpu, Focus, Sparkles, Zap } from 'lucide-react'
import { useAgent } from '../contexts/AgentContext'
import { AgentPanel } from './AgentPanel'
import { DevicePanel } from './DevicePanel'
import { ExamplesDocsPanel } from './ExamplesDocsPanel'
import { FloatingPanel } from './FloatingPanel'
import { HoverStatsPanel } from './HoverStatsPanel'
import { PowerPanel } from './PowerPanel'
import type { HoverStats } from '../utils/hoverStats'

type DevicePanelProps = ComponentProps<typeof DevicePanel>
type WorkspacePanel = 'device' | 'power' | 'monitor' | 'agent' | 'docs'

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
  liveMonitorExpanded?: boolean
  onLiveMonitorExpandedChange?: (expanded: boolean) => void
  /** Examples folder schematic — enables the Docs tab. */
  showExamplesDocs?: boolean
  examplesSchematicId?: string
  examplesSchematicName?: string
}

const BASE_TABS: Array<{
  id: Exclude<WorkspacePanel, 'docs'>
  label: string
  icon: typeof Cpu
}> = [
  { id: 'device', label: 'Device', icon: Cpu },
  { id: 'power', label: 'Power', icon: Zap },
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'agent', label: 'Agent', icon: Sparkles },
]

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
  liveMonitorExpanded,
  onLiveMonitorExpandedChange,
  showExamplesDocs = false,
  examplesSchematicId,
  examplesSchematicName,
}: WorkspaceFloatingPanelsProps) {
  const { ensureExpanded, showAgentChrome } = useAgent()

  const [activeTab, setActiveTab] = useState<WorkspacePanel>('device')

  const tabs = useMemo((): Array<{ id: WorkspacePanel; label: string; icon: typeof Cpu }> => {
    const items: Array<{ id: WorkspacePanel; label: string; icon: typeof Cpu }> = [...BASE_TABS]
    if (showExamplesDocs) {
      items.push({ id: 'docs', label: 'Docs', icon: BookOpen })
    }
    return items
  }, [showExamplesDocs])

  useEffect(() => {
    showAgentChrome()
  }, [showAgentChrome])

  useEffect(() => {
    if (liveMonitorExpanded === true) setActiveTab('monitor')
  }, [liveMonitorExpanded])

  useEffect(() => {
    if (!showExamplesDocs && activeTab === 'docs') {
      setActiveTab('device')
    }
  }, [showExamplesDocs, activeTab])

  const selectTab = useCallback(
    (tab: WorkspacePanel) => {
      setActiveTab(tab)
      if (tab === 'monitor') {
        onLiveMonitorExpandedChange?.(true)
      } else {
        onLiveMonitorExpandedChange?.(false)
      }
      if (tab === 'agent') {
        ensureExpanded()
      }
    },
    [ensureExpanded, onLiveMonitorExpandedChange]
  )

  return (
    <FloatingPanel
      side="right"
      vertical="fill"
      sideClass="right-2"
      fillTopClass="top-16"
      fillBottomClass="bottom-4"
      className="w-[min(420px,calc(100%-1rem))]"
      innerClassName="border-black/[0.08] bg-white dark:border-white/10 dark:bg-[#1e1e1e]"
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden text-gray-900 dark:text-zinc-100">
        <div className="shrink-0 border-b border-gray-200 px-2 py-2 dark:border-white/10">
          <div
            className={
              tabs.length > 4
                ? 'grid grid-cols-3 gap-1'
                : 'flex flex-wrap gap-1'
            }
            role="tablist"
            aria-label="Workspace panels"
          >
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              const compact = tabs.length > 4
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(id)}
                  className={`inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors ${
                    compact ? 'w-full px-2 py-1.5 text-xs' : 'shrink-0 px-3 py-2 text-sm'
                  } ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`shrink-0 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {activeTab === 'device' && (
            <DevicePanel
              embedded
              floating
              stacked
              hideHeader
              expanded
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
            />
          )}
          {activeTab === 'power' && (
            <PowerPanel
              floating
              embedded
              stacked
              hideHeader
              expanded
              gridData={gridData}
              onUpdatePowerSupply={onUpdatePowerSupply}
            />
          )}
          {activeTab === 'monitor' && (
            <HoverStatsPanel
              stats={hoverStats}
              embedded
              floating
              stacked
              hideHeader
              expanded
            />
          )}
          {activeTab === 'agent' && (
            <AgentPanel embedded floating docked className="h-full min-h-0 flex-1" />
          )}
          {activeTab === 'docs' && showExamplesDocs && (
            <ExamplesDocsPanel
              schematicId={examplesSchematicId}
              schematicName={examplesSchematicName}
            />
          )}
        </div>

        {onRecenter ? (
          <div className="shrink-0 border-t border-gray-200 p-2 dark:border-white/10">
            <button
              type="button"
              onClick={onRecenter}
              disabled={!recenterEnabled}
              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
                recenterEnabled
                  ? 'cursor-pointer border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                  : 'cursor-default border-gray-200 bg-gray-50 text-gray-400 opacity-50 dark:border-white/10 dark:bg-zinc-800/50 dark:text-zinc-500'
              }`}
              title={recenterEnabled ? 'Zoom to last placed component' : 'Place a component first'}
              aria-label="Zoom to last placed component"
              data-control-buttons
            >
              <Focus className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>
    </FloatingPanel>
  )
}
