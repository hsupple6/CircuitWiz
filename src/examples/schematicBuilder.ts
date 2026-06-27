import { getModule } from '../modules/registry'
import { ModuleDefinition, WireConnection, WireSegment } from '../modules/types'
import { reconstructGridData, type OccupiedComponent } from '../utils/gridUtils'
import {
  createSchematic,
  type Schematic,
  type SchematicGroupBox,
} from '../types/workspace'

const DEFAULT_GRID = { width: 50, height: 50 }

function componentTypeFor(module: ModuleDefinition): string {
  if (module.category === 'microcontrollers') return 'Microcontroller'
  if (module.category === 'power') return module.module === 'Battery' ? 'Battery' : 'PowerSupply'
  if (module.category === 'sensors') return 'Sensor'
  if (module.category === 'switches') return module.module
  if (module.category === 'passives') return module.module
  if (module.category === 'output' || module.category === 'semiconductors') return module.module
  return module.module
}

let placementCounter = 0

export interface PlacedComponent {
  id: string
  origin: { x: number; y: number }
  pin: (name: string) => { x: number; y: number }
  at: (relX: number, relY: number) => { x: number; y: number }
}

export function placeModule(
  components: OccupiedComponent[],
  moduleName: string,
  originX: number,
  originY: number,
  props: Record<string, unknown> = {}
): PlacedComponent {
  const def = getModule(moduleName)
  if (!def) throw new Error(`Unknown module: ${moduleName}`)

  const id = `ex-${moduleName.replace(/\s+/g, '')}-${++placementCounter}`
  const moduleDefinition = {
    ...def,
    properties: { ...(def as ModuleDefinition & { properties?: Record<string, unknown> }).properties, ...props },
  }

  const pinMap = new Map<string, { x: number; y: number }>()

  def.grid.forEach((cell, cellIndex) => {
    const x = originX + cell.x
    const y = originY + cell.y
    const pinName = cell.pin || cell.type
    if (cell.isConnectable) {
      pinMap.set(pinName, { x, y })
      if (moduleName === 'LED') {
        if (cell.type === 'LED_POSITIVE' || cell.pin === '+') pinMap.set('+', { x, y })
        if (cell.type === 'LED_NEGATIVE' || cell.pin === '-') pinMap.set('-', { x, y })
      }
      if (moduleName === 'Capacitor') {
        if (cell.x === 0) pinMap.set('1', { x, y })
        if (cell.x === 2) pinMap.set('2', { x, y })
      }
    }

    const entry: OccupiedComponent = {
      x,
      y,
      componentId: id,
      componentType: componentTypeFor(def),
      moduleDefinition,
      cellIndex,
      isPowered: cell.isPowered ?? false,
      isClickable: cell.isClickable ?? false,
    }

    if (moduleName === 'Resistor' && props.resistance != null) {
      ;(entry as OccupiedComponent & { resistance: number }).resistance = props.resistance as number
    }
    if (moduleName === 'Capacitor' && props.capacitance != null) {
      ;(entry as OccupiedComponent & { capacitance: number }).capacitance = props.capacitance as number
    }

    components.push(entry)
  })

  return {
    id,
    origin: { x: originX, y: originY },
    pin: (name: string) => {
      const p = pinMap.get(name)
      if (!p) throw new Error(`Pin "${name}" not found on ${moduleName}`)
      return p
    },
    at: (relX: number, relY: number) => ({ x: originX + relX, y: originY + relY }),
  }
}

export function wireBetween(
  points: Array<{ x: number; y: number }>,
  opts: { color?: string; powered?: boolean; grounded?: boolean } = {}
): WireConnection {
  const segments: WireSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      id: `ex-seg-${++placementCounter}-${i}`,
      from: points[i],
      to: points[i + 1],
      isPowered: opts.powered ?? false,
      isGrounded: opts.grounded ?? false,
      isPowerable: true,
      isGroundable: true,
      voltage: opts.powered ? 5 : 0,
      current: 0,
      power: 0,
      color: opts.color ?? '#666666',
      thickness: 3,
      gauge: 14,
      maxCurrent: 15,
      maxPower: 1800,
    })
  }

  return {
    id: `ex-wire-${placementCounter}`,
    segments,
    isPowered: opts.powered ?? false,
    isGrounded: opts.grounded ?? false,
    isPowerable: true,
    isGroundable: true,
    voltage: 0,
    current: 0,
    power: 0,
    color: opts.color ?? '#666666',
    thickness: 3,
    gauge: 14,
    maxCurrent: 15,
    maxPower: 1800,
  }
}

type BuildFn = (ctx: {
  place: (
    moduleName: string,
    originX: number,
    originY: number,
    props?: Record<string, unknown>
  ) => PlacedComponent
  wire: typeof wireBetween
  components: OccupiedComponent[]
  wires: WireConnection[]
}) => void

export function buildSchematic(
  name: string,
  description: string,
  build: BuildFn,
  extra: { groupBoxes?: SchematicGroupBox[] } = {}
): Schematic {
  placementCounter = 0
  const components: OccupiedComponent[] = []
  const wires: WireConnection[] = []

  build({
    components,
    wires,
    place: (moduleName, originX, originY, props = {}) =>
      placeModule(components, moduleName, originX, originY, props),
    wire: (points, opts) => {
      const w = wireBetween(points, opts)
      wires.push(w)
      return w
    },
  })

  const gridData = reconstructGridData(components, DEFAULT_GRID)

  // Preserve passive values on reconstructed cells
  components.forEach((c) => {
    const cell = gridData[c.y]?.[c.x]
    if (!cell) return
    const ext = c as OccupiedComponent & { resistance?: number; capacitance?: number }
    if (ext.resistance != null) cell.resistance = ext.resistance
    if (ext.capacitance != null) cell.capacitance = ext.capacitance
  })

  return createSchematic(name, description, {
    gridData,
    wires,
    groupBoxes: extra.groupBoxes,
  })
}
