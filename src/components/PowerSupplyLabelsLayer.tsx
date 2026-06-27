import { useMemo } from 'react'
import { listPlacedPowerSupplies } from '../utils/powerSupplies'
import type { GridCell } from '../systems/ElectricalSystem'

const CELL_VW = 2.5

export function PowerSupplyLabelsLayer({ gridData }: { gridData: GridCell[][] }) {
  const supplies = useMemo(
    () => listPlacedPowerSupplies(gridData).filter((s) => s.module === 'PowerSupply'),
    [gridData]
  )

  if (supplies.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[12]">
      {supplies.map((supply) => (
        <div
          key={supply.componentId}
          className="absolute flex justify-center"
          style={{
            left: `${supply.position.x * CELL_VW}vw`,
            top: `${supply.position.y * CELL_VW}vw`,
            width: `${supply.gridWidth * CELL_VW}vw`,
            transform: 'translateY(-2px)',
          }}
        >
          <span className="whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300 shadow-sm ring-1 ring-amber-400/35 -translate-y-full">
            {supply.supplyId}
          </span>
        </div>
      ))}
    </div>
  )
}
