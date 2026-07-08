import { listComponents } from '../../agent/schematic/operations'
import { planTidyLayout, applyTidyLayout } from '../../utils/schematicTidyLayout'
import type { Schematic } from '../../types/workspace'
import type { SchematicExportComponent, SchematicExportWire } from './api'

/**
 * Produce a compact, signal-flow layout for export WITHOUT touching the real
 * schematic. `applyTidyLayout` reconstructs a fresh gridData + remapped wires,
 * so the on-canvas layout is unchanged while the export gets tidy relative
 * coordinates (power → passives → ICs → outputs, left to right).
 */
function tidyForExport(schematic: Schematic): Schematic {
  const plan = planTidyLayout(schematic)
  return plan.hasChanges ? applyTidyLayout(schematic, plan) : schematic
}

export interface SchematicExportPayload {
  components: SchematicExportComponent[]
  wires: SchematicExportWire[]
}

export function collectSchematicExport(
  schematic: Schematic | null | undefined
): SchematicExportPayload {
  if (!schematic) return { components: [], wires: [] }
  const tidied = tidyForExport(schematic)

  const components: SchematicExportComponent[] = listComponents(tidied).map((component) => ({
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

  const wires: SchematicExportWire[] = (tidied.wires ?? []).map((wire) => ({
    id: wire.id,
    segments: wire.segments.map((seg) => ({
      x: seg.from.x,
      y: seg.from.y,
      toX: seg.to.x,
      toY: seg.to.y,
    })),
    color: wire.color,
  }))

  return { components, wires }
}
