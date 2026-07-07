import { resolveLogicModule } from '../../modules/logicModule'
import type { WireConnection } from '../../modules/types'
import { gpioOutputVoltage, gpioPinNumber, isMicrocontrollerModule } from './components/registry'
import { buildCircuitGraph, canTraverse } from './graph'
import type { GridCellLike, PlacedComponent } from './types'
import { posKey } from './utils'

interface MosfetLike {
  netGate: number
  netDrain: number
  netSource: number
  vth: number
  componentId: string
  polarity: 'n' | 'p'
}

interface InductorLike {
  netA: number
  netB: number
  componentId: string
}

interface DiodeLike {
  netAnode: number
  netCathode: number
  forwardVoltage: number
  componentId: string
}

interface VoltageSourceLike {
  netPos: number
  netNeg: number
  voltage: number
}

export interface BoostConverterStamp {
  componentId: string
  mosfetId: string
  diodeId: string
  inductorId: string
  netVin: number
  netSwitch: number
  netVout: number
  netGate: number
  groundNet: number
  vinNominal: number
  diodeVf: number
  defaultDuty: number
}

function isGroundNet(net: number, groundNet: number): boolean {
  return net === groundNet
}

function vinNetFromInductor(
  inductor: InductorLike,
  switchNet: number,
  voltageSources: VoltageSourceLike[],
  groundNet: number
): { netVin: number; vinNominal: number } | null {
  const other = inductor.netA === switchNet ? inductor.netB : inductor.netB === switchNet ? inductor.netA : null
  if (other === null || isGroundNet(other, groundNet)) return null

  const source = voltageSources.find((vs) => vs.netPos === other)
  if (source) return { netVin: other, vinNominal: source.voltage }

  return { netVin: other, vinNominal: 0 }
}

function gateDutyFromGpio(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  components: PlacedComponent[],
  netGate: number,
  posToNet: Map<string, number>,
  gpioStates?: Map<number, unknown>
): number | null {
  if (!gpioStates?.size) return null

  const graph = buildCircuitGraph(gridData, wires)
  const gateKeys = [...graph.terminals.entries()]
    .filter(([, terminal]) => posToNet.get(terminal.key) === netGate)
    .map(([key]) => key)
  if (gateKeys.length === 0) return null

  for (const component of components) {
    if (!isMicrocontrollerModule(component.moduleDefinition)) continue
    const moduleType = resolveLogicModule(component.moduleDefinition)
    for (const cell of component.moduleDefinition.grid ?? []) {
      if (cell.type !== 'GPIO' && cell.type !== 'ANALOG') continue
      const x = component.baseX + cell.x
      const y = component.baseY + cell.y
      const key = posKey(x, y)
      const pin = gpioPinNumber(cell)
      if (pin === null) continue
      const reachesGate = gateKeys.some((gateKey) => canTraverse(graph, key, gateKey))
      if (!reachesGate) continue
      const gpioState = gpioStates.get(pin)
      const output = gpioOutputVoltage(moduleType, gpioState)
      if (!output.active) return 0
      if (gpioState && (gpioState as { state?: string }).state === 'PULSING') {
        const duty = typeof (gpioState as { value?: number }).value === 'number'
          ? (gpioState as { value: number }).value
          : 0.5
        return Math.min(0.92, Math.max(0.01, duty))
      }
      return 0.85
    }
  }

  // Gate may be RC-separated from the GPIO pin net (e.g. series gate resistor)
  let pulsingDuty: number | null = null
  gpioStates.forEach((state) => {
    if ((state as { state?: string })?.state !== 'PULSING') return
    const duty =
      typeof (state as { value?: number }).value === 'number'
        ? (state as { value: number }).value
        : 0.5
    pulsingDuty = Math.min(0.92, Math.max(0.01, duty))
  })
  if (pulsingDuty !== null) return pulsingDuty

  return null
}

export function detectBoostConverters(params: {
  mosfets: MosfetLike[]
  inductors: InductorLike[]
  diodes: DiodeLike[]
  voltageSources: VoltageSourceLike[]
  components: PlacedComponent[]
  groundNet: number
}): BoostConverterStamp[] {
  const { mosfets, inductors, diodes, voltageSources, components, groundNet } = params
  const stamps: BoostConverterStamp[] = []

  for (const mosfet of mosfets) {
    if (mosfet.polarity !== 'n') continue
    if (!isGroundNet(mosfet.netSource, groundNet)) continue

    const switchNet = mosfet.netDrain
    const inductor = inductors.find(
      (l) => l.netA === switchNet || l.netB === switchNet
    )
    if (!inductor) continue

    const vinInfo = vinNetFromInductor(inductor, switchNet, voltageSources, groundNet)
    if (!vinInfo) continue

    const diode = diodes.find((d) => d.netAnode === switchNet && d.netCathode !== switchNet)
    if (!diode) continue

    const mosfetComponent = components.find((c) => c.componentId === mosfet.componentId)
    const defaultDuty = parseBoostDutyProperty(mosfetComponent)

    stamps.push({
      componentId: `boost-${mosfet.componentId}`,
      mosfetId: mosfet.componentId,
      diodeId: diode.componentId,
      inductorId: inductor.componentId,
      netVin: vinInfo.netVin,
      netSwitch: switchNet,
      netVout: diode.netCathode,
      netGate: mosfet.netGate,
      groundNet,
      vinNominal: vinInfo.vinNominal,
      diodeVf: diode.forwardVoltage,
      defaultDuty,
    })
  }

  return stamps
}

function parseBoostDutyProperty(component: PlacedComponent | undefined): number {
  const raw = component?.moduleDefinition?.properties?.pwmDuty
  const value =
    typeof raw === 'number'
      ? raw
      : raw && typeof raw === 'object' && 'default' in raw
        ? Number((raw as { default: unknown }).default)
        : 0.4
  if (!Number.isFinite(value)) return 0.4
  return Math.min(0.9, Math.max(0.05, value))
}

export function resolveBoostDuty(
  stamp: BoostConverterStamp,
  gridData: GridCellLike[][],
  wires: WireConnection[],
  components: PlacedComponent[],
  posToNet: Map<string, number>,
  gpioStates: Map<number, unknown> | undefined,
  gateVoltage: number,
  sourceVoltage: number,
  vth: number
): number | null {
  const gpioDuty = gateDutyFromGpio(gridData, wires, components, stamp.netGate, posToNet, gpioStates)
  if (gpioDuty !== null) return gpioDuty

  if (stamp.defaultDuty > 0) return stamp.defaultDuty

  if (gateVoltage - sourceVoltage >= vth - 0.05) return stamp.defaultDuty
  return null
}

/** Ideal CCM boost output: Vout ≈ Vin / (1 − D) − diode drop. */
export function boostRegulatedVoltage(vin: number, duty: number, diodeVf: number): number {
  if (duty <= 0.01 || duty >= 0.95 || vin <= 0) return 0
  return Math.max(vin, vin / (1 - duty) - diodeVf)
}
