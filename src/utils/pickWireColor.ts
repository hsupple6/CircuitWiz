import { WireConnection } from '../modules/types'
import {
  DEFAULT_WIRE_COLOR_ID,
  DEFAULT_WIRE_COLOR_MODE,
  WIRE_COLORS,
  WireColorId,
  inferWireColorId,
  isWireColorId,
  wireColorPatch,
} from '../theme/colors'
import { PinInfo } from './connectionValidator'

const POWER_PIN_TYPES = new Set(['VCC', '5V', '3V3', '3.3V', 'VIN', 'PWR', 'POWER', 'VBAT'])
const GROUND_PIN_TYPES = new Set(['GND', 'GROUND', 'VSS', 'AGND', 'DGND'])

const PIN_TYPE_COLORS: Record<string, WireColorId> = {
  VCC: 'red',
  GND: 'black',
  SDA: 'lightBlue',
  SCL: 'yellow',
  PWM: 'orange',
  ANALOG: 'violet',
  SPI: 'navyBlue',
  UART: 'pink',
  I2C: 'lightBlue',
}

const SIGNAL_COLOR_CYCLE: WireColorId[] = [
  'orange',
  'yellow',
  'lightBlue',
  'violet',
  'pink',
  'limeGreen',
  'navyBlue',
  'brown',
  'green',
  'white',
]

export interface WireColorChoice {
  colorId: WireColorId
  color: string
  powered: boolean
  grounded: boolean
}

export interface PickWireColorOptions {
  color?: string
  colorId?: WireColorId
}

function normalizePinType(type: string): string {
  return type.trim().toUpperCase()
}

function semanticColorForPin(type: string): WireColorId | undefined {
  const normalized = normalizePinType(type)
  if (POWER_PIN_TYPES.has(normalized)) return 'red'
  if (GROUND_PIN_TYPES.has(normalized)) return 'black'
  return PIN_TYPE_COLORS[normalized]
}

function isPowerPin(type: string): boolean {
  return POWER_PIN_TYPES.has(normalizePinType(type))
}

function isGroundPin(type: string): boolean {
  return GROUND_PIN_TYPES.has(normalizePinType(type))
}

function wireTouchesPoint(wire: WireConnection, point: { x: number; y: number }): boolean {
  return wire.segments.some(
    (segment) =>
      (segment.from.x === point.x && segment.from.y === point.y) ||
      (segment.to.x === point.x && segment.to.y === point.y)
  )
}

function findWireAtPoint(
  wires: WireConnection[],
  point: { x: number; y: number }
): WireConnection | undefined {
  return wires.find((wire) => wireTouchesPoint(wire, point))
}

function usedColorCounts(wires: WireConnection[]): Map<WireColorId, number> {
  const counts = new Map<WireColorId, number>()
  for (const wire of wires) {
    const id = wire.colorId ?? inferWireColorId(wire.color) ?? DEFAULT_WIRE_COLOR_ID
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

function nextSignalColor(wires: WireConnection[]): WireColorId {
  const counts = usedColorCounts(wires)
  let best = SIGNAL_COLOR_CYCLE[0]
  let bestCount = Number.POSITIVE_INFINITY
  for (const id of SIGNAL_COLOR_CYCLE) {
    const count = counts.get(id) ?? 0
    if (count < bestCount) {
      best = id
      bestCount = count
    }
  }
  return best
}

function resolveExplicitColor(opts: PickWireColorOptions): WireColorChoice | undefined {
  if (opts.colorId && isWireColorId(opts.colorId)) {
    const patch = wireColorPatch(opts.colorId, DEFAULT_WIRE_COLOR_MODE)
    return {
      colorId: patch.colorId,
      color: patch.color,
      powered: opts.colorId === 'red',
      grounded: opts.colorId === 'black',
    }
  }
  if (opts.color) {
    const inferred = inferWireColorId(opts.color)
    if (inferred) {
      const patch = wireColorPatch(inferred, DEFAULT_WIRE_COLOR_MODE)
      return {
        colorId: patch.colorId,
        color: patch.color,
        powered: inferred === 'red',
        grounded: inferred === 'black',
      }
    }
    return {
      colorId: DEFAULT_WIRE_COLOR_ID,
      color: opts.color,
      powered: false,
      grounded: false,
    }
  }
  return undefined
}

function inheritWireColor(wire: WireConnection): WireColorChoice {
  const colorId = wire.colorId ?? inferWireColorId(wire.color) ?? DEFAULT_WIRE_COLOR_ID
  const patch = wireColorPatch(colorId, DEFAULT_WIRE_COLOR_MODE)
  return {
    colorId: patch.colorId,
    color: wire.color ?? patch.color,
    powered: wire.isPowered,
    grounded: wire.isGrounded,
  }
}

export function pickWireColorForConnection(
  wires: WireConnection[],
  from: PinInfo,
  to: PinInfo,
  opts: PickWireColorOptions = {}
): WireColorChoice {
  const explicit = resolveExplicitColor(opts)
  if (explicit) return explicit

  const fromWire = findWireAtPoint(wires, from.position)
  if (fromWire) return inheritWireColor(fromWire)

  const toWire = findWireAtPoint(wires, to.position)
  if (toWire) return inheritWireColor(toWire)

  const fromSemantic = semanticColorForPin(from.type)
  const toSemantic = semanticColorForPin(to.type)

  if (fromSemantic && toSemantic) {
    if (fromSemantic === toSemantic) {
      const patch = wireColorPatch(fromSemantic, DEFAULT_WIRE_COLOR_MODE)
      return {
        colorId: patch.colorId,
        color: patch.color,
        powered: isPowerPin(from.type) || isPowerPin(to.type),
        grounded: isGroundPin(from.type) || isGroundPin(to.type),
      }
    }
    const powerSide = fromSemantic === 'red' ? fromSemantic : toSemantic === 'red' ? toSemantic : undefined
    const groundSide =
      fromSemantic === 'black' ? fromSemantic : toSemantic === 'black' ? toSemantic : undefined
    const chosen = powerSide ?? groundSide ?? fromSemantic
    const patch = wireColorPatch(chosen, DEFAULT_WIRE_COLOR_MODE)
    return {
      colorId: patch.colorId,
      color: patch.color,
      powered: Boolean(powerSide),
      grounded: Boolean(groundSide),
    }
  }

  if (fromSemantic) {
    const patch = wireColorPatch(fromSemantic, DEFAULT_WIRE_COLOR_MODE)
    return {
      colorId: patch.colorId,
      color: patch.color,
      powered: isPowerPin(from.type),
      grounded: isGroundPin(from.type),
    }
  }

  if (toSemantic) {
    const patch = wireColorPatch(toSemantic, DEFAULT_WIRE_COLOR_MODE)
    return {
      colorId: patch.colorId,
      color: patch.color,
      powered: isPowerPin(to.type),
      grounded: isGroundPin(to.type),
    }
  }

  const signalColor = nextSignalColor(wires)
  const patch = wireColorPatch(signalColor, DEFAULT_WIRE_COLOR_MODE)
  return {
    colorId: patch.colorId,
    color: patch.color,
    powered: false,
    grounded: false,
  }
}

export function pickWireColorForPath(
  wires: WireConnection[],
  opts: PickWireColorOptions = {}
): WireColorChoice {
  const explicit = resolveExplicitColor(opts)
  if (explicit) return explicit

  const signalColor = nextSignalColor(wires)
  const patch = wireColorPatch(signalColor, DEFAULT_WIRE_COLOR_MODE)
  return {
    colorId: patch.colorId,
    color: patch.color,
    powered: false,
    grounded: false,
  }
}

export const AGENT_WIRE_COLOR_IDS = WIRE_COLORS.map((c) => c.id)
