import { getModule, resolveModuleName } from '../../modules/registry'
import { ModuleDefinition, WireConnection } from '../../modules/types'
import {
  Schematic,
  SchematicGroupBox,
  SchematicCellLabel,
  createSchematicGroupBox,
  createSchematicCellLabel,
  GROUP_BOX_COLOR_PRESETS,
} from '../../types/workspace'
import {
  extractOccupiedComponents,
  reconstructGridData,
  getGridSize,
  OccupiedComponent,
} from '../../utils/gridUtils'
import {
  assignPowerSupplyIdToDefinition,
  ensurePowerSupplyIdsInGrid,
  nextPowerSupplyId,
} from '../../utils/powerSupplies'
import { placeModule, wireBetween } from '../../examples/schematicBuilder'
import { validateConnection, PinInfo, checkForShortCircuit } from '../../utils/connectionValidator'
import { solveCircuit } from '../../services/CircuitSolver'
import {
  layoutGuidelinesForAgent,
  nextHorizontalOrigin,
  SCHEMATIC_LAYOUT_GUIDELINES,
} from './layoutGuidelines'
import { cellMatchesPin, primaryPinName } from '../../utils/pinNames'
import { buildWirePath } from '../../utils/wireRouting'
import { pickWireColorForConnection, pickWireColorForPath, PickWireColorOptions } from '../../utils/pickWireColor'

function pinMatchesForCell(
  moduleName: string,
  cell: ModuleDefinition['grid'][number],
  pinName: string,
  gridWidth?: number
): boolean {
  return cellMatchesPin(moduleName, cell, pinName, gridWidth)
}

export interface ComponentSummary {
  id: string
  moduleName: string
  category: string
  origin: { x: number; y: number }
  size: { gridX: number; gridY: number }
  pins: Array<{ name: string; x: number; y: number; relX: number; relY: number; type: string }>
  properties: Record<string, unknown>
}

export interface SuggestedPlacement {
  x: number
  y: number
  afterComponentId?: string
  note: string
}

function touchSchematic(schematic: Schematic): Schematic {
  return {
    ...schematic,
    metadata: { ...schematic.metadata, updatedAt: new Date().toISOString() },
  }
}

function readNumeric(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return fallback
}

function ensureGridFits(
  schematic: Schematic,
  originX: number,
  originY: number,
  width: number,
  height: number
): Schematic {
  const gridSize = schematic.metadata.gridSize ?? getGridSize(schematic.gridData)
  const requiredWidth = originX + width
  const requiredHeight = originY + height
  if (requiredWidth <= gridSize.width && requiredHeight <= gridSize.height) {
    return schematic
  }
  return {
    ...schematic,
    metadata: {
      ...schematic.metadata,
      gridSize: {
        width: Math.max(gridSize.width, requiredWidth),
        height: Math.max(gridSize.height, requiredHeight),
      },
    },
  }
}

function wouldCollide(
  components: OccupiedComponent[],
  originX: number,
  originY: number,
  def: ModuleDefinition
): boolean {
  for (const cell of def.grid) {
    const x = originX + cell.x
    const y = originY + cell.y
    if (components.some((c) => c.x === x && c.y === y)) return true
  }
  return false
}

function applyPowerSupplyPlacement(
  components: OccupiedComponent[],
  componentId: string,
  schematic: Schematic,
  props: Record<string, unknown>
): void {
  const voltage = readNumeric(props.voltage, 5)
  const current = readNumeric(props.current, 1)
  const supplyId = nextPowerSupplyId(schematic.gridData)
  for (const c of components) {
    if (c.componentId === componentId && c.moduleDefinition) {
      c.moduleDefinition = assignPowerSupplyIdToDefinition(
        c.moduleDefinition as ModuleDefinition,
        supplyId,
        voltage,
        current
      )
    }
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
        const gridWidth = def?.gridX
        return {
          name: primaryPinName(mc, moduleName, gridWidth),
          x: c.x,
          y: c.y,
          relX: mc.x,
          relY: mc.y,
          type: mc.type,
        }
      })

    summaries.push({
      id,
      moduleName,
      category: def?.category ?? 'unknown',
      origin,
      size: { gridX: def?.gridX ?? 1, gridY: def?.gridY ?? 1 },
      pins,
      properties: {
        ...((def as ModuleDefinition & { properties?: Record<string, unknown> }).properties ?? {}),
        ...(cells.find((c) => c.resistance != null) ? { resistance: cells.find((c) => c.resistance != null)!.resistance } : {}),
        ...(cells.find((c) => (c as OccupiedComponent & { capacitance?: number }).capacitance != null)
          ? { capacitance: (cells.find((c) => (c as OccupiedComponent & { capacitance?: number }).capacitance != null) as OccupiedComponent & { capacitance?: number }).capacitance }
          : {}),
        ...(cells.find((c) => (c as OccupiedComponent & { inductance?: number }).inductance != null)
          ? { inductance: (cells.find((c) => (c as OccupiedComponent & { inductance?: number }).inductance != null) as OccupiedComponent & { inductance?: number }).inductance }
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
  const gridSize =
    schematic.metadata.gridSize ??
    getGridSize(schematic.gridData)
  const dataSize = getGridSize(schematic.gridData)
  const effectiveSize = {
    width: Math.max(gridSize.width, dataSize.width),
    height: Math.max(gridSize.height, dataSize.height),
  }
  let gridData = reconstructGridData(components, effectiveSize)

  components.forEach((c) => {
    const cell = gridData[c.y]?.[c.x]
    if (!cell) return
    if (c.resistance != null) cell.resistance = c.resistance
    const ext = c as OccupiedComponent & { capacitance?: number; inductance?: number }
    if (ext.capacitance != null) cell.capacitance = ext.capacitance
    if (ext.inductance != null) cell.inductance = ext.inductance
  })

  gridData = ensurePowerSupplyIdsInGrid(gridData)

  return touchSchematic({
    ...schematic,
    gridData,
    wires,
    metadata: {
      ...schematic.metadata,
      gridSize: effectiveSize,
    },
  })
}

export function placeComponent(
  schematic: Schematic,
  moduleName: string,
  originX: number,
  originY: number,
  props: Record<string, unknown> = {},
  componentId?: string
): { schematic: Schematic; componentId: string } | { error: string } {
  const canonical = resolveModuleName(moduleName)
  const def = getModule(canonical)
  if (!def) return { error: `Unknown module: ${moduleName}` }

  let nextSchematic = ensureGridFits(schematic, originX, originY, def.gridX, def.gridY)
  const components = getComponents(nextSchematic)

  if (wouldCollide(components, originX, originY, def)) {
    return { error: `Placement at (${originX}, ${originY}) collides with an existing component` }
  }

  const placed = placeModule(components, canonical, originX, originY, props)
  if (canonical === 'PowerSupply') {
    applyPowerSupplyPlacement(components, placed.id, nextSchematic, props)
  }

  if (componentId) {
    const oldId = placed.id
    components.forEach((c) => {
      if (c.componentId === oldId) c.componentId = componentId
    })
    placed.id = componentId
  }

  return {
    schematic: rebuildSchematic(nextSchematic, components, nextSchematic.wires),
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
    if (properties.inductance != null) {
      ;(c as OccupiedComponent & { inductance?: number }).inductance = properties.inductance as number
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

function findMatchingPins(
  schematic: Schematic,
  componentId: string,
  pinName: string
): PinInfo[] {
  const components = getComponents(schematic)
  const matches: PinInfo[] = []
  for (const c of components) {
    if (c.componentId !== componentId) continue
    const mc = c.moduleDefinition?.grid?.[c.cellIndex ?? 0]
    if (!mc?.isConnectable) continue
    const moduleName = moduleNameFrom(c)
    const gridWidth = c.moduleDefinition?.gridX
    if (!pinMatchesForCell(moduleName, mc, pinName, gridWidth)) continue
    matches.push({
      type: mc.type,
      componentId,
      componentModule: moduleName,
      position: { x: c.x, y: c.y },
    })
  }
  return matches
}

function findPin(
  schematic: Schematic,
  componentId: string,
  pinName: string
): PinInfo | null {
  const matches = findMatchingPins(schematic, componentId, pinName)
  if (matches.length === 1) return matches[0]
  return null
}

function pinLookupError(
  schematic: Schematic,
  componentId: string,
  pinName: string
): string {
  const comp = getComponent(schematic, componentId)
  const available = comp?.pins.map((p) => `${p.name}@(${p.x},${p.y})`).join(', ') ?? 'none'
  const matches = findMatchingPins(schematic, componentId, pinName)
  if (matches.length > 1) {
    const options = matches.map((m) => `(${m.position.x},${m.position.y})`).join(', ')
    return `Pin "${pinName}" is ambiguous on ${componentId} — matches multiple terminals at ${options}. Use distinct pin names from list_components: ${available}`
  }
  return `Pin not found: ${componentId}.${pinName}. Connectable pins: ${available}`
}

function validateWirePoint(
  schematic: Schematic,
  point: { x: number; y: number }
): { ok: true } | { ok: false; error: string } {
  const cell = schematic.gridData[point.y]?.[point.x] as
    | (OccupiedComponent & { occupied?: boolean })
    | undefined
  if (!cell?.occupied) return { ok: true }

  const mc = cell.moduleDefinition?.grid?.[cell.cellIndex ?? 0]
  if (mc?.isConnectable) return { ok: true }

  const moduleName = cell.moduleDefinition?.module ?? cell.componentType ?? 'component'
  const gridWidth = cell.moduleDefinition?.gridX
  const terminalHint =
    gridWidth === 3
      ? ' Terminals are at origin+relX 0 and 2 (not the center body at relX 1).'
      : ''
  return {
    ok: false,
    error: `Wire point (${point.x},${point.y}) is inside ${moduleName} body — not a connectable pin.${terminalHint} Use pin x,y from schematic_list_components.`,
  }
}

export function connectPins(
  schematic: Schematic,
  fromComponentId: string,
  fromPin: string,
  toComponentId: string,
  toPin: string,
  opts: PickWireColorOptions = {}
): { schematic: Schematic; wire: WireConnection } | { error: string; warning?: string } {
  const from = findPin(schematic, fromComponentId, fromPin)
  const to = findPin(schematic, toComponentId, toPin)
  if (!from) {
    return { error: pinLookupError(schematic, fromComponentId, fromPin) }
  }
  if (!to) {
    return { error: pinLookupError(schematic, toComponentId, toPin) }
  }

  const validation = validateConnection(from, to)
  if (!validation.isValid) return { error: validation.error ?? 'Invalid connection' }

  const path = buildWirePath(from.position, to.position, schematic.gridData)
  const colorChoice = pickWireColorForConnection(schematic.wires, from, to, opts)
  const wire = wireBetween(path, {
    colorId: colorChoice.colorId,
    color: colorChoice.color,
    powered: colorChoice.powered,
    grounded: colorChoice.grounded,
  })
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
  opts: PickWireColorOptions & { powered?: boolean; grounded?: boolean } = {}
): { schematic: Schematic; wire: WireConnection } | { error: string } {
  if (points.length < 2) return { error: 'Wire requires at least 2 points' }

  for (const point of points) {
    const check = validateWirePoint(schematic, point)
    if (!check.ok) return { error: check.error }
  }

  const colorChoice = pickWireColorForPath(schematic.wires, opts)
  const wire = wireBetween(points, {
    colorId: opts.colorId ?? colorChoice.colorId,
    color: opts.color ?? colorChoice.color,
    powered: opts.powered ?? colorChoice.powered,
    grounded: opts.grounded ?? colorChoice.grounded,
  })
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
    colorId: w.colorId,
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
  title: string,
  opts: { color?: string; borderColor?: string; colorPreset?: string } = {}
): { schematic: Schematic; groupBox: SchematicGroupBox } {
  const preset =
    GROUP_BOX_COLOR_PRESETS.find((p) => p.name.toLowerCase() === opts.colorPreset?.toLowerCase()) ??
    GROUP_BOX_COLOR_PRESETS[0]
  const groupBox = createSchematicGroupBox(x, y, width, height, title, preset)
  if (opts.color) groupBox.color = opts.color
  if (opts.borderColor) groupBox.borderColor = opts.borderColor
  return {
    schematic: touchSchematic({
      ...schematic,
      groupBoxes: [...(schematic.groupBoxes ?? []), groupBox],
    }),
    groupBox,
  }
}

export function listGroupBoxes(schematic: Schematic) {
  return (schematic.groupBoxes ?? []).map((g) => ({
    id: g.id,
    x: g.x,
    y: g.y,
    width: g.width,
    height: g.height,
    title: g.title,
    color: g.color,
    borderColor: g.borderColor,
  }))
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

export function listLabels(schematic: Schematic) {
  return (schematic.labels ?? []).map((label) => ({
    id: label.id,
    x: label.x,
    y: label.y,
    text: label.text,
  }))
}

export function addLabel(
  schematic: Schematic,
  x: number,
  y: number,
  text: string,
  labelId?: string
): { schematic: Schematic; label: SchematicCellLabel } {
  const label = createSchematicCellLabel(x, y, text)
  if (labelId) label.id = labelId
  return {
    schematic: touchSchematic({
      ...schematic,
      labels: [...(schematic.labels ?? []), label],
    }),
    label,
  }
}

export function updateLabel(
  schematic: Schematic,
  labelId: string,
  patch: Partial<Omit<SchematicCellLabel, 'id'>>
): { schematic: Schematic; label: SchematicCellLabel | null } {
  let updated: SchematicCellLabel | null = null
  const labels = (schematic.labels ?? []).map((label) => {
    if (label.id !== labelId) return label
    updated = { ...label, ...patch }
    return updated
  })
  if (!updated) return { schematic, label: null }
  return { schematic: touchSchematic({ ...schematic, labels }), label: updated }
}

export function removeLabel(schematic: Schematic, labelId: string): Schematic {
  return touchSchematic({
    ...schematic,
    labels: (schematic.labels ?? []).filter((label) => label.id !== labelId),
  })
}

export function removeLabelAt(schematic: Schematic, x: number, y: number): Schematic {
  return touchSchematic({
    ...schematic,
    labels: (schematic.labels ?? []).filter((label) => !(label.x === x && label.y === y)),
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

export function suggestNextPlacement(schematic: Schematic): SuggestedPlacement {
  const components = listComponents(schematic)
  const { placementOrigin, minGapCells } = SCHEMATIC_LAYOUT_GUIDELINES

  if (components.length === 0) {
    return {
      x: placementOrigin.x,
      y: placementOrigin.y,
      note: 'First component — place at layoutGuidelines.placementOrigin.',
    }
  }

  let anchor = components[0]
  let anchorRight = anchor.origin.x + anchor.size.gridX

  for (const component of components) {
    const right = component.origin.x + component.size.gridX
    if (
      right > anchorRight ||
      (right === anchorRight && component.origin.y < anchor.origin.y)
    ) {
      anchor = component
      anchorRight = right
    }
  }

  return {
    x: nextHorizontalOrigin(anchor.origin.x, anchor.size.gridX, minGapCells),
    y: anchor.origin.y,
    afterComponentId: anchor.id,
    note: `Tight horizontal placement after ${anchor.id} (${anchor.moduleName}).`,
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
    labelCount: schematic.labels?.length ?? 0,
    groupBoxes: listGroupBoxes(schematic),
    labels: listLabels(schematic),
    flashedMicrocontrollers: Object.keys(schematic.programFlashes ?? {}).length,
    gridSize: schematic.metadata.gridSize,
    metadata: schematic.metadata,
    layoutGuidelines: layoutGuidelinesForAgent(),
    suggestedNextPlacement: suggestNextPlacement(schematic),
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
    labels: source.labels,
    programFlashes: source.programFlashes,
    arduinoProject: source.arduinoProject,
  })
}

