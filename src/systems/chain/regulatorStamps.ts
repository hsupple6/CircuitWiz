import { resolveLogicModule } from '../../modules/logicModule'
import { getPlacedComponents, getTerminals, getWiperRatio } from './components/registry'
import { parseNumericProperty, posKey } from './utils'
import type { GridCellLike, PlacedComponent } from './types'

type ResistorStamp = {
  netA: number
  netB: number
  resistance: number
  componentId: string
}

type VoltageSourceStamp = {
  netPos: number
  netNeg: number
  voltage: number
  componentId: string
}

type TerminalLike = {
  x: number
  y: number
  moduleCell: {
    type?: string
    pin?: string
  }
}

export interface RegulatorStamp {
  componentId: string
  moduleType: string
  netVin: number
  netVout: number
  netGnd: number
  netAdj?: number
  vref: number
  /** Fixed target for non-adjustable regulators (PowerDriver). */
  fixedTargetVout?: number
  dropout: number
  seriesResistance: number
  quiescentResistance: number
}

const LM317_MAX_VOUT = 37

function findTerminal(
  terminals: TerminalLike[],
  pred: (t: TerminalLike) => boolean
): TerminalLike | undefined {
  return terminals.find(pred)
}

function stampResistor(
  resistors: ResistorStamp[],
  netA: number,
  netB: number,
  resistance: number,
  componentId: string
): void {
  if (netA === netB) return
  resistors.push({ netA, netB, resistance, componentId })
}

function parallelResistance(a: number | null, b: number): number {
  if (b <= 0 || !Number.isFinite(b)) return a ?? b
  if (a === null || a <= 0) return b
  return (a * b) / (a + b)
}

function resistanceBetweenNets(
  netA: number,
  netB: number,
  resistors: ResistorStamp[],
  skipComponentId?: string
): number | null {
  let equivalent: number | null = null
  resistors.forEach((r) => {
    if (skipComponentId && r.componentId.startsWith(skipComponentId)) return
    const matches =
      (r.netA === netA && r.netB === netB) || (r.netA === netB && r.netB === netA)
    if (!matches) return
    equivalent = parallelResistance(equivalent, Math.max(r.resistance, 1e-6))
  })
  return equivalent
}

/** LM317 classic divider: Vout = Vref × (1 + R2/R1) where R1 is OUT→ADJ, R2 is ADJ→GND. */
function feedbackFromPotentiometers(
  gridData: GridCellLike[][],
  posToNet: Map<string, number>,
  netVout: number,
  netAdj: number,
  netGnd: number
): { rOutAdj: number | null; rAdjGnd: number | null } {
  let rOutAdj: number | null = null
  let rAdjGnd: number | null = null

  getPlacedComponents(gridData).forEach((component) => {
    if (resolveLogicModule(component.moduleDefinition) !== 'Potentiometer') return

    const terminals = getTerminals(component)
    const a = terminals.find((t) => t.moduleCell.pin === 'A')
    const w = terminals.find((t) => t.moduleCell.pin === 'W')
    const b = terminals.find((t) => t.moduleCell.pin === 'B')
    if (!a || !w || !b) return

    const netA = posToNet.get(posKey(a.x, a.y))
    const netW = posToNet.get(posKey(w.x, w.y))
    const netB = posToNet.get(posKey(b.x, b.y))
    if (netW !== netAdj) return

    const total = parseNumericProperty(component.moduleDefinition.properties?.resistance, 10000)
    const ratio = Math.min(0.999, Math.max(0.001, getWiperRatio(gridData, w.x, w.y)))
    const rTop = total * (1 - ratio)
    const rBottom = total * ratio

    if (netA === netVout) rOutAdj = parallelResistance(rOutAdj, rTop)
    if (netB === netGnd) rAdjGnd = parallelResistance(rAdjGnd, rBottom)
  })

  return { rOutAdj, rAdjGnd }
}

export function computeLm317TargetVout(
  reg: RegulatorStamp,
  gridData: GridCellLike[][],
  posToNet: Map<string, number>,
  baseResistors: ResistorStamp[]
): number {
  if (reg.moduleType !== 'LinearRegulator' || reg.netAdj === undefined) {
    return reg.fixedTargetVout ?? reg.vref
  }

  const pot = feedbackFromPotentiometers(
    gridData,
    posToNet,
    reg.netVout,
    reg.netAdj,
    reg.netGnd
  )

  if (pot.rOutAdj !== null && pot.rAdjGnd !== null) {
    const target = reg.vref * (1 + pot.rAdjGnd / pot.rOutAdj)
    return Math.min(LM317_MAX_VOUT, Math.max(reg.vref, target))
  }

  let r1 = resistanceBetweenNets(reg.netVout, reg.netAdj, baseResistors, reg.componentId)
  let r2 = resistanceBetweenNets(reg.netAdj, reg.netGnd, baseResistors, reg.componentId)

  if (r1 === null || r1 <= 0 || r2 === null || r2 <= 0) {
    return reg.vref
  }

  const target = reg.vref * (1 + r2 / r1)
  return Math.min(LM317_MAX_VOUT, Math.max(reg.vref, target))
}

export function collectRegulatorStamps(
  moduleType: string,
  component: PlacedComponent,
  terminals: TerminalLike[],
  posToNet: Map<string, number>
): { regulators: RegulatorStamp[]; resistors: ResistorStamp[]; errors: string[] } {
  const regulators: RegulatorStamp[] = []
  const resistors: ResistorStamp[] = []
  const errors: string[] = []

  const vin = findTerminal(
    terminals,
    (t) =>
      t.moduleCell.type === 'DRIVER_PWR' ||
      t.moduleCell.pin === 'VIN' ||
      t.moduleCell.pin === 'VCC'
  )
  const vout = findTerminal(
    terminals,
    (t) => t.moduleCell.type === 'DRIVER_OUT' || t.moduleCell.pin === 'VOUT'
  )
  const gnd = findTerminal(
    terminals,
    (t) => t.moduleCell.type === 'GND' || t.moduleCell.pin === 'GND'
  )
  const adj =
    moduleType === 'LinearRegulator'
      ? findTerminal(terminals, (t) => t.moduleCell.pin === 'ADJ')
      : undefined

  if (!vin || !vout || !gnd) {
    errors.push(`${moduleType} ${component.componentId} is missing VIN, VOUT, or GND`)
    return { regulators, resistors, errors }
  }

  const netVin = posToNet.get(posKey(vin.x, vin.y))
  const netVout = posToNet.get(posKey(vout.x, vout.y))
  const netGnd = posToNet.get(posKey(gnd.x, gnd.y))
  const netAdj = adj ? posToNet.get(posKey(adj.x, adj.y)) : undefined

  if (netVin === undefined || netVout === undefined || netGnd === undefined) {
    return { regulators, resistors, errors }
  }

  const props = component.moduleDefinition.properties ?? {}
  const vref = parseNumericProperty(props.vref, 1.25)
  const fixedTargetVout =
    moduleType === 'PowerDriver' || moduleType === 'FixedRegulator'
      ? parseNumericProperty(props.outputVoltage, moduleType === 'FixedRegulator' ? 3.3 : 5)
      : undefined
  const dropout = parseNumericProperty(
    props.dropout,
    moduleType === 'LinearRegulator' ? 2 : moduleType === 'FixedRegulator' ? 1.1 : 0.3
  )
  const seriesResistance = parseNumericProperty(props.seriesResistance, 0.1)
  const iq = parseNumericProperty(props.quiescentCurrent, 0.005)
  const quiescentResistance = iq > 0 ? 1000 / iq : 10000

  regulators.push({
    componentId: component.componentId,
    moduleType,
    netVin,
    netVout,
    netGnd,
    netAdj,
    vref,
    fixedTargetVout,
    dropout,
    seriesResistance,
    quiescentResistance,
  })

  stampResistor(resistors, netVin, netGnd, quiescentResistance, `${component.componentId}_iq`)

  return { regulators, resistors, errors }
}

export function buildRegulatorSources(
  regulators: RegulatorStamp[],
  voltages: number[] | undefined,
  supplySources: VoltageSourceStamp[],
  gridData: GridCellLike[][],
  posToNet: Map<string, number>,
  baseResistors: ResistorStamp[]
): { voltageSources: VoltageSourceStamp[]; resistors: ResistorStamp[] } {
  const voltageSources: VoltageSourceStamp[] = []
  const resistors: ResistorStamp[] = []

  regulators.forEach((reg) => {
    const supplyVin = supplySources.find((s) => s.netPos === reg.netVin)?.voltage ?? 0
    const vin = Math.max(voltages?.[reg.netVin] ?? 0, supplyVin)

    const target =
      reg.moduleType === 'LinearRegulator'
        ? computeLm317TargetVout(reg, gridData, posToNet, baseResistors)
        : (reg.fixedTargetVout ?? reg.vref)

    const headroom = vin - target
    if (vin > 0.5 && headroom >= reg.dropout - 0.05) {
      voltageSources.push({
        netPos: reg.netVout,
        netNeg: reg.netGnd,
        voltage: target,
        componentId: reg.componentId,
      })
      if (reg.seriesResistance > 0) {
        stampResistor(
          resistors,
          reg.netVout,
          reg.netGnd,
          reg.seriesResistance,
          `${reg.componentId}_rout`
        )
      }
    } else if (vin > 0.1) {
      const passR = Math.max(reg.seriesResistance, 0.5)
      stampResistor(resistors, reg.netVin, reg.netVout, passR, `${reg.componentId}_dropout`)
    }
  })

  return { voltageSources, resistors }
}
