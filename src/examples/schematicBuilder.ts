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
  if (module.category === 'power') return 'PowerSupply'
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
      if (cell.pin) {
        pinMap.set(cell.pin, { x, y })
        const shortPin = cell.pin.split('/')[0]
        if (shortPin !== cell.pin) pinMap.set(shortPin, { x, y })
      }
      if (moduleName === 'LED') {
        if (cell.type === 'LED_POSITIVE' || cell.pin === '+') pinMap.set('+', { x, y })
        if (cell.type === 'LED_NEGATIVE' || cell.pin === '-') pinMap.set('-', { x, y })
      }
      if (moduleName === 'Resistor' || moduleName === 'Capacitor' || moduleName === 'Inductor') {
        if (cell.x === 0) pinMap.set('1', { x, y })
        if (cell.x === 2) pinMap.set('2', { x, y })
      }
      if (moduleName === 'Diode' || moduleName === 'ZenerDiode') {
        if (cell.type === 'ANODE' || cell.pin === 'A') pinMap.set('A', { x, y })
        if (cell.type === 'CATHODE' || cell.pin === 'K') pinMap.set('K', { x, y })
      }
      if (moduleName === 'NPNTransistor') {
        if (cell.pin === 'B') pinMap.set('B', { x, y })
        if (cell.pin === 'C') pinMap.set('C', { x, y })
        if (cell.pin === 'E') pinMap.set('E', { x, y })
      }
      if (moduleName === 'MOSFET') {
        if (cell.pin === 'G') pinMap.set('G', { x, y })
        if (cell.pin === 'D') pinMap.set('D', { x, y })
        if (cell.pin === 'S') pinMap.set('S', { x, y })
      }
      if (moduleName === 'OpAmp') {
        if (cell.pin === '+') pinMap.set('+', { x, y })
        if (cell.pin === '-') pinMap.set('-', { x, y })
        if (cell.pin === 'OUT') pinMap.set('OUT', { x, y })
        if (cell.pin === 'V+') pinMap.set('V+', { x, y })
        if (cell.pin === 'V-') pinMap.set('V-', { x, y })
      }
      if (moduleName === 'BridgeRectifier') {
        if (cell.pin === 'AC1') pinMap.set('AC1', { x, y })
        if (cell.pin === 'AC2') pinMap.set('AC2', { x, y })
        if (cell.pin === '+') pinMap.set('+', { x, y })
        if (cell.pin === '-') pinMap.set('-', { x, y })
      }
      if (moduleName === 'ACSource') {
        if (cell.pin === 'AC1') pinMap.set('AC1', { x, y })
        if (cell.pin === 'AC2') pinMap.set('AC2', { x, y })
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
    if (moduleName === 'Inductor' && props.inductance != null) {
      ;(entry as OccupiedComponent & { inductance: number }).inductance = props.inductance as number
    }
    if (moduleName === 'ZenerDiode' && props.zenerVoltage != null) {
      moduleDefinition.properties = {
        ...(moduleDefinition.properties as Record<string, unknown>),
        zenerVoltage: props.zenerVoltage,
      }
    }
    if (moduleName === 'ACSource') {
      moduleDefinition.properties = {
        ...(moduleDefinition.properties as Record<string, unknown>),
        ...(props.vrms != null ? { vrms: props.vrms } : {}),
        ...(props.frequency != null ? { frequency: props.frequency } : {}),
        ...(props.waveform != null ? { waveform: props.waveform } : {}),
      }
    }
    if (moduleName === 'MOSFET') {
      moduleDefinition.properties = {
        ...(moduleDefinition.properties as Record<string, unknown>),
        ...(props.vth != null ? { vth: props.vth } : {}),
        ...(props.rdsOn != null ? { rdsOn: props.rdsOn } : {}),
      }
    }
    if (
      (moduleName === 'PowerSupply' || moduleName === 'Battery') &&
      props.voltage != null
    ) {
      const v = props.voltage as number
      moduleDefinition.properties = {
        ...(moduleDefinition.properties as Record<string, unknown>),
        voltage: v,
      }
      moduleDefinition.grid = moduleDefinition.grid.map((cell) =>
        cell.type === 'VCC' || cell.pin === '5V' || cell.pin === '+'
          ? { ...cell, voltage: v }
          : cell
      )
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
  const expanded: Array<{ x: number; y: number }> = []
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
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

  const segments: WireSegment[] = []
  for (let i = 0; i < expanded.length - 1; i++) {
    segments.push({
      id: `ex-seg-${++placementCounter}-${i}`,
      from: expanded[i],
      to: expanded[i + 1],
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
