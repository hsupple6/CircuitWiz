import { useState } from 'react'
import { ChevronDown, ChevronRight, Focus, Trash2, Box } from 'lucide-react'
import type { SchematicGroupBox } from '../types/workspace'
import { GROUP_BOX_COLOR_PRESETS } from '../types/workspace'

interface SchematicGroupBoxBrowserProps {
  groupBoxes: SchematicGroupBox[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<SchematicGroupBox>) => void
  onDelete: (id: string) => void
  onFocus: (box: SchematicGroupBox) => void
}

export function SchematicGroupBoxBrowser({
  groupBoxes,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onFocus,
}: SchematicGroupBoxBrowserProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border-t border-black/[0.06] bg-white dark:border-white/[0.06] dark:bg-carbon-card flex flex-col max-h-64 shrink-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-card shrink-0"
      >
        <span className="flex items-center gap-2 font-medium text-sm text-gray-900 dark:text-dark-text-primary">
          <Box className="h-4 w-4 text-primary-500" />
          Regions
          <span className="text-xs text-gray-400 font-normal">{groupBoxes.length}</span>
        </span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {groupBoxes.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-dark-text-muted text-center py-4 px-2">
              Select <strong>Group Box</strong> from Organization, then click and drag on the schematic to draw a region.
            </p>
          ) : (
            groupBoxes.map((box) => {
              const selected = selectedId === box.id
              return (
                <div
                  key={box.id}
                  className={`rounded-lg border p-2 transition-all cursor-pointer ${
                    selected
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 ring-1 ring-primary-500'
                      : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => onSelect(selected ? null : box.id)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-4 h-4 rounded border shrink-0"
                      style={{ backgroundColor: box.color, borderColor: box.borderColor }}
                    />
                    <input
                      value={box.title}
                      onChange={(e) => {
                        e.stopPropagation()
                        onUpdate(box.id, { title: e.target.value })
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 text-xs font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-primary-500 rounded px-1"
                      placeholder="Region title"
                    />
                    <button
                      type="button"
                      title="Focus on region"
                      onClick={(e) => {
                        e.stopPropagation()
                        onFocus(box)
                        onSelect(box.id)
                      }}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-card text-gray-500"
                    >
                      <Focus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete region"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(box.id)
                      }}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                    {GROUP_BOX_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        title={preset.name}
                        onClick={() =>
                          onUpdate(box.id, { color: preset.fill, borderColor: preset.border })
                        }
                        className={`w-5 h-5 rounded border-2 transition-transform hover:scale-110 ${
                          box.borderColor === preset.border ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: preset.fill }}
                      />
                    ))}
                  </div>

                  <p className="text-[10px] text-gray-400 mt-1.5">
                    {box.width} × {box.height} cells at ({box.x}, {box.y})
                  </p>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
