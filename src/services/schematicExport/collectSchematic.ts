import { listComponents } from '../../agent/schematic/operations'
import type { Schematic } from '../../types/workspace'
import type { SchematicExportComponent } from './api'

export function collectSchematicExportComponents(
  schematic: Schematic | null | undefined
): SchematicExportComponent[] {
  if (!schematic) return []
  return listComponents(schematic).map((component) => ({
    id: component.id,
    moduleName: component.moduleName,
    origin: component.origin,
    size: component.size,
    pins: component.pins.map((pin) => ({
      name: pin.name,
      x: pin.x,
      y: pin.y,
    })),
  }))
}

export function collectSchematicWires(schematic: Schematic | null | undefined) {
  if (!schematic) return []
  return schematic.wires.map((wire) => ({
    id: wire.id,
    segments: wire.segments.map((seg) => ({ x: seg.x, y: seg.y })),
    color: wire.color,
  }))
}
