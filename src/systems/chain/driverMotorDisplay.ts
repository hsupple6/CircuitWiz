import type { WireConnection } from '../../modules/types'
import { resolveLogicModule } from '../../modules/logicModule'
import { calculateMotorElectricalProperties } from '../../modules/output/voltageFlow/Motor'
import { omitPwm, parseNumericProperty, posKey } from './utils'
import type { GridCellLike, SolvedComponentState } from './types'
import { getPlacedComponents, getTerminals } from './components/registry'

const LOGIC_PWM_HIGH = 5.0

type Point = { x: number; y: number }

function cellAt(gridData: GridCellLike[][], x: number, y: number): GridCellLike | undefined {
  return gridData[y]?.[x]
}

function stateAt(
  gridData: GridCellLike[][],
  x: number,
  y: number,
  componentStates: Map<string, SolvedComponentState>
): SolvedComponentState | undefined {
  const cell = cellAt(gridData, x, y)
  if (!cell?.occupied || cell.componentId === undefined) return undefined
  return componentStates.get(`${cell.componentId}-${cell.cellIndex ?? 0}`)
}

function pwmAtPoint(
  gridData: GridCellLike[][],
  x: number,
  y: number,
  wires: WireConnection[],
  componentStates: Map<string, SolvedComponentState>
): number | undefined {
  const st = stateAt(gridData, x, y, componentStates)
  if (st?.pwm !== undefined) return st.pwm

  for (const wire of wires) {
    for (const segment of wire.segments) {
      for (const pt of [segment.from, segment.to]) {
        if (pt.x !== x || pt.y !== y) continue
        if (segment.pwm !== undefined) return segment.pwm
        if (wire.pwm !== undefined) return wire.pwm
      }
    }
  }
  return undefined
}

function isGroundPinCell(moduleCell: { type?: string; pin?: string }): boolean {
  return moduleCell.type === 'GND' || moduleCell.pin === 'GND'
}

function isPowerPinCell(moduleCell: { type?: string; pin?: string }): boolean {
  return (
    moduleCell.type === 'VCC' ||
    moduleCell.type === 'DRIVER_PWR' ||
    moduleCell.pin === '5V' ||
    moduleCell.pin === 'VBAT' ||
    moduleCell.pin === 'VIN' ||
    moduleCell.pin === '+'
  )
}

function supplyVoltageAtCell(cell: GridCellLike): number {
  const props = cell.moduleDefinition?.properties as Record<string, unknown> | undefined
  const v = props?.voltage
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'default' in (v as object)) {
    return parseNumericProperty(v, 5)
  }
  const moduleCell = cell.moduleDefinition?.grid?.[cell.cellIndex ?? 0]
  if (moduleCell?.voltage != null) return moduleCell.voltage as number
  return 5
}

/** Walk wire segments from a pin to see if it reaches a source/ground. */
function tracePinViaWires(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  start: Point,
  mode: 'power' | 'ground',
  componentStates: Map<string, SolvedComponentState>,
  visited = new Set<string>()
): boolean {
  const key = `${start.x},${start.y}`
  if (visited.has(key)) return false
  visited.add(key)

  const cell = cellAt(gridData, start.x, start.y)
  if (cell?.occupied && cell.moduleDefinition) {
    const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
    if (mode === 'ground' && isGroundPinCell(moduleCell)) return true
    if (mode === 'power' && isPowerPinCell(moduleCell)) return true
    if (mode === 'power' && resolveLogicModule(cell.moduleDefinition) === 'PowerSupply') {
      return supplyVoltageAtCell(cell) > 3
    }
    const st = stateAt(gridData, start.x, start.y, componentStates)
    if (mode === 'power' && (st?.isPowered || (st?.outputVoltage ?? 0) > 3)) return true
  }

  for (const wire of wires) {
    for (const segment of wire.segments) {
      const endpoints: Point[] = [segment.from, segment.to]
      const touches = endpoints.some((pt) => pt.x === start.x && pt.y === start.y)
      if (!touches) continue
      if (mode === 'power' && (wire.isPowered || segment.isPowered)) return true
      if (mode === 'ground' && (wire.isGrounded || segment.isGrounded)) return true
      for (const next of endpoints) {
        if (next.x === start.x && next.y === start.y) continue
        if (tracePinViaWires(gridData, wires, next, mode, componentStates, visited)) return true
      }
    }
  }
  return false
}

function stampPinState(
  componentId: string,
  cellIndex: number,
  x: number,
  y: number,
  moduleType: string,
  componentStates: Map<string, SolvedComponentState>,
  patch: Partial<SolvedComponentState>
): void {
  const cellComponentId = `${componentId}-${cellIndex}`
  const existing = componentStates.get(cellComponentId)
  componentStates.set(cellComponentId, {
    componentId: cellComponentId,
    componentType: moduleType,
    position: { x, y },
    outputVoltage: 0,
    outputCurrent: 0,
    power: 0,
    status: 'inactive',
    isPowered: false,
    isGrounded: false,
    ...existing,
    ...patch,
  })
}

function propagatePwmFromPins(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  componentStates: Map<string, SolvedComponentState>
): WireConnection[] {
  return wires.map((wire) => {
    let wirePWM: number | undefined

    const segments = wire.segments.map((segment) => {
      let segPwm: number | undefined
      for (const pt of [segment.from, segment.to]) {
        const pwm = pwmAtPoint(gridData, pt.x, pt.y, wires, componentStates)
        if (pwm !== undefined) {
          segPwm = pwm
          wirePWM = pwm
        }
      }
      if (segPwm === undefined) return omitPwm(segment)
      return { ...omitPwm(segment), isPowered: true, pwm: segPwm }
    })

    if (wirePWM === undefined) return { ...omitPwm(wire), segments }
    return { ...omitPwm(wire), isPowered: true, pwm: wirePWM, segments }
  })
}

export interface EscMotorDisplayContext {
  netVoltages?: Map<number, number>
  posToNet?: Map<string, number>
  activeNets?: Set<number>
}

/**
 * ESC inherits throttle PWM on its PWM pin; when VBAT+GND are connected, U/V/W drive the motor.
 */
export function applyEscMotorDisplay(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  componentStates: Map<string, SolvedComponentState>,
  ctx: EscMotorDisplayContext = {}
): WireConnection[] {
  let updatedWires = wires
  const components = getPlacedComponents(gridData)

  for (const component of components) {
    const moduleType = resolveLogicModule(component.moduleDefinition)
    if (moduleType !== 'EscDriver') continue

    const terminals = getTerminals(component)
    const pwmTerm = terminals.find((t) => t.moduleCell.pin === 'PWM')
    const vbatTerm = terminals.find((t) => t.moduleCell.pin === 'VBAT')
    const gndTerm = terminals.find((t) => t.moduleCell.pin === 'GND')

    const throttle = pwmTerm
      ? pwmAtPoint(gridData, pwmTerm.x, pwmTerm.y, updatedWires, componentStates)
      : undefined

    if (pwmTerm && throttle !== undefined) {
      stampPinState(
        component.componentId,
        pwmTerm.cellIndex,
        pwmTerm.x,
        pwmTerm.y,
        moduleType,
        componentStates,
        {
          pwm: throttle,
          status: 'pwm',
          isPowered: throttle > 0,
          outputVoltage: (throttle / 100) * LOGIC_PWM_HIGH,
        }
      )
    }

    const hasVbat =
      vbatTerm &&
      (tracePinViaWires(
        gridData,
        updatedWires,
        { x: vbatTerm.x, y: vbatTerm.y },
        'power',
        componentStates
      ) ||
        (ctx.posToNet &&
          ctx.netVoltages &&
          ctx.activeNets?.has(ctx.posToNet.get(posKey(vbatTerm.x, vbatTerm.y)) ?? -1) &&
          (ctx.netVoltages.get(ctx.posToNet.get(posKey(vbatTerm.x, vbatTerm.y))!) ?? 0) > 6))

    const hasGnd =
      gndTerm &&
      (tracePinViaWires(
        gridData,
        updatedWires,
        { x: gndTerm.x, y: gndTerm.y },
        'ground',
        componentStates
      ) ||
        (ctx.posToNet &&
          gndTerm &&
          ctx.activeNets?.has(ctx.posToNet.get(posKey(gndTerm.x, gndTerm.y)) ?? -1)))

    const escPowered = Boolean(hasVbat && hasGnd)
    const throttleActive = throttle !== undefined && throttle > 0

    let packVoltage = 11.1
    if (vbatTerm) {
      const vbatCell = cellAt(gridData, vbatTerm.x, vbatTerm.y)
      if (vbatCell) {
        const traced = findSupplyVoltageAlongWires(gridData, updatedWires, vbatTerm.x, vbatTerm.y)
        if (traced > 0) packVoltage = traced
        else if (ctx.posToNet && ctx.netVoltages) {
          const net = ctx.posToNet.get(posKey(vbatTerm.x, vbatTerm.y))
          if (net !== undefined) packVoltage = ctx.netVoltages.get(net) ?? packVoltage
        }
      }
    }

    if (escPowered && throttleActive) {
      for (const phase of ['U', 'V', 'W'] as const) {
        const phaseTerm = terminals.find((t) => t.moduleCell.pin === phase)
        if (!phaseTerm) continue
        stampPinState(
          component.componentId,
          phaseTerm.cellIndex,
          phaseTerm.x,
          phaseTerm.y,
          moduleType,
          componentStates,
          {
            pwm: throttle,
            status: 'pwm',
            isPowered: true,
            outputVoltage: packVoltage,
            outputCurrent: 0,
            power: 0,
          }
        )
      }
    }
  }

  updatedWires = propagatePwmFromPins(gridData, updatedWires, componentStates)

  for (const component of components) {
    if (resolveLogicModule(component.moduleDefinition) !== 'Motor') continue

    const terminals = getTerminals(component)
    const phaseTerms = terminals.filter((t) => ['IN1', 'IN2', 'IN3'].includes(t.moduleCell.pin ?? ''))

    let motorPwm: number | undefined
    let motorVoltage = 0
    for (const phase of phaseTerms) {
      const pwm = pwmAtPoint(gridData, phase.x, phase.y, updatedWires, componentStates)
      if (pwm !== undefined && (motorPwm === undefined || pwm > motorPwm)) motorPwm = pwm
      const st = stateAt(gridData, phase.x, phase.y, componentStates)
      if ((st?.outputVoltage ?? 0) > motorVoltage) motorVoltage = st!.outputVoltage!
    }

    if (motorPwm === undefined || motorPwm <= 0) continue

    const props = component.moduleDefinition.properties ?? {}
    const motorProperties = {
      inputVoltage: motorVoltage > 0 ? motorVoltage : 12,
      kv: parseNumericProperty(props.kv, 1000),
      resistance: parseNumericProperty(props.resistance, 0.1),
      maxRPM: parseNumericProperty(props.maxRPM, 20000),
      efficiency: parseNumericProperty(props.efficiency, 85),
      poles: parseNumericProperty(props.poles, 14),
    }

    const motorResult = calculateMotorElectricalProperties(
      motorProperties.inputVoltage,
      motorProperties,
      motorPwm
    )

    component.moduleDefinition.grid.forEach(
      (moduleCell: { x: number; y: number; pin?: string }, cellIndex: number) => {
        const x = component.baseX + moduleCell.x
        const y = component.baseY + moduleCell.y
        const isPhase = ['IN1', 'IN2', 'IN3'].includes(moduleCell.pin ?? '')
        stampPinState(component.componentId, cellIndex, x, y, 'Motor', componentStates, {
          pwm: motorPwm,
          outputVoltage: isPhase ? motorVoltage : motorResult.outputVoltage,
          outputCurrent: motorResult.outputCurrent,
          power: motorResult.power,
          status: motorResult.actualRPM > 0 ? 'active' : 'inactive',
          isPowered: motorResult.actualRPM > 0,
          isGrounded: false,
          motorRPM: motorResult.actualRPM,
          instantaneousRPM: motorResult.instantaneousRPM,
          motorTorque: motorResult.instantaneousTorque,
          instantaneousTorque: motorResult.instantaneousTorque,
          backEMF: motorResult.backEMF,
          mechanicalPower: motorResult.mechanicalPower,
          angularVelocity: motorResult.angularVelocity,
        })
      }
    )
  }

  return propagatePwmFromPins(gridData, updatedWires, componentStates)
}

function findSupplyVoltageAlongWires(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  startX: number,
  startY: number,
  visited = new Set<string>()
): number {
  const key = `${startX},${startY}`
  if (visited.has(key)) return 0
  visited.add(key)

  const cell = cellAt(gridData, startX, startY)
  if (cell?.occupied && cell.moduleDefinition) {
    const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
    if (isPowerPinCell(moduleCell) || resolveLogicModule(cell.moduleDefinition) === 'PowerSupply') {
      return supplyVoltageAtCell(cell)
    }
  }

  let best = 0
  for (const wire of wires) {
    for (const segment of wire.segments) {
      for (const pt of [segment.from, segment.to]) {
        if (pt.x !== startX || pt.y !== startY) continue
        const other = pt === segment.from ? segment.to : segment.from
        best = Math.max(best, findSupplyVoltageAlongWires(gridData, wires, other.x, other.y, visited))
      }
    }
  }
  return best
}

/** Logic-level PWM duty for driver ctrl pins (throttle), not ctrl/supply ratio. */
export function driverThrottleDuty(
  channel: { netCtrl: number; netGnd: number; pwmMode: boolean },
  voltages: number[]
): number {
  if (!channel.pwmMode) return 1
  const ctrlV = Math.max(0, (voltages[channel.netCtrl] ?? 0) - (voltages[channel.netGnd] ?? 0))
  return Math.min(1, ctrlV / LOGIC_PWM_HIGH)
}
