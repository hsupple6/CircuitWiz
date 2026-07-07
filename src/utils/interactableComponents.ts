import { resolveLogicModule } from '../modules/logicModule'

export type InteractableKind =
  | 'potentiometer'
  | 'switch'
  | 'pushButton'
  | 'limitSwitch'

export interface InteractableControl {
  componentId: string
  label: string
  kind: InteractableKind
  bodyCellIndex: number
  originX: number
  originY: number
  wiperPosition?: number
  isOn?: boolean
}

type GridRow = Array<{
  occupied?: boolean
  componentId?: string
  cellIndex?: number
  moduleDefinition?: {
    module?: string
    logicModule?: string
    grid?: Array<{ x: number; y: number; isClickable?: boolean }>
    properties?: Record<string, unknown>
  }
  isClickable?: boolean
  isOn?: boolean
  wiperPosition?: number
  x?: number
  y?: number
} | null | undefined>

function numProp(props: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const raw = props?.[key]
  if (raw && typeof raw === 'object' && 'default' in raw) {
    return Number((raw as { default: number }).default) || fallback
  }
  if (typeof raw === 'number') return raw
  return fallback
}

function findModuleOrigin(
  gridData: GridRow[],
  componentId: string
): { x: number; y: number } | null {
  let minX = Infinity
  let minY = Infinity
  let found = false
  for (let y = 0; y < gridData.length; y++) {
    const row = gridData[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (cell?.componentId !== componentId) continue
      found = true
      const cx = cell.x ?? x
      const cy = cell.y ?? y
      if (cy < minY || (cy === minY && cx < minX)) {
        minX = cx
        minY = cy
      }
    }
  }
  return found ? { x: minX, y: minY } : null
}

export function scanInteractableComponents(gridData: GridRow[]): InteractableControl[] {
  const seen = new Set<string>()
  const controls: InteractableControl[] = []

  gridData.forEach((row, y) => {
    row?.forEach((cell, x) => {
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) return
      if (seen.has(cell.componentId)) return

      const logic = resolveLogicModule({
        module: cell.moduleDefinition.module ?? '',
        logicModule: cell.moduleDefinition.logicModule,
      })
      let kind: InteractableKind | null = null

      switch (logic) {
        case 'Potentiometer':
          kind = 'potentiometer'
          break
        case 'Switch':
          kind = 'switch'
          break
        case 'Push Button':
          kind = 'pushButton'
          break
        case 'Limit Switch':
          kind = 'limitSwitch'
          break
        default:
          return
      }

      seen.add(cell.componentId)
      const origin = findModuleOrigin(gridData, cell.componentId) ?? { x, y }
      const grid = cell.moduleDefinition.grid ?? []
      const clickableIdx = grid.findIndex((c) => c.isClickable)
      const bodyIdx = clickableIdx >= 0 ? clickableIdx : 0
      const bodyCell = gridData
        .flat()
        .find((c) => c != null && c.componentId === cell.componentId && c.cellIndex === bodyIdx)

      const props = cell.moduleDefinition.properties as Record<string, unknown> | undefined
      const label = cell.moduleDefinition.module ?? logic

      const control: InteractableControl = {
        componentId: cell.componentId,
        label,
        kind,
        bodyCellIndex: bodyIdx,
        originX: origin.x,
        originY: origin.y,
      }

      if (kind === 'potentiometer') {
        control.wiperPosition = bodyCell?.wiperPosition ?? numProp(props, 'wiperPosition', 0.5)
      } else {
        control.isOn = Boolean(bodyCell?.isOn)
      }

      controls.push(control)
    })
  })

  return controls.sort((a, b) => a.label.localeCompare(b.label))
}

export function patchInteractableCell(
  gridData: GridRow[],
  componentId: string,
  bodyCellIndex: number,
  patch: Record<string, unknown>
): GridRow[] {
  const origin = findModuleOrigin(gridData, componentId)
  if (!origin) return gridData as GridRow[]

  const moduleDef = gridData.flat().find((c) => c?.componentId === componentId)?.moduleDefinition
  const grid = moduleDef?.grid ?? []
  const moduleCell = grid[bodyCellIndex]
  if (!moduleCell) return gridData as GridRow[]

  const absX = origin.x + moduleCell.x
  const absY = origin.y + moduleCell.y

  const newGrid = gridData.map((row) => (row ? [...row] : row))
  const targetRow = newGrid[absY]
  if (!targetRow?.[absX]) return gridData as GridRow[]

  targetRow[absX] = { ...targetRow[absX]!, ...patch }
  return newGrid as GridRow[]
}
