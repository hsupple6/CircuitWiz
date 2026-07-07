import type { WireConnection, WireSegment, ModuleDefinition } from '../modules/types'
import { resolveLogicModule } from '../modules/logicModule'
import type { ComponentState } from '../systems/ElectricalSystem'
import { resolveLedModuleState } from '../systems/chain/ledDisplay'
import { formatCapacitance } from '../components/CapacitanceSelector'
import { formatInductance } from '../components/InductanceSelector'
import { formatCurrent, formatPower, formatResistance, formatVoltage } from './electricalFormatting'
import { readSupplyVoltageAndCurrent } from './powerSupplies'
import {
  AC_WAVEFORM_LABELS,
  formatACFrequency,
  readACSourceSettings,
  vrmsToVpeak,
  formatACVoltage,
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

function resolveBestComponentState(
  componentId: string,
  componentStates: Map<string, ComponentState>
): ComponentState | undefined {
  let best: ComponentState | undefined
  for (const [key, state] of componentStates) {
    if (!key.startsWith(`${componentId}-`) && key !== componentId) continue
    if (!best || (state.outputVoltage ?? 0) > (best.outputVoltage ?? 0)) best = state
  }
  return best
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
  return resolveBestComponentState(componentId, componentStates)
}

/** Prefer a connectable pin when inspecting a component body or label cell. */
export function resolveInspectPosition(
  x: number,
  y: number,
  gridData: GridCellLike[][],
  componentStates: Map<string, ComponentState>
): { x: number; y: number } {
  const cell = gridData[y]?.[x]
  if (!cell?.occupied || !cell.componentId) return { x, y }

  const moduleCell = cell.moduleDefinition?.grid[cell.cellIndex ?? 0]
  if (moduleCell?.isConnectable) return { x, y }

  const componentId = cell.componentId
  let best: { x: number; y: number } | null = null
  let bestVoltage = -1

  for (let gy = 0; gy < gridData.length; gy++) {
    const row = gridData[gy]
    if (!row) continue
    for (let gx = 0; gx < row.length; gx++) {
      const c = row[gx]
      if (c?.componentId !== componentId) continue
      const pinDef = c.moduleDefinition?.grid[c.cellIndex ?? 0]
      if (!pinDef?.isConnectable) continue
      const state = resolveComponentState(componentId, c.cellIndex ?? 0, componentStates)
      const voltage = state?.outputVoltage ?? 0
      if (!best || voltage > bestVoltage) {
        best = { x: gx, y: gy }
        bestVoltage = voltage
      }
    }
  }

  return best ?? { x, y }
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
  const logicModule =
    cell.moduleDefinition?.module != null
      ? resolveLogicModule(cell.moduleDefinition as ModuleDefinition)
      : moduleName
  const componentId = cell.componentId!
  const cellIndex = cell.cellIndex ?? 0
  const origin = findModuleOrigin(gridData, x, y, componentId)
  const relX = origin ? x - origin.x : 0
  const relY = origin ? y - origin.y : 0
  const pinCell = cell.moduleDefinition?.grid?.find((c) => c.x === relX && c.y === relY)
  const pinState = resolveComponentState(componentId, cellIndex, componentStates)
  const state =
    pinCell?.isConnectable === false
      ? resolveBestComponentState(componentId, componentStates) ?? pinState
      : pinState

  const voltage = state?.outputVoltage ?? cell.voltage ?? 0
  const current = state?.outputCurrent ?? cell.current ?? 0
  const power = state?.power ?? voltage * current
  const details: HoverStatRow[] = []

  if (pinCell?.pin) details.push({ label: 'Pin', value: pinCell.pin, accent: 'info' })
  if (pinCell?.type) details.push({ label: 'Pin type', value: pinCell.type, accent: 'info' })

  let status: HoverStats['status']
  let metrics = primaryMetrics(voltage, current, power)

  switch (logicModule) {
    case 'LED': {
      const ledState = resolveLedModuleState(componentId, componentStates) ?? state
      const forwardV = ledState?.forwardVoltage ?? getNumericProperty(cell.moduleDefinition?.properties, 'forwardVoltage', 2)
      const anodeV = ledState?.inputVoltage ?? ledState?.outputVoltage ?? voltage
      const ledCurrent = ledState?.outputCurrent ?? current
      const isOn =
        (ledState?.isOn ?? false) &&
        anodeV >= forwardV - 0.1 &&
        ledCurrent > 1e-6
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
      metrics = primaryMetrics(anodeV, ledCurrent, ledState?.power ?? anodeV * ledCurrent)
      if (ledState?.inputVoltage !== undefined) {
        details.push({ label: 'Input', value: formatVoltage(ledState.inputVoltage), accent: 'voltage' })
      }
      details.push({ label: 'Forward drop', value: formatVoltage(forwardV), accent: 'info' })
      details.push({ label: 'Color', value: String(color), accent: 'info' })
      break
    }
    case 'RGBLED': {
      const channel = state?.ledChannel as string | undefined
      const forwardV =
        channel === 'R'
          ? getNumericProperty(cell.moduleDefinition?.properties, 'forwardVoltageR', 2)
          : channel === 'G'
            ? getNumericProperty(cell.moduleDefinition?.properties, 'forwardVoltageG', 3)
            : channel === 'B'
              ? getNumericProperty(cell.moduleDefinition?.properties, 'forwardVoltageB', 3)
              : 2
      const isOn = (state?.isOn ?? false) && current > 1e-6
      status = isOn
        ? { label: channel ? `${channel} On` : 'On', tone: 'active' }
        : { label: 'Off', tone: 'idle' }
      details.push({ label: 'Channel', value: channel ?? 'RGB', accent: 'info' })
      details.push({ label: 'Forward drop', value: formatVoltage(forwardV), accent: 'info' })
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
      const vc = state?.capacitorVoltage ?? 0
      const chargeCurrent = state?.outputCurrent ?? current
      const storedEnergy = state?.power ?? 0.5 * c * vc * vc
      const capStatus = state?.status
      const chargeLabel =
        capStatus === 'charged'
          ? 'Charged'
          : capStatus === 'charging'
            ? 'Partially charged'
            : 'Discharged'
      const chargePct = Math.min(100, (Math.abs(vc) / 5) * 100)
      status =
        chargeLabel === 'Discharged'
          ? { label: 'Discharged', tone: 'idle' }
          : capStatus === 'charging'
            ? { label: 'Charging', tone: 'active' }
            : { label: chargeLabel, tone: 'active' }
      metrics = primaryMetrics(vc, chargeCurrent, storedEnergy)
      details.push({ label: 'Capacitance', value: formatCapacitance(c), accent: 'info' })
      details.push({
        label: 'Charge',
        value: chargeLabel === 'Partially charged' ? `${chargePct.toFixed(0)}%` : chargeLabel,
        accent: chargeLabel === 'Discharged' ? 'idle' : 'success',
      })
      if (typeof state?.terminalVoltage === 'number' && pinCell?.pin) {
        details.push({ label: 'Terminal', value: formatVoltage(state.terminalVoltage), accent: 'voltage' })
      }
      if (storedEnergy > 1e-12) {
        details.push({ label: 'Stored energy', value: formatPower(storedEnergy).replace('W', 'J').replace('mW', 'mJ'), accent: 'info' })
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
    case 'NPNTransistor':
    case 'PNPTransistor': {
      const isOn = state?.isOn ?? state?.status === 'saturated'
      status = isOn ? { label: 'Saturated', tone: 'active' } : { label: 'Off', tone: 'idle' }
      details.push({
        label: 'β',
        value: String(getNumericProperty(cell.moduleDefinition?.properties, 'beta', 100)),
        accent: 'info',
      })
      break
    }
    case 'MOSFET':
    case 'PMOSFET': {
      const isOn = state?.isOn ?? state?.status === 'on'
      status = isOn ? { label: 'On', tone: 'active' } : { label: 'Off', tone: 'idle' }
      details.push({
        label: 'Vth',
        value: formatVoltage(getNumericProperty(cell.moduleDefinition?.properties, 'vth', 2.5)),
        accent: 'info',
      })
      details.push({
        label: 'Rds(on)',
        value: formatResistance(getNumericProperty(cell.moduleDefinition?.properties, 'rdsOn', 0.05)),
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
      const vf = getNumericProperty(cell.moduleDefinition?.properties, 'forwardVoltage', 0.7)
      const pin = cell.moduleDefinition?.grid[cell.cellIndex ?? 0]?.pin
      if (pin === '+') {
        status = state?.isPowered ? { label: 'Vdc out', tone: 'active' } : { label: 'Idle', tone: 'idle' }
        details.push({ label: 'Output', value: 'Rectified DC', accent: 'info' })
      } else if (pin === '-') {
        status = { label: 'DC −', tone: 'idle' }
      } else if (pin === 'AC1' || pin === 'AC2') {
        status = { label: 'AC in', tone: 'active' }
        details.push({ label: 'Input', value: 'AC peak (DC snapshot)', accent: 'info' })
      } else {
        status = state?.isPowered ? { label: 'Rectifying', tone: 'active' } : { label: 'Idle', tone: 'idle' }
      }
      details.push({ label: 'Vf (each diode)', value: formatVoltage(vf), accent: 'info' })
      break
    }
    case 'ACSource': {
      const settings = readACSourceSettings(cell.moduleDefinition?.properties as Record<string, unknown> | undefined)
      const vpeak = vrmsToVpeak(settings.vrms, settings.waveform)
      const pin = pinCell?.pin
      const displayV =
        pin === 'AC2' ? 0 : voltage > 0.05 ? voltage : vpeak
      const displayI = current > 1e-9 ? current : state?.outputCurrent ?? 0
      metrics = primaryMetrics(displayV, displayI, displayV * displayI)
      status = { label: `${formatACVoltage(settings.vrms)} AC`, tone: 'active' }
      details.push({ label: 'Waveform', value: AC_WAVEFORM_LABELS[settings.waveform], accent: 'info' })
      details.push({ label: 'Vrms', value: formatVoltage(settings.vrms), accent: 'info' })
      details.push({
        label: 'Vpeak',
        value: formatVoltage(vpeak),
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
    case 'Potentiometer': {
      const wiper = cell.wiperPosition ?? 0.5
      status = { label: `${Math.round(wiper * 100)}% wiper`, tone: 'active' }
      details.push({ label: 'Wiper', value: `${Math.round(wiper * 100)}%`, accent: 'info' })
      break
    }
    case 'LinearRegulator': {
      status = { label: 'ADJ feedback', tone: voltage > 0.5 ? 'active' : 'idle' }
      details.push({
        label: 'Control',
        value: 'Vout set by OUT→ADJ→GND divider',
        accent: 'info',
      })
      if (voltage > 0.01) {
        details.push({ label: 'Pin', value: formatVoltage(voltage), accent: 'voltage' })
      }
      break
    }
    case 'PowerDriver': {
      status = { label: formatVoltage(voltage), tone: voltage > 0.5 ? 'active' : 'idle' }
      details.push({ label: 'Vout', value: formatVoltage(voltage), accent: 'voltage' })
      break
    }
    case 'FixedRegulator': {
      const vout = getNumericProperty(
        cell.moduleDefinition?.properties as Record<string, unknown> | undefined,
        'outputVoltage',
        3.3
      )
      status = { label: formatVoltage(voltage), tone: voltage > 0.5 ? 'active' : 'idle' }
      details.push({ label: 'Vout (set)', value: formatVoltage(vout), accent: 'info' })
      if (voltage > 0.01) {
        details.push({ label: 'Pin', value: formatVoltage(voltage), accent: 'voltage' })
      }
      break
    }
    case 'LogicGateIC': {
      const vth = getNumericProperty(
        cell.moduleDefinition?.properties as Record<string, unknown> | undefined,
        'vth',
        2.5
      )
      const isHigh = voltage >= vth - 0.05
      const isOutput = pinCell?.type === 'DRIVER_OUT'
      status = {
        label: isOutput ? (isHigh ? 'HIGH' : 'LOW') : isHigh ? 'Logic 1' : 'Logic 0',
        tone: isHigh ? 'active' : 'idle',
      }
      if (pinCell?.pin) {
        details.push({
          label: isOutput ? 'Driven' : 'Level',
          value: isHigh ? 'HIGH' : 'LOW',
          accent: isHigh ? 'success' : 'idle',
        })
      }
      details.push({ label: 'Vth', value: formatVoltage(vth), accent: 'info' })
      if (voltage > 0.01 || isOutput) {
        details.push({ label: 'Voltage', value: formatVoltage(voltage), accent: 'voltage' })
      }
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
    case 'StepperMotor': {
      const coilA = state?.stepperCoilA ?? state?.coilPair === 'A'
      const coilB = state?.stepperCoilB ?? state?.coilPair === 'B'
      const active = coilA || coilB
      status = active ? { label: 'Stepping', tone: 'active' } : { label: 'Idle', tone: 'idle' }
      details.push({ label: 'Coil A', value: coilA ? 'Energized' : 'Off', accent: coilA ? 'success' : 'idle' })
      details.push({ label: 'Coil B', value: coilB ? 'Energized' : 'Off', accent: coilB ? 'success' : 'idle' })
      break
    }
    case 'PowerSupply': {
      const { voltage: nominal, current: maxA } = readSupplyVoltageAndCurrent(
        cell.moduleDefinition as ModuleDefinition & { properties?: Record<string, unknown> }
      )
      status =
        state?.isPowered || Math.abs(nominal) > 1e-6
          ? { label: 'Supplying', tone: 'active' }
          : { label: 'Standby', tone: 'idle' }
      details.push({ label: 'Nominal', value: formatVoltage(nominal), accent: 'info' })
      details.push({ label: 'Max current', value: formatCurrent(maxA), accent: 'current' })
      break
    }
    default: {
      const isPwm = state?.status === 'pwm' || state?.pwm !== undefined
      status = isPwm
        ? { label: `PWM ${(state?.pwm ?? 0).toFixed(0)}%`, tone: 'pwm' }
        : state?.isPowered || voltage > 0.05
          ? { label: state?.status ?? 'Active', tone: 'active' }
          : { label: 'Unpowered', tone: 'idle' }
      if (state?.status && !['active', 'unpowered', 'on', 'off', 'pwm'].includes(state.status)) {
        details.push({ label: 'Status', value: state.status, accent: 'info' })
      }
      if (state?.pwm !== undefined) {
        details.push({ label: 'PWM duty', value: `${state.pwm.toFixed(1)}%`, accent: 'info' })
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
