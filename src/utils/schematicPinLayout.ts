import type { ModuleDefinition, ModuleGridCell } from '../modules/types'
import { resolveLogicModule } from '../modules/logicModule'
import { primaryPinName } from './pinNames'

export type PinEdge = 'left' | 'right' | 'top' | 'bottom'

export interface SchematicPinLayout {
  edge: PinEdge
  label: string
}

export function getModuleGridCell(
  definition: ModuleDefinition,
  relativeX: number,
  relativeY: number
): ModuleGridCell | undefined {
  const byPosition = definition.grid?.find((cell) => cell.x === relativeX && cell.y === relativeY)
  if (byPosition) return byPosition

  const index = relativeY * definition.gridX + relativeX
  return definition.grid?.[index]
}

export function resolveSchematicPinLabel(
  definition: ModuleDefinition,
  cell: ModuleGridCell
): string {
  const moduleName = resolveLogicModule(definition) ?? definition.module
  const props = cell.properties as Record<string, string> | undefined

  if (cell.pin?.trim()) return cell.pin.trim()
  if (props?.gpio) return props.gpio
  if (props?.alias) return props.alias
  if (props?.voltage) return props.voltage

  const primary = primaryPinName(cell, moduleName, definition.gridX).trim()
  if (primary) return primary

  return `P${cell.x}${cell.y}`
}

export function getSchematicPinLayout(
  definition: ModuleDefinition,
  relativeX: number,
  relativeY: number
): SchematicPinLayout | null {
  const cell = getModuleGridCell(definition, relativeX, relativeY)
  if (!cell?.isConnectable) return null

  return {
    edge: resolvePinEdge(definition, relativeX, relativeY),
    label: resolveSchematicPinLabel(definition, cell),
  }
}

export function resolvePinEdge(
  definition: ModuleDefinition,
  relativeX: number,
  relativeY: number
): PinEdge {
  const gridX = definition.gridX
  const gridY = definition.gridY

  if (relativeX === 0) return 'left'
  if (relativeX === gridX - 1) return 'right'
  if (relativeY === 0) return 'top'
  if (relativeY === gridY - 1) return 'bottom'

  const distLeft = relativeX
  const distRight = gridX - 1 - relativeX
  const distTop = relativeY
  const distBottom = gridY - 1 - relativeY
  const min = Math.min(distLeft, distRight, distTop, distBottom)

  if (min === distLeft) return 'left'
  if (min === distRight) return 'right'
  if (min === distTop) return 'top'
  return 'bottom'
}

export interface ExteriorBorderStyle {
  borderTop: string
  borderRight: string
  borderBottom: string
  borderLeft: string
  borderTopLeftRadius: string
  borderTopRightRadius: string
  borderBottomRightRadius: string
  borderBottomLeftRadius: string
}

export function getExteriorBorderStyle(
  definition: ModuleDefinition,
  relativeX: number,
  relativeY: number,
  borderColor: string,
  borderWidth = 2,
  cornerRadius = 5
): ExteriorBorderStyle {
  const gridX = definition.gridX
  const gridY = definition.gridY
  const border = `${borderWidth}px solid ${borderColor}`
  const none = 'none'

  const isLeft = relativeX === 0
  const isRight = relativeX === gridX - 1
  const isTop = relativeY === 0
  const isBottom = relativeY === gridY - 1

  return {
    borderLeft: isLeft ? border : none,
    borderRight: isRight ? border : none,
    borderTop: isTop ? border : none,
    borderBottom: isBottom ? border : none,
    borderTopLeftRadius: isLeft && isTop ? `${cornerRadius}px` : '0',
    borderTopRightRadius: isRight && isTop ? `${cornerRadius}px` : '0',
    borderBottomRightRadius: isRight && isBottom ? `${cornerRadius}px` : '0',
    borderBottomLeftRadius: isLeft && isBottom ? `${cornerRadius}px` : '0',
  }
}
