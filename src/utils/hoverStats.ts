import type { WireConnection, WireSegment, ModuleDefinition } from '../modules/types'
import type { ComponentState } from '../systems/ElectricalSystem'
import { formatCapacitance } from '../components/CapacitanceSelector'
import { formatInductance } from '../components/InductanceSelector'
import { formatCurrent, formatPower, formatResistance, formatVoltage } from './electricalFormatting'
import { readSupplyVoltageAndCurrent } from './powerSupplies'
import { formatBatteryCapacity, readBatteryCapacity } from './batteryVisual'
import {
  AC_WAVEFORM_LABELS,
  formatACFrequency,
  readACSourceSettings,
  vrmsToVpeak,
} from './acSourceVisual'

export type HoverStatAccent = 'voltage' | 'current' | 'power' | 'status' | 'info' | 'success' | 'warn' | 'idle'

export interface HoverStatRow {
  label: string
  value: string
  accent?: HoverStatAccent
}

export interface HoverStats {
  kind: 'wire' | 'component' | 'cell'
  title: string
  subtitle?: string
  componentType?: string
  position: { x: number; y: number }
  status?: { label: string; tone: 'active' | 'idle' | 'warn' | 'error' | 'pwm' }
  metrics: HoverStatRow[]
  details: HoverStatRow[]
}

interface GridCellLike {
  occupied?: boolean
  componentId?: string
  componentType?: string
  moduleDefinition?: { module?: string; grid?: Array<{ x: number; y: number; pin?: string; type?: string }>; properties?: Record<string, unknown> }
  cellIndex?: number
  resistance?: number
  capacitance?: number
  inductance?: number
  isOn?: boolean
  isPowered?: boolean
  voltage?: number
  current?: number
}

function segmentPassesThroughCell(segment: WireSegment, cellX: number, cellY: number): boolean {
  const { from, to } = segment
  if (from.x === to.x && from.y === to.y) return from.x === cellX && from.y === cellY
  if (from.y === to.y) {
    const minX = Math.min(from.x, to.x)
    const maxX = Math.max(from.x, to.x)
    return from.y === cellY && cellX >= minX && cellX <= maxX
  }
  if (from.x === to.x) {
    const minY = Math.min(from.y, to.y)
    const maxY = Math.max(from.y, to.y)
    return from.x === cellX && cellY >= minY && cellY <= maxY
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const slope = dy / dx
  const intercept = from.y - slope * from.x
  const expectedY = slope * cellX + intercept
  return (
    Math.abs(expectedY - cellY) <= 0.5 &&
    cellX >= Math.min(from.x, to.x) &&
    cellX <= Math.max(from.x, to.x)
  )
}

function findWireAt(x: number, y: number, wires: WireConnection[]): { wire: WireConnection; segment: WireSegment } | null {
  for (const wire of wires) {
    for (const segment of wire.segments) {
      if (segmentPassesThroughCell(segment, x, y)) return { wire, segment }
    }
  }
  return null
}

function getNumericProperty(properties: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const val = properties?.[key]
  if (typeof val === 'number') return val
  if (val && typeof val === 'object' && 'default' in val && typeof (val as { default: unknown }).default === 'number') {
    return (val as { default: number }).default
  }
  return fallback
}

function findModuleOrigin(
  gridData: GridCellLike[][],
  x: number,
  y: number,
  moduleId: string
): { x: number; y: number } | null {
  const isModuleOrigin = (gx: number, gy: number) => {
    const cell = gridData[gy]?.[gx]
    if (!cell?.occupied || cell.componentId !== moduleId) return false
    const leftCell = gx > 0 ? gridData[gy]?.[gx - 1] : null
    const topCell = gy > 0 ? gridData[gy - 1]?.[gx] : null
    const isLeftEdge = !leftCell?.occupied || leftCell.componentId !== moduleId
    const isTopEdge = !topCell?.occupied || topCell.componentId !== moduleId
    return isLeftEdge && isTopEdge
  }

  for (let dy = 0; dy < 25; dy++) {
    for (let dx = 0; dx < 10; dx++) {
      const checkX = x - dx
      const checkY = y - dy
      if (checkX >= 0 && checkY >= 0 && isModuleOrigin(checkX, checkY)) {
        return { x: checkX, y: checkY }
      }
    }
  }
  return null
}

function resolveComponentState(
  componentId: string,
  cellIndex: number,
  componentStates: Map<string, ComponentState>
): ComponentState | undefined {
  const keys = [`${componentId}-${cellIndex}`, `${componentId}-0`, componentId]
  for (const key of keys) {
    const state = componentStates.get(key)
    if (state) return state
  }
  let best: ComponentState | undefined
  for (const [key, state] of componentStates) {
    if (key.startsWith(`${componentId}-`) || key === componentId) {
      if (!best || (state.outputVoltage ?? 0) > (best.outputVoltage ?? 0)) best = state
    }
  }
  return best
}

function primaryMetrics(voltage: number, current: number, power?: number): HoverStatRow[] {
  const p = power ?? voltage * current
  return [
    { label: 'Voltage', value: formatVoltage(voltage), accent: 'voltage' },
    { label: 'Current', value: formatCurrent(current), accent: 'current' },
    { label: 'Power', value: formatPower(p), accent: 'power' },
  ]
}

function buildWireStats(
  x: number,
  y: number,
  hit: { wire: WireConnection; segment: WireSegment }
): HoverStats {
  const { wire, segment } = hit
  const voltage = segment.voltage ?? wire.voltage ?? 0
  const current = segment.current ?? wire.current ?? 0
  const power = segment.power ?? wire.power ?? voltage * current
  const pwm = segment.pwm ?? wire.pwm

  const details: HoverStatRow[] = []
  if (pwm !== undefined) details.push({ label: 'PWM duty', value: `${pwm.toFixed(1)}%`, accent: 'info' })
  details.push({
    label: 'Connection',
    value: wire.isPowered ? (wire.isGrounded ? 'Ground rail' : 'Live') : 'Unpowered',
    accent: wire.isPowered ? 'success' : 'idle',
  })
  if (wire.gauge) {
    details.push({ label: 'Gauge', value: `${wire.gauge} AWG`, accent: 'info' })
    if (wire.maxCurrent) {
      const pct = wire.maxCurrent > 0 ? Math.min(100, (current / wire.maxCurrent) * 100) : 0
      details.push({
        label: 'Load',
        value: `${pct.toFixed(0)}% of ${formatCurrent(wire.maxCurrent)} max`,
        accent: pct > 85 ? 'warn' : 'info',
      })
    }
  }

  return {
    kind: 'wire',
    title: 'Wire',
    subtitle: `Segment at (${x}, ${y})`,
    position: { x, y },
    status: wire.isPowered
      ? { label: pwm !== undefined ? 'PWM signal' : 'Powered', tone: pwm !== undefined ? 'pwm' : 'active' }
      : { label: 'Idle', tone: 'idle' },
    metrics: primaryMetrics(voltage, current, power),
    details,
  }
}

function buildComponentStats(
  x: number,
  y: number,
  cell: GridCellLike,
  gridData: GridCellLike[][],
  componentStates: Map<string, ComponentState>
): HoverStats {
  const moduleName = cell.moduleDefinition?.module ?? cell.componentType ?? 'Component'
  const componentId = cell.componentId!
  const cellIndex = cell.cellIndex ?? 0
  const origin = findModuleOrigin(gridData, x, y, componentId)
  const relX = origin ? x - origin.x : 0
  const relY = origin ? y - origin.y : 0
  const pinCell = cell.moduleDefinition?.grid?.find((c) => c.x === relX && c.y === relY)
  const state = resolveComponentState(componentId, cellIndex, componentStates)

  const voltage = state?.outputVoltage ?? cell.voltage ?? 0
  const current = state?.outputCurrent ?? cell.current ?? 0
  const power = state?.power ?? voltage * current
  const details: HoverStatRow[] = []

  if (pinCell?.pin) details.push({ label: 'Pin', value: pinCell.pin, accent: 'info' })
  if (pinCell?.type) details.push({ label: 'Pin type', value: pinCell.type, accent: 'info' })

  let status: HoverStats['status']
  let metrics = primaryMetrics(voltage, current, power)

  switch (moduleName) {
    case 'LED': {
      const forwardV = state?.forwardVoltage ?? getNumericProperty(cell.moduleDefinition?.properties, 'forwardVoltage', 2)
      const anodeV = state?.inputVoltage ?? state?.outputVoltage ?? voltage
      const isOn =
        (state?.isOn ?? false) &&
        anodeV > 0.01 &&
        anodeV >= forwardV - 0.05 &&
        current > 1e-6
      const isPwm = state?.status === 'pwm'
      const color =
        (cell.moduleDefinition?.properties?.color as { default?: string } | string | undefined) &&
        typeof cell.moduleDefinition?.properties?.color === 'object'
          ? (cell.moduleDefinition.properties.color as { default?: string }).default ?? 'Red'
          : String(cell.moduleDefinition?.properties?.color ?? 'Red')
      status = isPwm
        ? { label: 'PWM', tone: 'pwm' }
        : isOn
          ? { label: 'On', tone: 'active' }
          : { label: 'Off', tone: 'idle' }
      if (state?.inputVoltage !== undefined) {
        details.push({ label: 'Input', value: formatVoltage(state.inputVoltage), accent: 'voltage' })
      }
      details.push({ label: 'Forward drop', value: formatVoltage(forwardV), accent: 'info' })
      details.push({ label: 'Color', value: String(color), accent: 'info' })
      break
    }
    case 'Resistor': {
      const r = cell.resistance ?? getNumericProperty(cell.moduleDefinition?.properties, 'resistance', 1000)
      status = current > 1e-9 ? { label: 'Conducting', tone: 'active' } : { label: 'Idle', tone: 'idle' }
      details.push({ label: 'Resistance', value: formatResistance(r), accent: 'info' })
      if (state?.voltageDrop !== undefined) {
        details.push({ label: 'Voltage drop', value: formatVoltage(state.voltageDrop), accent: 'voltage' })
      }
      break
    }
    case 'Capacitor': {
      const c =
        cell.capacitance ?? getNumericProperty(cell.moduleDefinition?.properties, 'capacitance', 0.0001)
      const chargeLabel = Math.abs(voltage) < 0.05 ? 'Discharged' : Math.abs(voltage) > 4 ? 'Charged' : 'Partially charged'
      const chargePct = Math.min(100, (Math.abs(voltage) / 5) * 100)
      status =
        chargeLabel === 'Discharged'
          ? { label: 'Discharged', tone: 'idle' }
          : { label: chargeLabel, tone: 'active' }
      details.push({ label: 'Capacitance', value: formatCapacitance(c), accent: 'info' })
      details.push({
        label: 'Charge',
        value: chargeLabel === 'Partially charged' ? `${chargePct.toFixed(0)}%` : chargeLabel,
        accent: chargeLabel === 'Discharged' ? 'idle' : 'success',
      })
      const energy = 0.5 * c * voltage * voltage
      if (energy > 1e-12) {
        details.push({ label: 'Stored energy', value: formatPower(energy).replace('W', 'J').replace('mW', 'mJ'), accent: 'info' })
      }
      break
    }
    case 'Inductor': {
      const l = cell.inductance ?? getNumericProperty(cell.moduleDefinition?.properties, 'inductance', 0.001)
      status = current > 1e-9 ? { label: 'Energized', tone: 'active' } : { label: 'Idle', tone: 'idle' }
      details.push({ label: 'Inductance', value: formatInductance(l), accent: 'info' })
      break
    }
    case 'Diode': {
      const vf = getNumericProperty(cell.moduleDefinition?.properties, 'forwardVoltage', 0.7)
      const isOn = state?.isOn ?? state?.status === 'conducting'
      status = isOn ? { label: 'Conducting', tone: 'active' } : { label: 'Off', tone: 'idle' }
      details.push({ label: 'Vf', value: formatVoltage(vf), accent: 'info' })
      break
    }
    case 'ZenerDiode': {
      const vz = getNumericProperty(cell.moduleDefinition?.properties, 'zenerVoltage', 5.1)
      const mode = state?.zenerMode ?? state?.status
      status =
        mode === 'clamping' || mode === 'zener'
          ? { label: 'Clamping', tone: 'active' }
          : mode === 'conducting'
            ? { label: 'Forward', tone: 'active' }
            : { label: 'Off', tone: 'idle' }
      details.push({ label: 'Vz', value: formatVoltage(vz), accent: 'info' })
      break
    }
    case 'NPNTransistor': {
      const isOn = state?.isOn ?? state?.status === 'saturated'
      status = isOn ? { label: 'Saturated', tone: 'active' } : { label: 'Off', tone: 'idle' }
      details.push({
        label: 'β',
        value: String(getNumericProperty(cell.moduleDefinition?.properties, 'beta', 100)),
        accent: 'info',
      })
      break
    }
    case 'OpAmp': {
      status = state?.isPowered ? { label: 'Active', tone: 'active' } : { label: 'Idle', tone: 'idle' }
      details.push({
        label: 'Supply',
        value: formatVoltage(getNumericProperty(cell.moduleDefinition?.properties, 'supplyVoltage', 5)),
        accent: 'info',
      })
      break
    }
    case 'BridgeRectifier': {
      status = state?.isPowered ? { label: 'Rectifying', tone: 'active' } : { label: 'Idle', tone: 'idle' }
      break
    }
    case 'ACSource': {
      const settings = readACSourceSettings(cell.moduleDefinition?.properties as Record<string, unknown> | undefined)
      status = { label: 'AC', tone: 'active' }
      details.push({ label: 'Waveform', value: AC_WAVEFORM_LABELS[settings.waveform], accent: 'info' })
      details.push({ label: 'Vrms', value: formatVoltage(settings.vrms), accent: 'info' })
      details.push({
        label: 'Vpeak',
        value: formatVoltage(vrmsToVpeak(settings.vrms, settings.waveform)),
        accent: 'voltage',
      })
      details.push({ label: 'Frequency', value: formatACFrequency(settings.frequency), accent: 'info' })
      break
    }
    case 'Switch':
    case 'Push Button':
    case 'Limit Switch': {
      const isOn = cell.isOn ?? state?.isOn ?? false
      status = isOn ? { label: 'Closed', tone: 'active' } : { label: 'Open', tone: 'idle' }
      details.push({
        label: 'Contact',
        value: isOn ? 'Closed (conducting)' : 'Open (isolated)',
        accent: isOn ? 'success' : 'info',
      })
      break
    }
    case 'Motor': {
      const rpm = state?.instantaneousRPM ?? state?.motorRPM ?? 0
      const torque = state?.torque ?? state?.instantaneousTorque ?? 0
      status = rpm > 1 ? { label: 'Spinning', tone: 'active' } : { label: 'Stopped', tone: 'idle' }
      metrics = [
        { label: 'Voltage', value: formatVoltage(voltage), accent: 'voltage' },
        { label: 'Current', value: formatCurrent(current), accent: 'current' },
        { label: 'Power', value: formatPower(power), accent: 'power' },
      ]
      details.push({ label: 'RPM', value: rpm.toFixed(0), accent: 'info' })
      details.push({ label: 'Torque', value: `${torque.toFixed(3)} N·m`, accent: 'info' })
      if (state?.backEMF !== undefined) {
        details.push({ label: 'Back EMF', value: formatVoltage(state.backEMF), accent: 'voltage' })
      }
      break
    }
    case 'PowerSupply':
    case 'Battery': {
      const { voltage: nominal, current: maxA } = readSupplyVoltageAndCurrent(
        cell.moduleDefinition as ModuleDefinition & { properties?: Record<string, unknown> }
      )
      status =
        state?.isPowered || Math.abs(nominal) > 1e-6
          ? { label: 'Supplying', tone: 'active' }
          : { label: 'Standby', tone: 'idle' }
      details.push({ label: 'Nominal', value: formatVoltage(nominal), accent: 'info' })
      if (moduleName === 'Battery') {
        const capacity = readBatteryCapacity(cell.moduleDefinition?.properties as Record<string, unknown> | undefined)
        details.push({ label: 'Capacity', value: formatBatteryCapacity(capacity), accent: 'info' })
      } else {
        details.push({ label: 'Max current', value: formatCurrent(maxA), accent: 'current' })
      }
      break
    }
    default: {
      status =
        state?.isPowered || voltage > 0.05
          ? { label: state?.status ?? 'Active', tone: 'active' }
          : { label: 'Unpowered', tone: 'idle' }
      if (state?.status && !['active', 'unpowered', 'on', 'off'].includes(state.status)) {
        details.push({ label: 'Status', value: state.status, accent: 'info' })
      }
      if (state?.pwm !== undefined) {
        details.push({ label: 'PWM', value: `${state.pwm.toFixed(1)}%`, accent: 'info' })
      }
    }
  }

  if (state?.isGrounded) details.push({ label: 'Ground', value: 'Connected', accent: 'warn' })

  return {
    kind: 'component',
    title: moduleName,
    subtitle: pinCell?.pin ? `${pinCell.pin} · (${x}, ${y})` : `(${x}, ${y})`,
    componentType: moduleName,
    position: { x, y },
    status,
    metrics,
    details,
  }
}

function buildEmptyCellStats(x: number, y: number): HoverStats {
  return {
    kind: 'cell',
    title: 'Grid cell',
    subtitle: `(${x}, ${y})`,
    position: { x, y },
    status: { label: 'Empty', tone: 'idle' },
    metrics: [
      { label: 'Voltage', value: formatVoltage(0), accent: 'voltage' },
      { label: 'Current', value: formatCurrent(0), accent: 'current' },
      { label: 'Power', value: formatPower(0), accent: 'power' },
    ],
    details: [{ label: 'Note', value: 'No component or wire here', accent: 'info' }],
  }
}

export function buildHoverStats(
  x: number,
  y: number,
  gridData: GridCellLike[][],
  wires: WireConnection[],
  componentStates: Map<string, ComponentState>
): HoverStats {
  const cell = gridData[y]?.[x]
  if (cell?.occupied && cell.componentId) {
    return buildComponentStats(x, y, cell, gridData, componentStates)
  }

  const wireHit = findWireAt(x, y, wires)
  if (wireHit) return buildWireStats(x, y, wireHit)

  return buildEmptyCellStats(x, y)
}
