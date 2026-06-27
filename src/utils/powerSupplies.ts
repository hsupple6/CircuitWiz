import type { ModuleDefinition } from '../modules/types'

export interface PlacedPowerSupply {
  componentId: string
  supplyId: string
  module: 'PowerSupply' | 'Battery'
  voltage: number
  current: number
  position: { x: number; y: number }
  gridWidth: number
}

type GridCellLike = {
  occupied?: boolean
  componentId?: string
  cellIndex?: number
  moduleDefinition?: ModuleDefinition & { properties?: Record<string, unknown> }
}

function isPositiveTerminal(type?: string): boolean {
  return type === 'VCC' || type === 'POSITIVE'
}

function readNumeric(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return fallback
}

function positiveTerminalCell(def: ModuleDefinition) {
  return def.grid.find((moduleCell) => isPositiveTerminal(moduleCell.type))
}

export function readSupplyVoltageAndCurrent(
  def: ModuleDefinition & { properties?: Record<string, unknown> }
): { voltage: number; current: number } {
  const props = def.properties
  const terminal = positiveTerminalCell(def)
  const voltage = readNumeric(
    props?.voltage ?? terminal?.voltage,
    readNumeric(terminal?.voltage, 5)
  )
  const current = readNumeric(
    props?.current ?? terminal?.current,
    readNumeric(terminal?.current, 1)
  )
  return { voltage, current }
}

function readSupplyId(
  componentId: string,
  properties: Record<string, unknown> | undefined
): string {
  const fromProps = properties?.supplyId
  if (typeof fromProps === 'string' && fromProps.trim()) return fromProps
  return componentId
}

export function getDisplaySupplyId(
  componentId: string,
  properties: Record<string, unknown> | undefined
): string {
  return readSupplyId(componentId, properties)
}

/** Assign PSU-1, PSU-2, … to any Power Supply missing a supplyId. */
export function ensurePowerSupplyIdsInGrid<T extends GridCellLike>(gridData: T[][]): T[][] {
  let nextIndex = 1
  const used = new Set<string>()

  for (const row of gridData) {
    if (!row) continue
    for (const cell of row) {
      if (!cell?.occupied || !cell.moduleDefinition) continue
      if (cell.moduleDefinition.module !== 'PowerSupply') continue
      const existing = cell.moduleDefinition.properties?.supplyId
      if (typeof existing === 'string' && existing.trim()) {
        used.add(existing)
        const match = /^PSU-(\d+)$/i.exec(existing)
        if (match) nextIndex = Math.max(nextIndex, parseInt(match[1], 10) + 1)
      }
    }
  }

  const assigned = new Map<string, string>()
  let changed = false

  const next = gridData.map((row) =>
    row?.map((cell) => {
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) return cell
      if (cell.moduleDefinition.module !== 'PowerSupply') return cell

      const props = cell.moduleDefinition.properties
      const existing = props?.supplyId
      if (typeof existing === 'string' && existing.trim()) return cell

      let supplyId = assigned.get(cell.componentId)
      if (!supplyId) {
        while (used.has(`PSU-${nextIndex}`)) nextIndex++
        supplyId = `PSU-${nextIndex}`
        used.add(supplyId)
        nextIndex++
        assigned.set(cell.componentId, supplyId)
      }

      changed = true
      return {
        ...cell,
        moduleDefinition: {
          ...cell.moduleDefinition,
          properties: { ...props, supplyId },
        },
      }
    }) ?? row
  )

  return changed ? next : gridData
}

export function nextPowerSupplyId(gridData: GridCellLike[][]): string {
  let max = 0
  for (const row of gridData) {
    if (!row) continue
    for (const cell of row) {
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) continue
      const mod = cell.moduleDefinition.module
      if (mod !== 'PowerSupply' && mod !== 'Battery') continue
      const supplyId = readSupplyId(cell.componentId, cell.moduleDefinition.properties)
      const match = /^PSU-(\d+)$/i.exec(supplyId)
      if (match) max = Math.max(max, parseInt(match[1], 10))
    }
  }
  return `PSU-${max + 1}`
}

export function listPlacedPowerSupplies(gridData: GridCellLike[][]): PlacedPowerSupply[] {
  const byComponent = new Map<string, PlacedPowerSupply>()

  for (let y = 0; y < gridData.length; y++) {
    const row = gridData[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) continue

      const mod = cell.moduleDefinition.module
      if (mod !== 'PowerSupply' && mod !== 'Battery') continue
      if (byComponent.has(cell.componentId)) {
        const existing = byComponent.get(cell.componentId)!
        existing.position.x = Math.min(existing.position.x, x)
        existing.position.y = Math.min(existing.position.y, y)
        continue
      }

      const { voltage, current } = readSupplyVoltageAndCurrent(cell.moduleDefinition)
      const props = cell.moduleDefinition.properties

      byComponent.set(cell.componentId, {
        componentId: cell.componentId,
        supplyId: readSupplyId(cell.componentId, props),
        module: mod,
        voltage,
        current,
        position: { x, y },
        gridWidth: cell.moduleDefinition.gridX ?? 2,
      })
    }
  }

  return Array.from(byComponent.values()).sort((a, b) =>
    a.supplyId.localeCompare(b.supplyId, undefined, { numeric: true })
  )
}

export function updatePowerSupplyInGrid<T extends GridCellLike>(
  gridData: T[][],
  componentId: string,
  patch: { voltage: number; current: number }
): T[][] {
  return gridData.map((row) =>
    row?.map((cell) => {
      if (!cell?.occupied || cell.componentId !== componentId || !cell.moduleDefinition) return cell

      const def = cell.moduleDefinition
      const mod = def.module
      if (mod !== 'PowerSupply' && mod !== 'Battery') return cell

      const nextGrid = def.grid.map((moduleCell) => {
        if (!isPositiveTerminal(moduleCell.type)) return moduleCell
        return {
          ...moduleCell,
          voltage: patch.voltage,
          current: patch.current,
          isPowered: Math.abs(patch.voltage) > 1e-6,
        }
      })

      const nextDef: ModuleDefinition & { properties?: Record<string, unknown> } = {
        ...def,
        grid: nextGrid,
        properties: {
          ...def.properties,
          voltage: patch.voltage,
          current: patch.current,
        },
      }

      return {
        ...cell,
        moduleDefinition: nextDef,
        ...(isPositiveTerminal(def.grid[cell.cellIndex ?? 0]?.type)
          ? { isPowered: Math.abs(patch.voltage) > 1e-6 }
          : {}),
      }
    }) ?? row
  )
}

export function assignPowerSupplyIdToDefinition(
  module: ModuleDefinition,
  supplyId: string,
  voltage = 5,
  current = 1
): ModuleDefinition {
  const props = (module as ModuleDefinition & { properties?: Record<string, unknown> }).properties
  const nextGrid = module.grid.map((moduleCell) => {
    if (!isPositiveTerminal(moduleCell.type)) return moduleCell
    return {
      ...moduleCell,
      voltage,
      current,
      isPowered: Math.abs(voltage) > 1e-6,
    }
  })

  return {
    ...module,
    grid: nextGrid,
    properties: {
      ...props,
      supplyId,
      voltage,
      current,
    },
  } as ModuleDefinition
}

/** Power source terminal with non-zero voltage (includes negative). */
export function isActivePowerSourceTerminal(
  moduleType: string | undefined,
  moduleCell: { isPowerable?: boolean; voltage?: number; type?: string } | undefined
): boolean {
  if (!moduleCell?.isPowerable) return false
  if (moduleType !== 'PowerSupply' && moduleType !== 'Battery') return false
  if (!isPositiveTerminal(moduleCell.type)) return false
  return Math.abs(moduleCell.voltage ?? 0) > 1e-6
}
