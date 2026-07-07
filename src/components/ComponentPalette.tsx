import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Eraser, Search, Settings, X } from 'lucide-react'
import { getAllModulesWithTypes } from '../modules/registry'
import {
  countPaletteGroupEntries,
  groupEntriesForPalette,
  moduleMatchesSearch,
  type PaletteGroup,
} from '../modules/componentCatalog'
import { KicadSymbol } from './KicadSymbol'
import { ModuleDefinition } from '../modules/types'
import type { ModuleRegistryEntry } from '../modules/registry'
import { isNPinConnectorModule } from '../modules/connectors/buildConnectorDefinition'

interface ComponentPaletteProps {
  selectedModule: ModuleDefinition | null
  onModuleSelect: (module: ModuleDefinition | null) => void
  deleteMode?: boolean
  onToggleDeleteMode?: () => void
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
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
        <div className="flex min-h-[3.5rem] items-stretch gap-2 p-2">
          <KicadSymbol moduleName={module.module} logicModule={module.logicModule} />
          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            <div className="flex items-start justify-between gap-1">
              <h3 className="truncate text-xs font-medium text-gray-900 dark:text-dark-text-primary">
                {module.module}
              </h3>
              {entry.type || isNPinConnectorModule(module) ? (
                <div title="Configurable component">
                  <Settings className="h-3 w-3 shrink-0 text-blue-500" />
                </div>
              ) : null}
            </div>
            <p className="line-clamp-2 text-[11px] leading-snug text-gray-400 dark:text-dark-text-muted">
              {module.description || 'No description'}
            </p>
          </div>
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
  if (entries.length === 0) return null

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

function PaletteGroupSection({
  group,
  depth,
  selectedModule,
  onModuleSelect,
  isExpanded,
  toggleGroup,
}: {
  group: PaletteGroup
  depth: number
  selectedModule: ModuleDefinition | null
  onModuleSelect: (module: ModuleDefinition | null) => void
  isExpanded: (id: string) => boolean
  toggleGroup: (id: string) => void
}) {
  const open = isExpanded(group.groupId)
  const count = countPaletteGroupEntries(group)
  const hasSubs = (group.subgroups?.length ?? 0) > 0
  const hasContent = group.entries.length > 0 || hasSubs

  if (!hasContent) return null

  const isTopLevel = depth === 0
  const paddingLeft = depth > 0 ? `${depth * 0.5 + 0.25}rem` : undefined

  const handleSelect = (m: ModuleDefinition) => {
    onModuleSelect(selectedModule?.module === m.module ? null : m)
  }

  return (
    <div
      className={
        isTopLevel
          ? 'border border-gray-200 dark:border-dark-border rounded-lg'
          : 'border border-gray-100 dark:border-dark-border rounded-md'
      }
    >
      <button
        type="button"
        onClick={() => toggleGroup(group.groupId)}
        className={`w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-card ${
          isTopLevel ? 'p-3' : 'px-2 py-2 text-sm'
        }`}
        style={paddingLeft ? { paddingLeft } : undefined}
      >
        <span className={isTopLevel ? 'font-medium text-sm' : 'pl-1'}>
          {group.label}{' '}
          <span className="text-xs text-gray-400">{count}</span>
        </span>
        {open ? (
          <ChevronDown className={isTopLevel ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        ) : (
          <ChevronRight className={isTopLevel ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        )}
      </button>
      {open && (
        <div className={`${isTopLevel ? 'border-t p-2' : 'p-2 pt-0'} space-y-2`}>
          <ModuleList
            entries={group.entries}
            selectedModule={selectedModule}
            onSelect={handleSelect}
          />
          {group.subgroups?.map((sub) => (
            <PaletteGroupSection
              key={sub.groupId}
              group={sub}
              depth={depth + 1}
              selectedModule={selectedModule}
              onModuleSelect={onModuleSelect}
              isExpanded={isExpanded}
              toggleGroup={toggleGroup}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ComponentPalette({
  selectedModule,
  onModuleSelect,
  deleteMode = false,
  onToggleDeleteMode,
}: ComponentPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () =>
      new Set([
        'microcontrollers',
        'power',
        'passives',
        'semiconductors',
        'output',
        'output.light',
        'output.electromechanical',
        'organization',
      ])
  )

  const paletteStructure = useMemo(() => {
    const matching = getAllModulesWithTypes().filter((e) => moduleMatchesSearch(e, searchQuery))
    return groupEntriesForPalette(matching)
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
    <div className="flex h-full min-h-0 w-full flex-col bg-white dark:bg-carbon-card">
      <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.06] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">Components</h2>
            <p className="text-sm text-gray-500 dark:text-dark-text-muted">Click to select, then place on grid</p>
          </div>
          {onToggleDeleteMode && (
            <button
              type="button"
              onClick={onToggleDeleteMode}
              className={`shrink-0 rounded-lg px-2.5 py-2 text-sm shadow-sm transition-colors flex items-center gap-1.5 ${
                deleteMode
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
              }`}
              title={deleteMode ? 'Exit delete mode' : 'Enter delete mode'}
            >
              <Eraser className="h-4 w-4" />
              <span className="hidden sm:inline">{deleteMode ? 'Exit' : 'Delete'}</span>
            </button>
          )}
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
          paletteStructure.map((group) => (
            <PaletteGroupSection
              key={group.groupId}
              group={group}
              depth={0}
              selectedModule={selectedModule}
              onModuleSelect={onModuleSelect}
              isExpanded={isExpanded}
              toggleGroup={toggleGroup}
            />
          ))
        )}
      </div>
    </div>
  )
}
