import type { WireConnection } from '../modules/types'
import type { GridCell } from '../systems/ElectricalSystem'
import {
  createSchematicGroupBox,
  GROUP_BOX_COLOR_PRESETS,
  type SchematicGroupBox,
} from '../types/workspace'

export interface ContentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const CUSTOM_GROUP_BOX_COLORS: Record<string, { fill: string; border: string }> = {
  Violet: { fill: 'rgba(237, 233, 254, 0.55)', border: '#A855F7' },
  Cyan: { fill: 'rgba(207, 250, 254, 0.55)', border: '#22D3EE' },
  Sky: { fill: 'rgba(224, 242, 254, 0.55)', border: '#38BDF8' },
}

export function resolveGroupBoxColor(name: string) {
  const preset = GROUP_BOX_COLOR_PRESETS.find((p) => p.name === name)
  if (preset) return preset
  return CUSTOM_GROUP_BOX_COLORS[name] ?? GROUP_BOX_COLOR_PRESETS[0]
}

/** Axis-aligned bounds of occupied cells and wire endpoints. */
export function computeContentBounds(
  gridData: GridCell[][],
  wires: WireConnection[] = []
): ContentBounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let found = false

  const include = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    found = true
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  for (let y = 0; y < gridData.length; y++) {
    const row = gridData[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (!cell?.occupied) continue
      include(x, y)
    }
  }

  for (const wire of wires) {
    for (const segment of wire.segments) {
      include(segment.from.x, segment.from.y)
      include(segment.to.x, segment.to.y)
    }
  }

  if (!found) return null
  return { minX, minY, maxX, maxY }
}

export function boundsCenterCell(bounds: ContentBounds): { x: number; y: number } {
  return {
    x: (bounds.minX + bounds.maxX + 1) / 2,
    y: (bounds.minY + bounds.maxY + 1) / 2,
  }
}

export function boundsSpanCells(bounds: ContentBounds): { width: number; height: number } {
  return {
    width: bounds.maxX - bounds.minX + 1,
    height: bounds.maxY - bounds.minY + 1,
  }
}

export function contentBoundsToGroupBox(
  bounds: ContentBounds,
  title: string,
  colorName = 'Indigo',
  padding = 1
): SchematicGroupBox {
  const color = resolveGroupBoxColor(colorName)
  return createSchematicGroupBox(
    bounds.minX - padding,
    bounds.minY - padding,
    bounds.maxX - bounds.minX + 1 + padding * 2,
    bounds.maxY - bounds.minY + 1 + padding * 2,
    title,
    color
  )
}
