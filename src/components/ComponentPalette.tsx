import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, Settings, X } from 'lucide-react'
import { getAllModulesWithTypes } from '../modules/registry'
import {
  groupEntriesForPalette,
  moduleMatchesSearch,
  type PaletteGroup,
} from '../modules/componentCatalog'
import { DynamicModule } from './DynamicModule'
import { ModuleDefinition } from '../modules/types'
import type { ModuleRegistryEntry } from '../modules/registry'

interface ComponentPaletteProps {
  selectedModule: ModuleDefinition | null
  onModuleSelect: (module: ModuleDefinition | null) => void
}

function ModuleCard({
  entry,
  selected,
  onSelect,
}: {
  entry: ModuleRegistryEntry
  selected: boolean
  onSelect: () => void
}) {
  const module = entry.definition

  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer transition-all duration-200 ${
        selected
          ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-dark-bg'
          : 'hover:shadow-md'
      }`}
    >
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden flex flex-col">
        <div className="h-24 flex items-center justify-center bg-gray-50 dark:bg-dark-bg overflow-hidden" data-module-preview>
          <DynamicModule
            definition={module}
            className="scale-[0.3] origin-center"
            style={{ transform: `scale(0.3) rotate(${module.gridX > module.gridY ? '0deg' : '90deg'})` }}
          />
        </div>
        <div className="p-2">
          <div className="flex items-center justify-between gap-1">
            <h3 className="font-medium text-gray-900 dark:text-dark-text-primary text-xs truncate">
              {module.module}
            </h3>
            {entry.type && (
              <div title="Configurable component">
                <Settings className="w-3 h-3 text-blue-500 shrink-0" />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">{module.gridX} × {module.gridY}</p>
          {module.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{module.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ModuleList({
  entries,
  selectedModule,
  onSelect,
}: {
  entries: ModuleRegistryEntry[]
  selectedModule: ModuleDefinition | null
  onSelect: (m: ModuleDefinition) => void
}) {
  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <ModuleCard
          key={entry.definition.module}
          entry={entry}
          selected={selectedModule?.module === entry.definition.module}
          onSelect={() => onSelect(entry.definition)}
        />
      ))}
    </div>
  )
}

export function ComponentPalette({ selectedModule, onModuleSelect }: ComponentPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(['microcontrollers', 'power', 'output', 'output.electromechanical', 'output.light'])
  )

  const paletteStructure = useMemo(() => {
    const matching = getAllModulesWithTypes().filter((e) => moduleMatchesSearch(e, searchQuery))
    const groups = groupEntriesForPalette(matching)
    const topLevel: Array<PaletteGroup | { type: 'output-parent'; subgroups: PaletteGroup[] }> = []
    const outputSubgroups: PaletteGroup[] = []

    groups.forEach((group) => {
      if (group.parentId === 'output') outputSubgroups.push(group)
      else topLevel.push(group)
    })

    if (outputSubgroups.length > 0) {
      const idx = topLevel.findIndex((g) => 'groupId' in g && g.groupId === 'sensors')
      const parent = { type: 'output-parent' as const, subgroups: outputSubgroups }
      if (idx === -1) topLevel.push(parent)
      else topLevel.splice(idx, 0, parent)
    }

    return topLevel
  }, [searchQuery])

  const isSearching = searchQuery.trim().length > 0

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isExpanded = (id: string) => isSearching || expandedGroups.has(id)

  return (
    <div className="w-80 bg-white dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-dark-border space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">Components</h2>
          <p className="text-sm text-gray-500 dark:text-dark-text-muted">Click to select, then place on grid</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search components…"
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {paletteStructure.length === 0 ? (
          <p className="text-sm text-center text-gray-500 py-8">No matches for &ldquo;{searchQuery}&rdquo;</p>
        ) : (
          paletteStructure.map((item) => {
            if ('type' in item && item.type === 'output-parent') {
              const open = isExpanded('output')
              const count = item.subgroups.reduce((n, g) => n + g.entries.length, 0)
              return (
                <div key="output" className="border border-gray-200 dark:border-dark-border rounded-lg">
                  <button
                    type="button"
                    onClick={() => toggleGroup('output')}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-dark-card"
                  >
                    <span className="font-medium text-sm">Output <span className="text-xs text-gray-400">{count}</span></span>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {open && (
                    <div className="border-t p-2 space-y-2">
                      {item.subgroups.map((sub) => (
                        <div key={sub.groupId} className="border border-gray-100 dark:border-dark-border rounded-md">
                          <button
                            type="button"
                            onClick={() => toggleGroup(sub.groupId)}
                            className="w-full flex items-center justify-between px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-dark-card"
                          >
                            <span className="pl-1">{sub.label} <span className="text-xs text-gray-400">{sub.entries.length}</span></span>
                            {isExpanded(sub.groupId) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                          {isExpanded(sub.groupId) && (
                            <div className="p-2 pt-0">
                              <ModuleList entries={sub.entries} selectedModule={selectedModule} onSelect={(m) => onModuleSelect(selectedModule?.module === m.module ? null : m)} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            const group = item as PaletteGroup
            return (
              <div key={group.groupId} className="border border-gray-200 dark:border-dark-border rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.groupId)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-dark-card"
                >
                  <span className="font-medium text-sm">{group.label} <span className="text-xs text-gray-400">{group.entries.length}</span></span>
                  {isExpanded(group.groupId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {isExpanded(group.groupId) && (
                  <div className="p-2 pt-0 border-t">
                    <ModuleList entries={group.entries} selectedModule={selectedModule} onSelect={(m) => onModuleSelect(selectedModule?.module === m.module ? null : m)} />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
