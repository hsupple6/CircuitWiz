import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { listPlacedPowerSupplies, type PlacedPowerSupply } from '../utils/powerSupplies'
import type { GridCell } from '../systems/ElectricalSystem'

interface PowerPanelProps {
  gridData: GridCell[][]
  embedded?: boolean
  onUpdatePowerSupply: (
    componentId: string,
    patch: { voltage: number; current: number }
  ) => void
}

function formatModuleLabel(module: PlacedPowerSupply['module']): string {
  return module === 'Battery' ? 'Battery' : 'Power Supply'
}

export function PowerPanel({
  gridData,
  embedded = false,
  onUpdatePowerSupply,
}: PowerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [voltageInput, setVoltageInput] = useState('5')
  const [currentInput, setCurrentInput] = useState('1')

  const supplies = useMemo(
    () => listPlacedPowerSupplies(gridData).filter((s) => s.module === 'PowerSupply'),
    [gridData]
  )

  useEffect(() => {
    if (supplies.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !supplies.some((s) => s.componentId === selectedId)) {
      setSelectedId(supplies[0].componentId)
    }
  }, [supplies, selectedId])

  const selected = supplies.find((s) => s.componentId === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    setVoltageInput(String(selected.voltage))
    setCurrentInput(String(selected.current))
  }, [selected?.componentId, selected?.voltage, selected?.current])

  const applyChanges = () => {
    if (!selected) return
    const voltage = parseFloat(voltageInput)
    const current = parseFloat(currentInput)
    if (!Number.isFinite(voltage) || !Number.isFinite(current)) return
    if (current < 0) return
    onUpdatePowerSupply(selected.componentId, { voltage, current })
  }

  const handleHeaderToggle = () => setIsExpanded((prev) => !prev)

  return (
    <aside
      className={`power-panel flex w-full flex-col ${embedded ? 'shrink-0' : ''}`}
      aria-label="Power supplies"
    >
      <div className="carbon-card flex flex-col overflow-hidden border-primary-400/15 shadow-xl shadow-black/40 dark:bg-dark-card">
        <div
          role="button"
          tabIndex={0}
          onClick={handleHeaderToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleHeaderToggle()
            }
          }}
          className="flex w-full shrink-0 cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
          aria-expanded={isExpanded}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">Power</h2>
            <p className="truncate text-xs text-zinc-500">
              {supplies.length === 0
                ? 'No power sources placed'
                : `${supplies.length} source${supplies.length === 1 ? '' : 's'} on schematic`}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
        </div>

        {isExpanded && (
          <div className="border-t border-white/[0.06] px-4 py-3 space-y-3 max-h-[min(36vh,280px)] overflow-y-auto">
            {supplies.length === 0 ? (
              <p className="text-xs leading-relaxed text-zinc-500">
                Place a Power Supply from the palette to configure voltage and current here.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">
                    Power source
                  </label>
                  <select
                    value={selectedId ?? ''}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/40"
                  >
                    {supplies.map((supply) => (
                      <option key={supply.componentId} value={supply.componentId}>
                        {supply.supplyId} · {formatModuleLabel(supply.module)} · {supply.voltage}V
                      </option>
                    ))}
                  </select>
                </div>

                {selected && (
                  <>
                    <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-center">
                      <div className="text-lg font-semibold tracking-wide text-amber-300">
                        {selected.supplyId}
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">
                        ({selected.position.x}, {selected.position.y})
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-400">
                          Voltage (V)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={voltageInput}
                          onChange={(e) => setVoltageInput(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/40"
                        />
                        <p className="mt-1 text-[10px] text-zinc-600">Negative values allowed</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-400">
                          Max current (A)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/40"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={applyChanges}
                      className="w-full rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400"
                    >
                      Apply to {selected.supplyId}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
