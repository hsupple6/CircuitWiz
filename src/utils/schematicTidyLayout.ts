import { listComponents, type ComponentSummary } from '../agent/schematic/operations'
import { SCHEMATIC_LAYOUT_GUIDELINES } from '../agent/schematic/layoutGuidelines'
import type { WireConnection, WireSegment } from '../modules/types'
import type { Schematic } from '../types/workspace'
import {
  extractOccupiedComponents,
  getGridSize,
  reconstructGridData,
  type OccupiedComponent,
} from './gridUtils'
import { buildWirePath } from './wireRouting'
import { ensurePowerSupplyIdsInGrid } from './powerSupplies'

export interface TidyLayoutNode {
  id: string
  moduleName: string
  category: string
  currentOrigin: { x: number; y: number }
  proposedOrigin: { x: number; y: number }
  size: { gridX: number; gridY: number }
  layer: number
}

export interface TidyLayoutPlan {
  nodes: TidyLayoutNode[]
  summary: string
  /** True when at least one component would move. */
  hasChanges: boolean
}

const CATEGORY_RANK: Record<string, number> = {
  power: 0,
  passives: 1,
  semiconductors: 2,
  ics: 3,
  drivers: 4,
  switches: 5,
  sensors: 6,
  microcontrollers: 7,
  wireless: 8,
  connectors: 9,
  output: 10,
}

const POWER_SOURCE_NAMES = new Set([
  'PowerSupply',
  'LiIonPack',
  'ACSource',
  'ChargerProtection',
  'UsbPdDecoy',
])

function isPowerSource(component: ComponentSummary): boolean {
  return component.category === 'power' || POWER_SOURCE_NAMES.has(component.moduleName)
}

function componentOrigin(cells: OccupiedComponent[]): { x: number; y: number } {
  let minX = Infinity
  let minY = Infinity
  for (const cell of cells) {
    const relX = cell.moduleDefinition?.grid?.[cell.cellIndex ?? 0]?.x ?? 0
    const relY = cell.moduleDefinition?.grid?.[cell.cellIndex ?? 0]?.y ?? 0
    minX = Math.min(minX, cell.x - relX)
    minY = Math.min(minY, cell.y - relY)
  }
  return { x: minX, y: minY }
}

function buildAdjacency(
  components: ComponentSummary[],
  wires: WireConnection[],
  occupied: OccupiedComponent[]
): Map<string, Set<string>> {
  const cellToComponent = new Map<string, string>()
  for (const cell of occupied) {
    cellToComponent.set(`${cell.x},${cell.y}`, cell.componentId)
  }

  const adj = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (a === b) return
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }

  for (const component of components) {
    if (!adj.has(component.id)) adj.set(component.id, new Set())
  }

  for (const wire of wires) {
    const touched = new Set<string>()
    for (const segment of wire.segments) {
      const fromId = cellToComponent.get(`${segment.from.x},${segment.from.y}`)
      const toId = cellToComponent.get(`${segment.to.x},${segment.to.y}`)
      if (fromId) touched.add(fromId)
      if (toId) touched.add(toId)
    }
    const ids = [...touched]
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        link(ids[i], ids[j])
      }
    }
  }

  return adj
}

function assignLayers(components: ComponentSummary[], adj: Map<string, Set<string>>): Map<string, number> {
  const layers = new Map<string, number>()
  const sources = components.filter(isPowerSource)

  if (sources.length === 0 && components.length > 0) {
    const sorted = [...components].sort(
      (a, b) => a.origin.x - b.origin.x || a.origin.y - b.origin.y || a.moduleName.localeCompare(b.moduleName)
    )
    let column = 0
    let rowInColumn = 0
    for (const component of sorted) {
      layers.set(component.id, column)
      rowInColumn++
      if (rowInColumn >= 3) {
        rowInColumn = 0
        column++
      }
    }
    return layers
  }

  const queue: Array<{ id: string; layer: number }> = sources.map((c) => ({ id: c.id, layer: 0 }))
  const bestLayer = new Map<string, number>()

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!
    const prev = bestLayer.get(id)
    if (prev !== undefined && prev <= layer) continue
    bestLayer.set(id, layer)

    for (const neighbor of adj.get(id) ?? []) {
      queue.push({ id: neighbor, layer: layer + 1 })
    }
  }

  let maxLayer = 0
  for (const layer of bestLayer.values()) maxLayer = Math.max(maxLayer, layer)

  for (const component of components) {
    layers.set(component.id, bestLayer.get(component.id) ?? maxLayer + 1)
  }

  return layers
}

function sortWithinLayer(a: ComponentSummary, b: ComponentSummary): number {
  const rankA = CATEGORY_RANK[a.category] ?? 50
  const rankB = CATEGORY_RANK[b.category] ?? 50
  if (rankA !== rankB) return rankA - rankB
  return a.moduleName.localeCompare(b.moduleName) || a.id.localeCompare(b.id)
}

function proposeOrigins(components: ComponentSummary[], layers: Map<string, number>): Map<string, { x: number; y: number }> {
  const { placementOrigin, minGapCells } = SCHEMATIC_LAYOUT_GUIDELINES
  const columnGap = minGapCells + 2
  const byLayer = new Map<number, ComponentSummary[]>()

  for (const component of components) {
    const layer = layers.get(component.id) ?? 0
    if (!byLayer.has(layer)) byLayer.set(layer, [])
    byLayer.get(layer)!.push(component)
  }

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b)
  const proposed = new Map<string, { x: number; y: number }>()
  let currentX = placementOrigin.x

  for (const layer of sortedLayers) {
    const column = [...byLayer.get(layer)!].sort(sortWithinLayer)
    let currentY = placementOrigin.y
    let maxWidth = 0

    for (const component of column) {
      proposed.set(component.id, { x: currentX, y: currentY })
      currentY += component.size.gridY + minGapCells
      maxWidth = Math.max(maxWidth, component.size.gridX)
    }

    currentX += maxWidth + columnGap
  }

  return proposed
}

function normalizeOrigins(
  components: ComponentSummary[],
  proposed: Map<string, { x: number; y: number }>
): Map<string, { x: number; y: number }> {
  const { placementOrigin } = SCHEMATIC_LAYOUT_GUIDELINES
  if (proposed.size === 0) return proposed

  let minX = Infinity
  let minY = Infinity
  for (const origin of proposed.values()) {
    minX = Math.min(minX, origin.x)
    minY = Math.min(minY, origin.y)
  }

  const shiftX = placementOrigin.x - minX
  const shiftY = placementOrigin.y - minY
  if (shiftX === 0 && shiftY === 0) return proposed

  const normalized = new Map<string, { x: number; y: number }>()
  for (const component of components) {
    const origin = proposed.get(component.id)
    if (!origin) continue
    normalized.set(component.id, { x: origin.x + shiftX, y: origin.y + shiftY })
  }
  return normalized
}

export function planTidyLayout(schematic: Schematic): TidyLayoutPlan {
  const components = listComponents(schematic)
  if (components.length === 0) {
    return {
      nodes: [],
      summary: 'No components on this schematic.',
      hasChanges: false,
    }
  }

  const occupied = extractOccupiedComponents(schematic.gridData)
  const adj = buildAdjacency(components, schematic.wires ?? [], occupied)
  const layers = assignLayers(components, adj)
  const proposed = normalizeOrigins(components, proposeOrigins(components, layers))

  const nodes: TidyLayoutNode[] = components.map((component) => {
    const next = proposed.get(component.id) ?? component.origin
    return {
      id: component.id,
      moduleName: component.moduleName,
      category: component.category,
      currentOrigin: { ...component.origin },
      proposedOrigin: { ...next },
      size: { ...component.size },
      layer: layers.get(component.id) ?? 0,
    }
  })

  const hasChanges = nodes.some(
    (node) =>
      node.currentOrigin.x !== node.proposedOrigin.x || node.currentOrigin.y !== node.proposedOrigin.y
  )

  const layerCount = new Set(nodes.map((n) => n.layer)).size
  const summary = hasChanges
    ? `Arrange ${nodes.length} parts into ${layerCount} signal-flow column${layerCount === 1 ? '' : 's'} (power → passives → ICs → outputs), left to right with tidy spacing. Wires will be re-routed.`
    : 'Layout already matches the tidy placement rules — nothing to move.'

  return { nodes, summary, hasChanges }
}

function buildRelocationMap(
  occupied: OccupiedComponent[],
  proposed: Map<string, { x: number; y: number }>
): Map<string, { x: number; y: number }> {
  const byComponent = new Map<string, OccupiedComponent[]>()
  for (const cell of occupied) {
    if (!byComponent.has(cell.componentId)) byComponent.set(cell.componentId, [])
    byComponent.get(cell.componentId)!.push(cell)
  }

  const relocation = new Map<string, { x: number; y: number }>()
  for (const [componentId, cells] of byComponent) {
    const target = proposed.get(componentId)
    if (!target) continue
    const oldOrigin = componentOrigin(cells)
    const dx = target.x - oldOrigin.x
    const dy = target.y - oldOrigin.y
    for (const cell of cells) {
      relocation.set(`${cell.x},${cell.y}`, { x: cell.x + dx, y: cell.y + dy })
    }
  }
  return relocation
}

function translatePoint(
  point: { x: number; y: number },
  relocation: Map<string, { x: number; y: number }>,
  fallbackShift: { dx: number; dy: number }
): { x: number; y: number } {
  return (
    relocation.get(`${point.x},${point.y}`) ?? {
      x: point.x + fallbackShift.dx,
      y: point.y + fallbackShift.dy,
    }
  )
}

function wireEndpoints(wire: WireConnection): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  const first = wire.segments[0]?.from
  const last = wire.segments[wire.segments.length - 1]?.to
  if (!first || !last) return null
  return { from: { ...first }, to: { ...last } }
}

function segmentsFromPath(
  points: Array<{ x: number; y: number }>,
  template: WireConnection
): WireSegment[] {
  const expanded: Array<{ x: number; y: number }> = []
  for (const point of points) {
    if (expanded.length === 0) {
      expanded.push(point)
      continue
    }
    const prev = expanded[expanded.length - 1]
    if (prev.x === point.x && prev.y === point.y) continue
    if (prev.x !== point.x && prev.y !== point.y) {
      expanded.push({ x: point.x, y: prev.y })
    }
    expanded.push(point)
  }

  const sample = template.segments[0]
  const segments: WireSegment[] = []
  for (let i = 0; i < expanded.length - 1; i++) {
    segments.push({
      id: `${template.id}-seg-${i}-${Date.now()}`,
      from: expanded[i],
      to: expanded[i + 1],
      isPowered: template.isPowered,
      isGrounded: template.isGrounded,
      isPowerable: template.isPowerable,
      isGroundable: template.isGroundable,
      voltage: template.voltage,
      current: template.current,
      power: template.power,
      color: sample?.color ?? template.color,
      colorId: sample?.colorId ?? template.colorId,
      thickness: sample?.thickness ?? template.thickness,
      gauge: sample?.gauge ?? template.gauge,
      maxCurrent: sample?.maxCurrent ?? template.maxCurrent,
      maxPower: sample?.maxPower ?? template.maxPower,
      pwm: template.pwm,
    })
  }
  return segments
}

function remapWires(
  wires: WireConnection[],
  relocation: Map<string, { x: number; y: number }>,
  fallbackShift: { dx: number; dy: number },
  gridData: unknown[][]
): WireConnection[] {
  return wires.map((wire) => {
    const endpoints = wireEndpoints(wire)
    if (!endpoints) return wire

    const from = translatePoint(endpoints.from, relocation, fallbackShift)
    const to = translatePoint(endpoints.to, relocation, fallbackShift)
    const path = buildWirePath(from, to, gridData)
    const segments = segmentsFromPath(path, wire)
    return segments.length > 0 ? { ...wire, segments } : wire
  })
}

function shiftAnnotations<T extends { x: number; y: number }>(
  items: T[] | undefined,
  shift: { dx: number; dy: number }
): T[] | undefined {
  if (!items?.length) return items
  if (shift.dx === 0 && shift.dy === 0) return items
  return items.map((item) => ({ ...item, x: item.x + shift.dx, y: item.y + shift.dy }))
}

export function applyTidyLayout(schematic: Schematic, plan: TidyLayoutPlan): Schematic {
  if (!plan.hasChanges || plan.nodes.length === 0) return schematic

  const proposed = new Map(plan.nodes.map((node) => [node.id, node.proposedOrigin]))
  const occupied = extractOccupiedComponents(schematic.gridData)
  const relocation = buildRelocationMap(occupied, proposed)

  const oldMinX = Math.min(...plan.nodes.map((n) => n.currentOrigin.x))
  const oldMinY = Math.min(...plan.nodes.map((n) => n.currentOrigin.y))
  const newMinX = Math.min(...plan.nodes.map((n) => n.proposedOrigin.x))
  const newMinY = Math.min(...plan.nodes.map((n) => n.proposedOrigin.y))
  const fallbackShift = { dx: newMinX - oldMinX, dy: newMinY - oldMinY }

  for (const cell of occupied) {
    const next = relocation.get(`${cell.x},${cell.y}`)
    if (next) {
      cell.x = next.x
      cell.y = next.y
    }
  }

  const gridSize = schematic.metadata.gridSize ?? getGridSize(schematic.gridData)
  let requiredWidth = gridSize.width
  let requiredHeight = gridSize.height
  for (const cell of occupied) {
    requiredWidth = Math.max(requiredWidth, cell.x + 1)
    requiredHeight = Math.max(requiredHeight, cell.y + 1)
  }
  const effectiveSize = {
    width: Math.max(gridSize.width, requiredWidth),
    height: Math.max(gridSize.height, requiredHeight),
  }

  let gridData = reconstructGridData(occupied, effectiveSize)
  gridData = ensurePowerSupplyIdsInGrid(gridData)

  const wires = remapWires(schematic.wires ?? [], relocation, fallbackShift, gridData)
  const groupBoxes = shiftAnnotations(schematic.groupBoxes, fallbackShift)
  const labels = shiftAnnotations(schematic.labels, fallbackShift)

  return {
    ...schematic,
    gridData,
    wires,
    groupBoxes,
    labels,
    metadata: {
      ...schematic.metadata,
      gridSize: effectiveSize,
      updatedAt: new Date().toISOString(),
    },
  }
}

export function formatTidyLayoutExport(plan: TidyLayoutPlan, schematicName: string): string {
  const lines = [
    `# ${schematicName} — component list`,
    '',
    plan.summary,
    '',
    '| Module | Category | Current | Proposed | Layer |',
    '| --- | --- | --- | --- | --- |',
  ]

  for (const node of plan.nodes) {
    const cur = `(${node.currentOrigin.x}, ${node.currentOrigin.y})`
    const next = `(${node.proposedOrigin.x}, ${node.proposedOrigin.y})`
    lines.push(`| ${node.moduleName} | ${node.category} | ${cur} | ${next} | ${node.layer} |`)
  }

  return lines.join('\n')
}
