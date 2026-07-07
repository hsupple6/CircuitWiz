import type { ComponentProps } from 'react'
import { ComponentPalette } from './ComponentPalette'
import { FloatingPanel } from './FloatingPanel'
import { SchematicGroupBoxBrowser } from './SchematicGroupBoxBrowser'

type GroupBoxBrowserProps = ComponentProps<typeof SchematicGroupBoxBrowser>

interface ComponentsFloatingPanelProps {
  selectedModule: ComponentProps<typeof ComponentPalette>['selectedModule']
  onModuleSelect: ComponentProps<typeof ComponentPalette>['onModuleSelect']
  deleteMode?: boolean
  onToggleDeleteMode?: () => void
  groupBoxBrowser?: GroupBoxBrowserProps
}

export function ComponentsFloatingPanel({
  selectedModule,
  onModuleSelect,
  deleteMode,
  onToggleDeleteMode,
  groupBoxBrowser,
}: ComponentsFloatingPanelProps) {
  return (
    <FloatingPanel
      side="left"
      vertical="fill"
      sideClass="left-2"
      fillTopClass="top-16"
      fillBottomClass="bottom-4"
      className="w-[min(360px,calc(100%-1rem))]"
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white dark:bg-carbon-card">
        <div className="min-h-0 flex-1 overflow-hidden">
          <ComponentPalette
            selectedModule={selectedModule}
            onModuleSelect={onModuleSelect}
            deleteMode={deleteMode}
            onToggleDeleteMode={onToggleDeleteMode}
          />
        </div>
        {groupBoxBrowser && (
          <SchematicGroupBoxBrowser
            groupBoxes={groupBoxBrowser.groupBoxes}
            selectedId={groupBoxBrowser.selectedId}
            onSelect={groupBoxBrowser.onSelect}
            onUpdate={groupBoxBrowser.onUpdate}
            onDelete={groupBoxBrowser.onDelete}
            onFocus={groupBoxBrowser.onFocus}
          />
        )}
      </div>
    </FloatingPanel>
  )
}
