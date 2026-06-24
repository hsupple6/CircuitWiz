import { getModule } from '../../modules/registry'
import { ModuleDefinition, WireConnection } from '../../modules/types'
import {
  Schematic,
  SchematicGroupBox,
  createSchematicGroupBox,
} from '../../types/workspace'
import {
  extractOccupiedComponents,
  reconstructGridData,
  getGridSize,
  OccupiedComponent,
} from '../../utils/gridUtils'
import { placeModule, wireBetween } from '../../examples/schematicBuilder'
import { validateConnection, PinInfo, checkForShortCircuit } from '../../utils/connectionValidator'
import { solveCircuit } from '../../services/CircuitSolver'

export interface ComponentSummary {
  id: string
  moduleName: string
  category: string
  origin: { x: number; y: number }
  pins: Array<{ name: string; x: number; y: number; type: string }>
  properties: Record<string, unknown>
}

function touchSchematic(schematic: Schematic): Schematic {
  return {
    ...schematic,
    metadata: { ...schematic.metadata, updatedAt: new Date().toISOString() },
  }
}

function getComponents(schematic: Schematic): OccupiedComponent[] {
  return extractOccupiedComponents(schematic.gridData)
}

function uniqueComponentOrigins(components: OccupiedComponent[]): Map<string, OccupiedComponent> {
  const map = new Map<string, OccupiedComponent>()
  for (const c of components) {
    if (!map.has(c.componentId)) map.set(c.componentId, c)
  }
  return map
}

function moduleNameFrom(component: OccupiedComponent): string {
  return component.moduleDefinition?.module ?? component.componentType ?? 'unknown'
}

function originOf(components: OccupiedComponent[], componentId: string): { x: number; y: number } | null {
  const cells = components.filter((c) => c.componentId === componentId)
  if (cells.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  for (const c of cells) {
    const relX = c.moduleDefinition?.grid?.[c.cellIndex ?? 0]?.x ?? 0
    const relY = c.moduleDefinition?.grid?.[c.cellIndex ?? 0]?.y ?? 0
    minX = Math.min(minX, c.x - relX)
    minY = Math.min(minY, c.y - relY)
  }
  return { x: minX, y: minY }
}

export function listComponents(schematic: Schematic): ComponentSummary[] {
  const components = getComponents(schematic)
  const origins = uniqueComponentOrigins(components)
  const summaries: ComponentSummary[] = []

  origins.forEach((originCell, id) => {
    const cells = components.filter((c) => c.componentId === id)
    const moduleName = moduleNameFrom(originCell)
    const def = originCell.moduleDefinition as ModuleDefinition | undefined
    const origin = originOf(components, id) ?? { x: originCell.x, y: originCell.y }

    const pins = cells
      .filter((c) => c.moduleDefinition?.grid?.[c.cellIndex ?? 0]?.isConnectable)
      .map((c) => {
        const mc = c.moduleDefinition.grid[c.cellIndex ?? 0]
        return {
          name: mc.pin || mc.type,
          x: c.x,
          y: c.y,
          type: mc.type,
        }
      })

    summaries.push({
      id,
      moduleName,
      category: def?.category ?? 'unknown',
      origin,
      pins,
      properties: {
        ...((def as ModuleDefinition & { properties?: Record<string, unknown> }).properties ?? {}),
        ...(cells.find((c) => c.resistance != null) ? { resistance: cells.find((c) => c.resistance != null)!.resistance } : {}),
        ...(cells.find((c) => (c as OccupiedComponent & { capacitance?: number }).capacitance != null)
          ? { capacitance: (cells.find((c) => (c as OccupiedComponent & { capacitance?: number }).capacitance != null) as OccupiedComponent & { capacitance?: number }).capacitance }
          : {}),
      },
    })
  })

  return summaries
}

export function getComponent(schematic: Schematic, componentId: string): ComponentSummary | null {
  return listComponents(schematic).find((c) => c.id === componentId) ?? null
}

function rebuildSchematic(
  schematic: Schematic,
  components: OccupiedComponent[],
  wires: WireConnection[]
): Schematic {
  const gridSize = schematic.metadata.gridSize ?? getGridSize(schematic.gridData)
  const gridData = reconstructGridData(components, gridSize)

  components.forEach((c) => {
    const cell = gridData[c.y]?.[c.x]
    if (!cell) return
    if (c.resistance != null) cell.resistance = c.resistance
    const ext = c as OccupiedComponent & { capacitance?: number }
    if (ext.capacitance != null) cell.capacitance = ext.capacitance
  })

  return touchSchematic({ ...schematic, gridData, wires })
}

export function placeComponent(
  schematic: Schematic,
  moduleName: string,
  originX: number,
  originY: number,
  props: Record<string, unknown> = {},
  componentId?: string
): { schematic: Schematic; componentId: string } | { error: string } {
  const def = getModule(moduleName)
  if (!def) return { error: `Unknown module: ${moduleName}` }

  const components = getComponents(schematic)
  const placed = placeModule(components, moduleName, originX, originY, props)
  if (componentId) {
    const oldId = placed.id
    components.forEach((c) => {
      if (c.componentId === oldId) c.componentId = componentId
    })
    placed.id = componentId
  }

  return {
    schematic: rebuildSchematic(schematic, components, schematic.wires),
    componentId: placed.id,
  }
}

export function removeComponent(schematic: Schematic, componentId: string): Schematic {
  const components = getComponents(schematic).filter((c) => c.componentId !== componentId)
  const wires = schematic.wires.filter((w) => {
    const pts = w.segments.flatMap((s) => [s.from, s.to])
    const componentCells = getComponents(schematic).filter((c) => c.componentId === componentId)
    return !pts.some((p) => componentCells.some((c) => c.x === p.x && c.y === p.y))
  })
  return rebuildSchematic(schematic, components, wires)
}

export function moveComponent(
  schematic: Schematic,
  componentId: string,
  newOriginX: number,
  newOriginY: number
): { schematic: Schematic } | { error: string } {
  const component = getComponent(schematic, componentId)
  if (!component) return { error: `Component not found: ${componentId}` }

  const dx = newOriginX - component.origin.x
  const dy = newOriginY - component.origin.y
  if (dx === 0 && dy === 0) return { schematic }

  const components = getComponents(schematic).map((c) => {
    if (c.componentId !== componentId) return c
    return { ...c, x: c.x + dx, y: c.y + dy }
  })

  const componentCells = components.filter((c) => c.componentId === componentId)
  const wires = schematic.wires.map((w) => ({
    ...w,
    segments: w.segments.map((s) => {
      const fromHit = componentCells.some((c) => c.x === s.from.x && c.y === s.from.y)
      const toHit = componentCells.some((c) => c.x === s.to.x && c.y === s.to.y)
      return {
        ...s,
        from: fromHit ? { x: s.from.x + dx, y: s.from.y + dy } : s.from,
        to: toHit ? { x: s.to.x + dx, y: s.to.y + dy } : s.to,
      }
    }),
  }))

  return { schematic: rebuildSchematic(schematic, components, wires) }
}

export function setComponentProperty(
  schematic: Schematic,
  componentId: string,
  properties: Record<string, unknown>
): { schematic: Schematic } | { error: string } {
  const components = getComponents(schematic)
  const cells = components.filter((c) => c.componentId === componentId)
  if (cells.length === 0) return { error: `Component not found: ${componentId}` }

  for (const c of cells) {
    if (c.moduleDefinition) {
      c.moduleDefinition = {
        ...c.moduleDefinition,
        properties: { ...(c.moduleDefinition.properties ?? {}), ...properties },
      }
    }
    if (properties.resistance != null) c.resistance = properties.resistance as number
    if (properties.capacitance != null) {
      ;(c as OccupiedComponent & { capacitance?: number }).capacitance = properties.capacitance as number
    }
  }

  return { schematic: rebuildSchematic(schematic, components, schematic.wires) }
}

export function replaceComponent(
  schematic: Schematic,
  componentId: string,
  newModuleName: string,
  props: Record<string, unknown> = {}
): { schematic: Schematic; componentId: string } | { error: string } {
  const existing = getComponent(schematic, componentId)
  if (!existing) return { error: `Component not found: ${componentId}` }
  const { origin } = existing
  let next = removeComponent(schematic, componentId)
  const placed = placeComponent(next, newModuleName, origin.x, origin.y, props, componentId)
  if ('error' in placed) return placed
  return placed
}

function findPin(
  schematic: Schematic,
  componentId: string,
  pinName: string
): PinInfo | null {
  const components = getComponents(schematic)
  for (const c of components) {
    if (c.componentId !== componentId) continue
    const mc = c.moduleDefinition?.grid?.[c.cellIndex ?? 0]
    if (!mc) continue
    const name = mc.pin || mc.type
    if (name !== pinName) continue
    return {
      type: mc.type,
      componentId,
      componentModule: moduleNameFrom(c),
      position: { x: c.x, y: c.y },
    }
  }
  return null
}

export function connectPins(
  schematic: Schematic,
  fromComponentId: string,
  fromPin: string,
  toComponentId: string,
  toPin: string
): { schematic: Schematic; wire: WireConnection } | { error: string; warning?: string } {
  const from = findPin(schematic, fromComponentId, fromPin)
  const to = findPin(schematic, toComponentId, toPin)
  if (!from) return { error: `Pin not found: ${fromComponentId}.${fromPin}` }
  if (!to) return { error: `Pin not found: ${toComponentId}.${toPin}` }

  const validation = validateConnection(from, to)
  if (!validation.isValid) return { error: validation.error ?? 'Invalid connection' }

  const wire = wireBetween([from.position, to.position])
  const wires = [...schematic.wires, wire]

  const shortCheck = checkForShortCircuit([{ from, to }])
  return {
    schematic: rebuildSchematic(schematic, getComponents(schematic), wires),
    wire,
    warning: validation.warning ?? shortCheck.warning,
  }
}

export function addWirePath(
  schematic: Schematic,
  points: Array<{ x: number; y: number }>,
  opts: { color?: string; powered?: boolean; grounded?: boolean } = {}
): { schematic: Schematic; wire: WireConnection } | { error: string } {
  if (points.length < 2) return { error: 'Wire requires at least 2 points' }
  const wire = wireBetween(points, opts)
  return {
    schematic: rebuildSchematic(schematic, getComponents(schematic), [...schematic.wires, wire]),
    wire,
  }
}

export function removeWire(schematic: Schematic, wireId: string): Schematic {
  return rebuildSchematic(
    schematic,
    getComponents(schematic),
    schematic.wires.filter((w) => w.id !== wireId)
  )
}

export function listWires(schematic: Schematic) {
  return schematic.wires.map((w) => ({
    id: w.id,
    segmentCount: w.segments.length,
    points: w.segments.flatMap((s, i) => (i === 0 ? [s.from, s.to] : [s.to])),
    color: w.color,
    isPowered: w.isPowered,
    isGrounded: w.isGrounded,
  }))
}

export function addGroupBox(
  schematic: Schematic,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
): { schematic: Schematic; groupBox: SchematicGroupBox } {
  const groupBox = createSchematicGroupBox(x, y, width, height, title)
  return {
    schematic: touchSchematic({
      ...schematic,
      groupBoxes: [...(schematic.groupBoxes ?? []), groupBox],
    }),
    groupBox,
  }
}

export function updateGroupBox(
  schematic: Schematic,
  groupBoxId: string,
  patch: Partial<Omit<SchematicGroupBox, 'id'>>
): { schematic: Schematic; groupBox: SchematicGroupBox | null } {
  let updated: SchematicGroupBox | null = null
  const groupBoxes = (schematic.groupBoxes ?? []).map((g) => {
    if (g.id !== groupBoxId) return g
    updated = { ...g, ...patch }
    return updated
  })
  if (!updated) return { schematic, groupBox: null }
  return { schematic: touchSchematic({ ...schematic, groupBoxes }), groupBox: updated }
}

export function removeGroupBox(schematic: Schematic, groupBoxId: string): Schematic {
  return touchSchematic({
    ...schematic,
    groupBoxes: (schematic.groupBoxes ?? []).filter((g) => g.id !== groupBoxId),
  })
}

export function validateSchematicConnections(schematic: Schematic) {
  const issues: Array<{ severity: 'error' | 'warning'; message: string }> = []
  const components = listComponents(schematic)

  if (components.length === 0) {
    issues.push({ severity: 'warning', message: 'Schematic has no components' })
  }

  const pinInfos: PinInfo[] = []
  for (const c of components) {
    for (const pin of c.pins) {
      pinInfos.push({
        type: pin.type,
        componentId: c.id,
        componentModule: c.moduleName,
        position: { x: pin.x, y: pin.y },
      })
    }
  }

  for (const wire of schematic.wires) {
    for (const seg of wire.segments) {
      const fromPin = pinInfos.find((p) => p.position.x === seg.from.x && p.position.y === seg.from.y)
      const toPin = pinInfos.find((p) => p.position.x === seg.to.x && p.position.y === seg.to.y)
      if (fromPin && toPin) {
        const result = validateConnection(fromPin, toPin)
        if (!result.isValid) {
          issues.push({ severity: 'error', message: result.error ?? 'Invalid connection' })
        } else if (result.warning) {
          issues.push({ severity: 'warning', message: result.warning })
        }
      }
    }
  }

  return { valid: !issues.some((i) => i.severity === 'error'), issues }
}

export function simulateSchematic(schematic: Schematic) {
  const result = solveCircuit(schematic.gridData, schematic.wires)
  return {
    works: result.works,
    reason: result.reason,
    errors: result.errors,
    totalVoltage: result.totalVoltage,
    totalCurrent: result.totalCurrent,
    totalPower: result.totalPower,
    componentStateCount: result.componentStates.size,
  }
}

export function getSchematicState(schematic: Schematic) {
  return {
    id: schematic.id,
    name: schematic.name,
    description: schematic.description,
    componentCount: listComponents(schematic).length,
    wireCount: schematic.wires.length,
    groupBoxCount: schematic.groupBoxes?.length ?? 0,
    hasFirmware: !!schematic.arduinoProject,
    gridSize: schematic.metadata.gridSize,
    metadata: schematic.metadata,
  }
}

export function replaceSchematicContent(
  target: Schematic,
  source: Schematic
): Schematic {
  return touchSchematic({
    ...target,
    gridData: source.gridData,
    wires: source.wires,
    componentStates: source.componentStates,
    groupBoxes: source.groupBoxes,
    arduinoProject: source.arduinoProject,
  })
}
