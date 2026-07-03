/**
 * Modified Nodal Analysis engine — mathematics only.
 * Topology and voltage propagation live in the parent chain/ folder.
 */

import { WireConnection } from '../../../modules/types'
import { validateSourceChains } from '../graph'
import { buildSystemChains } from '../chains'
import {
  findAnodeCathode,
  getPlacedComponents,
  getTerminals,
  getWiperRatio,
  gpioOutputVoltage,
  gpioPinNumber,
  gridCellAt,
  isGroundReference,
  isPositiveTerminal,
  isSwitchClosedOnGrid,
  parseNumericProperty,
} from '../components/registry'
import type { ChainSolveResult, GridCellLike, PlacedComponent, SolvedComponentState, TerminalInfo } from '../types'
import { posKey, UnionFind } from '../utils'
import { isConnectable, isGroundTerminal } from '../terminals'
import { propagateVoltages } from '../propagate'
import { isNetGrounded } from '../nets'

export type { SolvedComponentState, GridCellLike, PlacedComponent, TerminalInfo }
export type CircuitSolveResult = ChainSolveResult

interface ResistorStamp {
  netA: number
  netB: number
  resistance: number
  componentId: string
}

interface VoltageSourceStamp {
  netPos: number
  netNeg: number
  voltage: number
  componentId: string
  cellIndex?: number
  pwm?: number
}

interface LedStamp {
  netAnode: number
  netCathode: number
  forwardVoltage: number
  seriesResistance: number
  componentId: string
  maxCurrent: number
  isOn: boolean
}

interface DiodeStamp {
  netAnode: number
  netCathode: number
  forwardVoltage: number
  seriesResistance: number
  componentId: string
  isOn: boolean
}

interface ZenerStamp {
  netAnode: number
  netCathode: number
  forwardVoltage: number
  zenerVoltage: number
  seriesResistance: number
  componentId: string
  mode: 'off' | 'forward' | 'zener'
}

interface CapacitorStamp {
  netA: number
  netB: number
  capacitance: number
  storedVoltage: number
  componentId: string
}

interface NpnStamp {
  netBase: number
  netCollector: number
  netEmitter: number
  vbe: number
  vceSat: number
  componentId: string
  isOn: boolean
}

interface OpAmpStamp {
  netNonInv: number
  netInv: number
  netOut: number
  netVee: number
  gain: number
  vcc: number
  componentId: string
  outputVoltage: number
}

interface BridgeStamp {
  netAc1: number
  netAc2: number
  netPlus: number
  netMinus: number
  forwardVoltage: number
  componentId: string
}

const CAP_CHARGE_DT = 0.05

function diodeHasForwardBias(
  anodeVoltage: number,
  cathodeVoltage: number,
  forwardVoltage: number
): boolean {
  return anodeVoltage - cathodeVoltage >= forwardVoltage - 0.05
}

function zenerMode(
  anodeVoltage: number,
  cathodeVoltage: number,
  forwardVoltage: number,
  zenerVoltage: number
): 'off' | 'forward' | 'zener' {
  if (anodeVoltage - cathodeVoltage >= forwardVoltage - 0.05) return 'forward'
  if (cathodeVoltage - anodeVoltage >= zenerVoltage - 0.05) return 'zener'
  return 'off'
}

function ledForwardDrop(anodeVoltage: number, cathodeVoltage: number): number {
  return anodeVoltage - cathodeVoltage
}

/** LED conducts only with positive forward bias above Vf. */
function ledHasForwardBias(
  anodeVoltage: number,
  cathodeVoltage: number,
  forwardVoltage: number
): boolean {
  const vDrop = ledForwardDrop(anodeVoltage, cathodeVoltage)
  return anodeVoltage > 0.01 && vDrop >= forwardVoltage - 0.05
}

function solveLinearSystem(matrix: number[][], rhs: number[]): number[] | null {
  const n = matrix.length
  if (n === 0) return []
  const aug = matrix.map((row, i) => [...row, rhs[i]])

  for (let col = 0; col < n; col++) {
    let pivotRow = col
    let pivotVal = Math.abs(aug[col][col])
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col])
      if (val > pivotVal) {
        pivotVal = val
        pivotRow = row
      }
    }
    if (pivotVal < 1e-12) return null

    if (pivotRow !== col) {
      const tmp = aug[col]
      aug[col] = aug[pivotRow]
      aug[pivotRow] = tmp
    }

    const pivot = aug[col][col]
    for (let j = col; j <= n; j++) aug[col][j] /= pivot

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      if (Math.abs(factor) < 1e-15) continue
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }
  }

  return aug.map((row) => row[n])
}

function solveMNA(
  nodeCount: number,
  groundNet: number,
  resistors: ResistorStamp[],
  voltageSources: VoltageSourceStamp[],
  leds: LedStamp[],
  diodes: DiodeStamp[] = [],
  zeners: ZenerStamp[] = [],
  capacitors: CapacitorStamp[] = [],
  npns: NpnStamp[] = [],
  opAmps: OpAmpStamp[] = []
): { voltages: number[]; sourceCurrents: number[] } | null {
  const nodeToUnknown = new Map<number, number>()
  let unknownNodeCount = 0
  for (let net = 0; net < nodeCount; net++) {
    if (net === groundNet) continue
    nodeToUnknown.set(net, unknownNodeCount++)
  }

  const activeLeds = leds.filter((led) => led.isOn)
  const activeDiodes = diodes.filter((d) => d.isOn)
  const activeZeners = zeners.filter((z) => z.mode !== 'off')
  const activeNpns = npns.filter((t) => t.isOn)

  const ledAsSources: VoltageSourceStamp[] = activeLeds.map((led) => ({
    netPos: led.netAnode,
    netNeg: led.netCathode,
    voltage: led.forwardVoltage,
    componentId: led.componentId,
  }))
  const diodeAsSources: VoltageSourceStamp[] = activeDiodes.map((d) => ({
    netPos: d.netAnode,
    netNeg: d.netCathode,
    voltage: d.forwardVoltage,
    componentId: d.componentId,
  }))
  const zenerAsSources: VoltageSourceStamp[] = activeZeners.map((z) =>
    z.mode === 'forward'
      ? { netPos: z.netAnode, netNeg: z.netCathode, voltage: z.forwardVoltage, componentId: z.componentId }
      : { netPos: z.netCathode, netNeg: z.netAnode, voltage: z.zenerVoltage, componentId: z.componentId }
  )
  const capAsSources: VoltageSourceStamp[] = capacitors.map((c) => ({
    netPos: c.netA,
    netNeg: c.netB,
    voltage: c.storedVoltage,
    componentId: c.componentId,
  }))
  const npnAsSources: VoltageSourceStamp[] = activeNpns.map((t) => ({
    netPos: t.netCollector,
    netNeg: t.netEmitter,
    voltage: t.vceSat,
    componentId: t.componentId,
  }))
  const opAmpAsSources: VoltageSourceStamp[] = opAmps.map((op) => ({
    netPos: op.netOut,
    netNeg: op.netVee,
    voltage: op.outputVoltage,
    componentId: op.componentId,
  }))

  const ledResistors: ResistorStamp[] = activeLeds.map((led) => ({
    netA: led.netAnode,
    netB: led.netCathode,
    resistance: led.seriesResistance,
    componentId: `${led.componentId}_led_r`,
  }))
  const diodeResistors: ResistorStamp[] = activeDiodes.map((d) => ({
    netA: d.netAnode,
    netB: d.netCathode,
    resistance: d.seriesResistance,
    componentId: `${d.componentId}_d_r`,
  }))
  const zenerResistors: ResistorStamp[] = activeZeners.map((z) => ({
    netA: z.mode === 'forward' ? z.netAnode : z.netCathode,
    netB: z.mode === 'forward' ? z.netCathode : z.netAnode,
    resistance: z.seriesResistance,
    componentId: `${z.componentId}_z_r`,
  }))
  const npnResistors: ResistorStamp[] = activeNpns.map((t) => ({
    netA: t.netCollector,
    netB: t.netEmitter,
    resistance: 0.5,
    componentId: `${t.componentId}_ce_r`,
  }))

  const allVoltageSources = [
    ...voltageSources,
    ...ledAsSources,
    ...diodeAsSources,
    ...zenerAsSources,
    ...capAsSources,
    ...npnAsSources,
    ...opAmpAsSources,
  ]
  const allResistors = [...resistors, ...ledResistors, ...diodeResistors, ...zenerResistors, ...npnResistors]

  const size = unknownNodeCount + allVoltageSources.length
  if (size === 0) {
    const voltages = Array.from({ length: nodeCount }, () => 0)
    return { voltages, sourceCurrents: [] }
  }

  const matrix: number[][] = Array.from({ length: size }, () => Array(size).fill(0))
  const rhs: number[] = Array(size).fill(0)

  const nodeIndex = (net: number): number => {
    if (net === groundNet) return -1
    return nodeToUnknown.get(net)!
  }

  for (const resistor of allResistors) {
    const r = Math.max(resistor.resistance, 1e-9)
    const g = 1 / r
    const i = nodeIndex(resistor.netA)
    const j = nodeIndex(resistor.netB)

    if (i >= 0) {
      matrix[i][i] += g
      if (j >= 0) {
        matrix[i][j] -= g
      }
    }
    if (j >= 0) {
      matrix[j][j] += g
      if (i >= 0) {
        matrix[j][i] -= g
      }
    }
  }

  allVoltageSources.forEach((source, sourceIdx) => {
    const col = unknownNodeCount + sourceIdx
    const pos = nodeIndex(source.netPos)
    const neg = nodeIndex(source.netNeg)

    if (pos >= 0) matrix[pos][col] += 1
    if (neg >= 0) matrix[neg][col] -= 1

    if (pos >= 0) matrix[col][pos] += 1
    if (neg >= 0) matrix[col][neg] -= 1
    rhs[col] = source.voltage
  })

  const solution = solveLinearSystem(matrix, rhs)
  if (!solution) return null

  const voltages = Array.from({ length: nodeCount }, () => 0)
  nodeToUnknown.forEach((idx, net) => {
    voltages[net] = solution[idx]
  })

  const sourceCurrents = allVoltageSources.map((_, idx) => solution[unknownNodeCount + idx])
  return { voltages, sourceCurrents }
}

function stampResistor(
  resistors: ResistorStamp[],
  netA: number | undefined,
  netB: number | undefined,
  resistance: number,
  componentId: string
) {
  if (netA === undefined || netB === undefined || netA === netB) return
  resistors.push({ netA, netB, resistance: Math.max(resistance, 1e-6), componentId })
}

function buildNets(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  gpioStates?: Map<number, any>
): {
  nodeCount: number
  groundNet: number
  posToNet: Map<string, number>
  resistors: ResistorStamp[]
  voltageSources: VoltageSourceStamp[]
  leds: LedStamp[]
  diodes: DiodeStamp[]
  zeners: ZenerStamp[]
  capacitors: CapacitorStamp[]
  npns: NpnStamp[]
  opAmps: OpAmpStamp[]
  bridges: BridgeStamp[]
  components: PlacedComponent[]
  errors: string[]
} {
  const components = getPlacedComponents(gridData)
  const posIndex = new Map<string, number>()
  const positions: Array<{ x: number; y: number }> = []

  const ensurePos = (x: number, y: number): number => {
    const key = posKey(x, y)
    let idx = posIndex.get(key)
    if (idx === undefined) {
      idx = positions.length
      posIndex.set(key, idx)
      positions.push({ x, y })
    }
    return idx
  }

  wires.forEach((wire) => {
    wire.segments.forEach((segment) => {
      ensurePos(segment.from.x, segment.from.y)
      ensurePos(segment.to.x, segment.to.y)
    })
  })

  components.forEach((component) => {
    getTerminals(component).forEach((terminal) => {
      ensurePos(terminal.x, terminal.y)
    })
  })

  const uf = new UnionFind(positions.length)

  wires.forEach((wire) => {
    wire.segments.forEach((segment) => {
      const a = ensurePos(segment.from.x, segment.from.y)
      const b = ensurePos(segment.to.x, segment.to.y)
      uf.union(a, b)
    })
  })

  const groundIndices: number[] = []
  components.forEach((component) => {
    getTerminals(component).forEach((terminal) => {
      const idx = ensurePos(terminal.x, terminal.y)
      if (isGroundReference(terminal.moduleCell)) {
        groundIndices.push(idx)
      }
    })
  })

  groundIndices.forEach((gnd) => {
    groundIndices.forEach((other) => uf.union(gnd, other))
  })

  const rootToNet = new Map<number, number>()
  const posToNet = new Map<string, number>()
  let nodeCount = 0
  positions.forEach((pos, idx) => {
    const root = uf.find(idx)
    let net = rootToNet.get(root)
    if (net === undefined) {
      net = nodeCount++
      rootToNet.set(root, net)
    }
    posToNet.set(posKey(pos.x, pos.y), net)
  })

  let groundNet = 0
  if (groundIndices.length > 0) {
    groundNet = posToNet.get(posKey(positions[groundIndices[0]].x, positions[groundIndices[0]].y)) ?? 0
  }

  const resistors: ResistorStamp[] = []
  const voltageSources: VoltageSourceStamp[] = []
  const leds: LedStamp[] = []
  const diodes: DiodeStamp[] = []
  const zeners: ZenerStamp[] = []
  const capacitors: CapacitorStamp[] = []
  const npns: NpnStamp[] = []
  const opAmps: OpAmpStamp[] = []
  const bridges: BridgeStamp[] = []
  const errors: string[] = []
  const processedComponents = new Set<string>()

  components.forEach((component) => {
    const moduleType = component.moduleDefinition.module
    if (processedComponents.has(component.componentId)) return
    processedComponents.add(component.componentId)

    const terminals = getTerminals(component)

    if (moduleType === 'Resistor') {
      const leads = terminals.filter((t) => t.moduleCell.type === 'LEAD')
      if (leads.length < 2) {
        errors.push(`Resistor ${component.componentId} is missing terminals`)
        return
      }
      const netA = posToNet.get(posKey(leads[0].x, leads[0].y))
      const netB = posToNet.get(posKey(leads[1].x, leads[1].y))
      if (netA === undefined || netB === undefined) return

      const resistance = parseNumericProperty(
        component.resistance ??
          component.moduleDefinition.properties?.resistance,
        1000
      )

      resistors.push({
        netA,
        netB,
        resistance,
        componentId: component.componentId,
      })
      return
    }

    if (moduleType === 'Battery' || moduleType === 'PowerSupply') {
      const positive = terminals.find((t) => isPositiveTerminal(t.moduleCell))
      const negative = terminals.find((t) => isGroundReference(t.moduleCell))
      if (!positive || !negative) {
        errors.push(`${moduleType} ${component.componentId} is missing power terminals`)
        return
      }
      const netPos = posToNet.get(posKey(positive.x, positive.y))
      const netNeg = posToNet.get(posKey(negative.x, negative.y))
      if (netPos === undefined || netNeg === undefined) return

      const voltage = parseNumericProperty(
        positive.moduleCell.voltage ?? component.moduleDefinition.properties?.voltage,
        5
      )

      voltageSources.push({
        netPos,
        netNeg,
        voltage,
        componentId: component.componentId,
      })
      return
    }

    if (moduleType === 'ACSource') {
      const ac1 = terminals.find((t) => t.moduleCell.pin === 'AC1')
      const ac2 = terminals.find((t) => t.moduleCell.pin === 'AC2')
      if (!ac1 || !ac2) {
        errors.push(`ACSource ${component.componentId} is missing AC terminals`)
        return
      }
      const netPos = posToNet.get(posKey(ac1.x, ac1.y))
      const netNeg = posToNet.get(posKey(ac2.x, ac2.y))
      if (netPos === undefined || netNeg === undefined) return

      const vrms = parseNumericProperty(component.moduleDefinition.properties?.vrms, 12)
      const vpeak = vrms * Math.SQRT2

      voltageSources.push({
        netPos,
        netNeg,
        voltage: vpeak,
        componentId: component.componentId,
      })
      return
    }

    if (moduleType === 'LED') {
      const { anode, cathode } = findAnodeCathode(terminals)
      if (!anode || !cathode) {
        errors.push(`LED ${component.componentId} is missing terminals`)
        return
      }
      const netAnode = posToNet.get(posKey(anode.x, anode.y))
      const netCathode = posToNet.get(posKey(cathode.x, cathode.y))
      if (netAnode === undefined || netCathode === undefined) return

      const forwardVoltage = parseNumericProperty(
        component.moduleDefinition.properties?.forwardVoltage ?? anode.moduleCell.voltage,
        2
      )
      const maxCurrent = parseNumericProperty(
        component.moduleDefinition.properties?.maxCurrent ?? anode.moduleCell.current,
        0.02
      )

      leds.push({
        netAnode,
        netCathode,
        forwardVoltage,
        seriesResistance: 10,
        componentId: component.componentId,
        maxCurrent,
        isOn: false,
      })
      return
    }

    if (moduleType === 'Diode') {
      const { anode, cathode } = findAnodeCathode(terminals)
      if (!anode || !cathode) return
      const netAnode = posToNet.get(posKey(anode.x, anode.y))
      const netCathode = posToNet.get(posKey(cathode.x, cathode.y))
      if (netAnode === undefined || netCathode === undefined) return
      const forwardVoltage = parseNumericProperty(component.moduleDefinition.properties?.forwardVoltage, 0.7)
      diodes.push({
        netAnode,
        netCathode,
        forwardVoltage,
        seriesResistance: 0.5,
        componentId: component.componentId,
        isOn: false,
      })
      return
    }

    if (moduleType === 'ZenerDiode') {
      const { anode, cathode } = findAnodeCathode(terminals)
      if (!anode || !cathode) return
      const netAnode = posToNet.get(posKey(anode.x, anode.y))
      const netCathode = posToNet.get(posKey(cathode.x, cathode.y))
      if (netAnode === undefined || netCathode === undefined) return
      zeners.push({
        netAnode,
        netCathode,
        forwardVoltage: parseNumericProperty(component.moduleDefinition.properties?.forwardVoltage, 0.7),
        zenerVoltage: parseNumericProperty(component.moduleDefinition.properties?.zenerVoltage, 5.1),
        seriesResistance: 0.5,
        componentId: component.componentId,
        mode: 'off',
      })
      return
    }

    if (moduleType === 'NPNTransistor') {
      const base = terminals.find((t) => t.moduleCell.pin === 'B' || t.moduleCell.type === 'BASE')
      const collector = terminals.find((t) => t.moduleCell.pin === 'C' || t.moduleCell.type === 'COLLECTOR')
      const emitter = terminals.find((t) => t.moduleCell.pin === 'E' || t.moduleCell.type === 'EMITTER')
      if (!base || !collector || !emitter) return
      const netBase = posToNet.get(posKey(base.x, base.y))
      const netCollector = posToNet.get(posKey(collector.x, collector.y))
      const netEmitter = posToNet.get(posKey(emitter.x, emitter.y))
      if (netBase === undefined || netCollector === undefined || netEmitter === undefined) return
      npns.push({
        netBase,
        netCollector,
        netEmitter,
        vbe: parseNumericProperty(component.moduleDefinition.properties?.vbe, 0.65),
        vceSat: parseNumericProperty(component.moduleDefinition.properties?.vceSat, 0.2),
        componentId: component.componentId,
        isOn: false,
      })
      return
    }

    if (moduleType === 'OpAmp') {
      const nonInv = terminals.find((t) => t.moduleCell.pin === '+' || t.moduleCell.type === 'IN_POSITIVE')
      const inv = terminals.find((t) => t.moduleCell.pin === '-' || t.moduleCell.type === 'IN_NEGATIVE')
      const out = terminals.find((t) => t.moduleCell.pin === 'OUT' || t.moduleCell.type === 'OUTPUT')
      const vee = terminals.find((t) => t.moduleCell.pin === 'V-' || t.moduleCell.type === 'GND')
      if (!nonInv || !inv || !out || !vee) return
      const netNonInv = posToNet.get(posKey(nonInv.x, nonInv.y))
      const netInv = posToNet.get(posKey(inv.x, inv.y))
      const netOut = posToNet.get(posKey(out.x, out.y))
      const netVee = posToNet.get(posKey(vee.x, vee.y))
      if (netNonInv === undefined || netInv === undefined || netOut === undefined || netVee === undefined) return
      opAmps.push({
        netNonInv,
        netInv,
        netOut,
        netVee,
        gain: parseNumericProperty(component.moduleDefinition.properties?.openLoopGain, 100000),
        vcc: parseNumericProperty(component.moduleDefinition.properties?.supplyVoltage, 5),
        componentId: component.componentId,
        outputVoltage: 0,
      })
      return
    }

    if (moduleType === 'BridgeRectifier') {
      const ac1 = terminals.find((t) => t.moduleCell.pin === 'AC1')
      const ac2 = terminals.find((t) => t.moduleCell.pin === 'AC2')
      const plus = terminals.find((t) => t.moduleCell.pin === '+')
      const minus = terminals.find((t) => t.moduleCell.pin === '-')
      if (!ac1 || !ac2 || !plus || !minus) return
      const netAc1 = posToNet.get(posKey(ac1.x, ac1.y))
      const netAc2 = posToNet.get(posKey(ac2.x, ac2.y))
      const netPlus = posToNet.get(posKey(plus.x, plus.y))
      const netMinus = posToNet.get(posKey(minus.x, minus.y))
      if (netAc1 === undefined || netAc2 === undefined || netPlus === undefined || netMinus === undefined) return
      bridges.push({
        netAc1,
        netAc2,
        netPlus,
        netMinus,
        forwardVoltage: parseNumericProperty(component.moduleDefinition.properties?.forwardVoltage, 0.7),
        componentId: component.componentId,
      })
      return
    }

    if (moduleType === 'Capacitor') {
      const leads = terminals.filter((t) => t.moduleCell.type === 'LEAD')
      if (leads.length < 2) return
      const netA = posToNet.get(posKey(leads[0].x, leads[0].y))
      const netB = posToNet.get(posKey(leads[1].x, leads[1].y))
      if (netA === undefined || netB === undefined) return

      let storedVoltage = 0
      gridData.forEach((row) => {
        row?.forEach((cell) => {
          if (cell?.componentId === component.componentId && typeof cell.capacitorVoltage === 'number') {
            storedVoltage = cell.capacitorVoltage
          }
        })
      })

      capacitors.push({
        netA,
        netB,
        capacitance: parseNumericProperty(
          (component as PlacedComponent & { capacitance?: number }).capacitance ??
            component.moduleDefinition.properties?.capacitance,
          0.0001
        ),
        storedVoltage,
        componentId: component.componentId,
      })
      return
    }

    if (moduleType === 'Inductor') {
      const leads = terminals.filter((t) => t.moduleCell.type === 'LEAD')
      if (leads.length < 2) return
      const netA = posToNet.get(posKey(leads[0].x, leads[0].y))
      const netB = posToNet.get(posKey(leads[1].x, leads[1].y))
      const dcr = parseNumericProperty(component.moduleDefinition.properties?.dcResistance, 0.5)
      stampResistor(resistors, netA, netB, dcr, component.componentId)
      return
    }

    if (moduleType === 'Switch' || moduleType === 'Push Button' || moduleType === 'Limit Switch') {
      const input = terminals.find((t) => t.moduleCell.type === 'INPUT')
      const output = terminals.find((t) => t.moduleCell.type === 'OUTPUT')
      if (!input || !output || !isSwitchClosedOnGrid(gridData, component.componentId)) return
      const netA = posToNet.get(posKey(input.x, input.y))
      const netB = posToNet.get(posKey(output.x, output.y))
      stampResistor(resistors, netA, netB, 0.01, component.componentId)
      return
    }

    if (moduleType === 'Buzzer' || moduleType === 'Speaker') {
      const positive = terminals.find(
        (t) =>
          t.moduleCell.pin === '+' ||
          t.moduleCell.type === 'VCC' ||
          (t.moduleCell.type === 'LEAD' && t.moduleCell.pin === '+')
      )
      const negative = terminals.find(
        (t) =>
          t.moduleCell.pin === '-' ||
          t.moduleCell.type === 'GND' ||
          (t.moduleCell.type === 'LEAD' && t.moduleCell.pin === '-')
      )
      if (!positive || !negative) return
      const netPos = posToNet.get(posKey(positive.x, positive.y))
      const netNeg = posToNet.get(posKey(negative.x, negative.y))
      const r = parseNumericProperty(component.moduleDefinition.properties?.resistance, moduleType === 'Speaker' ? 8 : 32)
      stampResistor(resistors, netPos, netNeg, r, component.componentId)
      return
    }

    if (moduleType === 'Servo') {
      const vcc = terminals.find((t) => t.moduleCell.type === 'VCC')
      const gnd = terminals.find((t) => t.moduleCell.type === 'GND')
      if (!vcc || !gnd) return
      const netPos = posToNet.get(posKey(vcc.x, vcc.y))
      const netNeg = posToNet.get(posKey(gnd.x, gnd.y))
      const r = parseNumericProperty(component.moduleDefinition.properties?.resistance, 50)
      stampResistor(resistors, netPos, netNeg, r, component.componentId)
      return
    }

    if (moduleType === 'Potentiometer') {
      const a = terminals.find((t) => t.moduleCell.pin === 'A')
      const w = terminals.find((t) => t.moduleCell.pin === 'W')
      const b = terminals.find((t) => t.moduleCell.pin === 'B')
      if (!a || !w || !b) return
      const netA = posToNet.get(posKey(a.x, a.y))
      const netW = posToNet.get(posKey(w.x, w.y))
      const netB = posToNet.get(posKey(b.x, b.y))
      const total = parseNumericProperty(component.moduleDefinition.properties?.resistance, 10000)
      const ratio = getWiperRatio(gridData, w.x, w.y)
      stampResistor(resistors, netA, netW, total * ratio, component.componentId)
      stampResistor(resistors, netW, netB, total * (1 - ratio), component.componentId)
      return
    }

    const mcuTypes = ['Arduino Uno R3', 'ESP32', 'ArduinoUno', 'ESP32DevKit']
    if (mcuTypes.includes(moduleType)) {
      terminals.forEach((terminal) => {
        const moduleCell = terminal.moduleCell
        if (moduleCell.type === 'GPIO' || moduleCell.type === 'ANALOG') {
          const pin = gpioPinNumber(moduleCell)
          if (pin === null) return
          const gpioState = gpioStates?.get(pin)
          const output = gpioOutputVoltage(moduleType, gpioState)
          if (!output.active) return

          const netPos = posToNet.get(posKey(terminal.x, terminal.y))
          if (netPos === undefined) return

          voltageSources.push({
            netPos,
            netNeg: groundNet,
            voltage: output.voltage,
            componentId: component.componentId,
            cellIndex: terminal.cellIndex,
            pwm: output.pwm,
          })
        }
      })
    }
  })

  return {
    nodeCount,
    groundNet,
    posToNet,
    resistors,
    voltageSources,
    leds,
    diodes,
    zeners,
    capacitors,
    npns,
    opAmps,
    bridges,
    components,
    errors,
  }
}

function resistorCurrent(resistor: ResistorStamp, voltages: number[]): number {
  const va = voltages[resistor.netA] ?? 0
  const vb = voltages[resistor.netB] ?? 0
  return (va - vb) / Math.max(resistor.resistance, 1e-9)
}

/** Conductive edges between electrical nets (wires merge into nets via union-find). */
function buildNetAdjacency(
  resistors: ResistorStamp[],
  leds: LedStamp[],
  diodes: DiodeStamp[] = [],
  zeners: ZenerStamp[] = [],
  npns: NpnStamp[] = [],
  capacitors: CapacitorStamp[] = [],
  bridges: BridgeStamp[] = []
): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>()
  const addEdge = (a: number, b: number) => {
    if (a === b) return
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  resistors.forEach((r) => addEdge(r.netA, r.netB))
  leds.forEach((l) => addEdge(l.netAnode, l.netCathode))
  diodes.forEach((d) => addEdge(d.netAnode, d.netCathode))
  zeners.forEach((z) => addEdge(z.netAnode, z.netCathode))
  npns.forEach((t) => addEdge(t.netCollector, t.netEmitter))
  capacitors.forEach((c) => addEdge(c.netA, c.netB))
  bridges.forEach((b) => {
    addEdge(b.netAc1, b.netPlus)
    addEdge(b.netAc1, b.netMinus)
    addEdge(b.netAc2, b.netPlus)
    addEdge(b.netAc2, b.netMinus)
    addEdge(b.netPlus, b.netMinus)
  })
  return adj
}

function hasPathBetween(
  start: number,
  end: number,
  adj: Map<number, Set<number>>
): boolean {
  if (start === end) return true
  const visited = new Set<number>()
  const queue = [start]
  while (queue.length > 0) {
    const n = queue.shift()!
    if (n === end) return true
    if (visited.has(n)) continue
    visited.add(n)
    for (const neighbor of adj.get(n) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor)
    }
  }
  return false
}

/** Nets in the same connected component as a source–ground path. */
function computeActiveNets(
  voltageSources: VoltageSourceStamp[],
  adj: Map<number, Set<number>>
): Set<number> {
  const active = new Set<number>()
  voltageSources.forEach((src) => {
    if (!hasPathBetween(src.netPos, src.netNeg, adj)) return

    const component = new Set<number>()
    const queue = [src.netPos]
    while (queue.length > 0) {
      const n = queue.shift()!
      if (component.has(n)) continue
      component.add(n)
      for (const neighbor of adj.get(n) ?? []) {
        if (!component.has(neighbor)) queue.push(neighbor)
      }
    }

    if (component.has(src.netNeg)) {
      component.forEach((n) => active.add(n))
    }
  })
  return active
}

export function solveCircuit(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  gpioStates?: Map<number, any>
): CircuitSolveResult {
  const emptyWires = wires.map((w) => ({ ...w }))
  const emptyResult = (reason: string, errors: string[] = []): CircuitSolveResult => ({
    works: false,
    reason,
    errors,
    netVoltages: new Map(),
    nodeVoltages: new Map(),
    componentStates: new Map(),
    updatedWires: emptyWires,
    chains: [],
    totalVoltage: 0,
    totalCurrent: 0,
    totalResistance: 0,
    totalPower: 0,
  })

  const netlist = buildNets(gridData, wires, gpioStates)
  const {
    nodeCount,
    groundNet,
    posToNet,
    resistors,
    voltageSources,
    leds,
    diodes: baseDiodes,
    zeners: baseZeners,
    capacitors: baseCapacitors,
    npns: baseNpns,
    opAmps: baseOpAmps,
    bridges,
    components,
    errors,
  } = netlist

  if (nodeCount === 0) {
    return emptyResult('No electrical nodes in circuit', errors)
  }

  const hasSource = voltageSources.length > 0
  const hasGround = netlist.components.some((c) =>
    getTerminals(c).some((t) => isGroundReference(t.moduleCell))
  )

  if (!hasSource) {
    return emptyResult('No voltage source found in circuit', errors)
  }
  if (!hasGround) {
    return emptyResult('No ground reference found in circuit', errors)
  }

  const chainCheck = validateSourceChains(gridData, wires)
  if (!chainCheck.valid) {
    return emptyResult(
      'No continuity — each power source needs a closed path from + back to its own - terminal',
      [...chainCheck.errors, ...errors]
    )
  }

  const netAdjacency = buildNetAdjacency(
    resistors,
    leds,
    baseDiodes,
    baseZeners,
    baseNpns,
    baseCapacitors,
    bridges
  )

  const activeNets = computeActiveNets(voltageSources, netAdjacency)

  let ledStates = leds.map((led) => ({ ...led }))
  let diodeStates = baseDiodes.map((d) => ({ ...d }))
  let zenerStates = baseZeners.map((z) => ({ ...z }))
  let capStates = baseCapacitors.map((c) => ({ ...c }))
  let npnStates = baseNpns.map((t) => ({ ...t }))
  let opAmpStates = baseOpAmps.map((op) => ({ ...op }))
  let solution: { voltages: number[]; sourceCurrents: number[] } | null = null

  const expandBridgeDiodes = (voltages: number[]): DiodeStamp[] => {
    const bridgeDiodes: DiodeStamp[] = []
    bridges.forEach((b) => {
      const v1 = voltages[b.netAc1] ?? 0
      const v2 = voltages[b.netAc2] ?? 0
      const vf = b.forwardVoltage
      if (v1 > v2 + vf * 0.5) {
        bridgeDiodes.push({
          netAnode: b.netAc1,
          netCathode: b.netPlus,
          forwardVoltage: vf,
          seriesResistance: 0.5,
          componentId: `${b.componentId}_d1`,
          isOn: true,
        })
        bridgeDiodes.push({
          netAnode: b.netMinus,
          netCathode: b.netAc2,
          forwardVoltage: vf,
          seriesResistance: 0.5,
          componentId: `${b.componentId}_d3`,
          isOn: true,
        })
      } else if (v2 > v1 + vf * 0.5) {
        bridgeDiodes.push({
          netAnode: b.netAc2,
          netCathode: b.netPlus,
          forwardVoltage: vf,
          seriesResistance: 0.5,
          componentId: `${b.componentId}_d2`,
          isOn: true,
        })
        bridgeDiodes.push({
          netAnode: b.netMinus,
          netCathode: b.netAc1,
          forwardVoltage: vf,
          seriesResistance: 0.5,
          componentId: `${b.componentId}_d4`,
          isOn: true,
        })
      }
    })
    return bridgeDiodes
  }

  for (let iteration = 0; iteration < 12; iteration++) {
    const bridgeDiodes = solution ? expandBridgeDiodes(solution.voltages) : []
    const allDiodes = [...diodeStates, ...bridgeDiodes]

    solution = solveMNA(
      nodeCount,
      groundNet,
      resistors,
      voltageSources,
      ledStates,
      allDiodes,
      zenerStates,
      capStates,
      npnStates,
      opAmpStates
    )
    if (!solution) {
      return emptyResult('Circuit could not be solved (singular matrix)', errors)
    }

    let changed = false

    ledStates = ledStates.map((led) => {
      const anodeV = solution!.voltages[led.netAnode] ?? 0
      const cathodeV = solution!.voltages[led.netCathode] ?? 0
      const shouldBeOn = ledHasForwardBias(anodeV, cathodeV, led.forwardVoltage)
      if (shouldBeOn !== led.isOn) changed = true
      return { ...led, isOn: shouldBeOn }
    })

    diodeStates = diodeStates.map((d) => {
      const anodeV = solution!.voltages[d.netAnode] ?? 0
      const cathodeV = solution!.voltages[d.netCathode] ?? 0
      const shouldBeOn = diodeHasForwardBias(anodeV, cathodeV, d.forwardVoltage)
      if (shouldBeOn !== d.isOn) changed = true
      return { ...d, isOn: shouldBeOn }
    })

    zenerStates = zenerStates.map((z) => {
      const anodeV = solution!.voltages[z.netAnode] ?? 0
      const cathodeV = solution!.voltages[z.netCathode] ?? 0
      const mode = zenerMode(anodeV, cathodeV, z.forwardVoltage, z.zenerVoltage)
      if (mode !== z.mode) changed = true
      return { ...z, mode }
    })

    npnStates = npnStates.map((t) => {
      const vb = solution!.voltages[t.netBase] ?? 0
      const ve = solution!.voltages[t.netEmitter] ?? 0
      const shouldBeOn = vb - ve >= t.vbe - 0.05
      if (shouldBeOn !== t.isOn) changed = true
      return { ...t, isOn: shouldBeOn }
    })

    opAmpStates = opAmpStates.map((op) => {
      const vp = solution!.voltages[op.netNonInv] ?? 0
      const vm = solution!.voltages[op.netInv] ?? 0
      const vee = solution!.voltages[op.netVee] ?? 0
      const raw = op.gain * (vp - vm)
      const vout = Math.max(vee, Math.min(op.vcc, raw + vee))
      if (Math.abs(vout - op.outputVoltage) > 0.01) changed = true
      return { ...op, outputVoltage: vout }
    })

    capStates = capStates.map((cap) => {
      const va = solution!.voltages[cap.netA] ?? 0
      const vb = solution!.voltages[cap.netB] ?? 0
      const target = va - vb
      const tau = cap.capacitance * 1000
      const alpha = tau > 0 ? 1 - Math.exp(-CAP_CHARGE_DT / tau) : 1
      const next = cap.storedVoltage + (target - cap.storedVoltage) * alpha
      if (Math.abs(next - cap.storedVoltage) > 0.001) changed = true
      return { ...cap, storedVoltage: next }
    })

    if (!changed) break
  }

  if (!solution) {
    return emptyResult('Circuit solver failed', errors)
  }

  const { voltages } = solution
  const netVoltages = new Map<number, number>()
  voltages.forEach((v, net) => netVoltages.set(net, v))

  const componentStates = new Map<string, SolvedComponentState>()

  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) return
      const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
      const net = posToNet.get(posKey(x, y))

      componentStates.set(cellComponentId, {
        componentId: cellComponentId,
        componentType: cell.moduleDefinition.module,
        position: { x, y },
        outputVoltage: net !== undefined && activeNets.has(net) ? voltages[net] ?? 0 : 0,
        outputCurrent: 0,
        power: 0,
        status: 'unpowered',
        isPowered: false,
        isGrounded: isNetGrounded(net, groundNet, gridData, posToNet),
      })
    })
  })

  let totalCurrent = 0
  let totalVoltage = 0
  let totalPower = 0

  voltageSources.forEach((source, idx) => {
    if (!activeNets.has(source.netPos) || !activeNets.has(source.netNeg)) return
    const current = Math.abs(solution!.sourceCurrents[idx] ?? 0)
    totalCurrent = Math.max(totalCurrent, current)
    totalVoltage = Math.max(totalVoltage, source.voltage)
    totalPower += source.voltage * current
  })

  resistors.forEach((resistor) => {
    const onCircuit = activeNets.has(resistor.netA) && activeNets.has(resistor.netB)
    const current = onCircuit ? Math.abs(resistorCurrent(resistor, voltages)) : 0
    const va = voltages[resistor.netA] ?? 0
    const vb = voltages[resistor.netB] ?? 0
    const voltageDrop = Math.abs(va - vb)
    const power = voltageDrop * current
    const comp = components.find((c) => c.componentId === resistor.componentId)
    const moduleType = comp?.moduleDefinition?.module ?? ''
    const driveVoltage = Math.max(va, vb)
    const minVoltage =
      moduleType === 'Buzzer'
        ? parseNumericProperty(comp?.moduleDefinition?.properties?.minVoltage, 3)
        : moduleType === 'Servo'
          ? parseNumericProperty(comp?.moduleDefinition?.properties?.minVoltage, 4.8)
          : 0.1
    const isLoadOutput = ['Buzzer', 'Speaker', 'Servo', 'Motor'].includes(moduleType)
    const isActive = onCircuit && current > 1e-6 && driveVoltage >= minVoltage

    gridData.forEach((row, y) => {
      if (!row) return
      row.forEach((cell, x) => {
        if (cell?.componentId !== resistor.componentId) return
        const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
        const existing = componentStates.get(cellComponentId)
        if (!existing) return
        componentStates.set(cellComponentId, {
          ...existing,
          outputVoltage: onCircuit ? voltages[posToNet.get(posKey(x, y)) ?? groundNet] ?? 0 : 0,
          outputCurrent: current,
          power: onCircuit ? power : 0,
          voltageDrop: onCircuit ? voltageDrop : 0,
          status: isActive ? (moduleType === 'Buzzer' ? 'sounding' : 'active') : 'unpowered',
          isPowered: isActive,
          ...(isLoadOutput ? { isOn: isActive } : {}),
        })
      })
    })
  })

  ledStates.forEach((led, idx) => {
    const ledSourceIdx = voltageSources.length + idx
    const onCircuit = activeNets.has(led.netAnode) && activeNets.has(led.netCathode)
    const anodeVoltage = onCircuit ? voltages[led.netAnode] ?? 0 : 0
    const cathodeVoltage = onCircuit ? voltages[led.netCathode] ?? 0 : 0
    const rawCurrent = onCircuit && led.isOn ? Math.max(0, solution!.sourceCurrents[ledSourceIdx] ?? 0) : 0
    const hasBias = ledHasForwardBias(anodeVoltage, cathodeVoltage, led.forwardVoltage)
    const isOn = onCircuit && led.isOn && hasBias && rawCurrent > 1e-6
    const current = isOn ? rawCurrent : 0

    gridData.forEach((row, y) => {
      if (!row) return
      row.forEach((cell, x) => {
        if (cell?.componentId !== led.componentId) return
        const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
        const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
        const net = posToNet.get(posKey(x, y))
        componentStates.set(cellComponentId, {
          componentId: cellComponentId,
          componentType: 'LED',
          position: { x, y },
          inputVoltage: anodeVoltage,
          outputVoltage: isOn ? anodeVoltage : 0,
          outputCurrent: current,
          power: isOn ? led.forwardVoltage * current : 0,
          forwardVoltage: led.forwardVoltage,
          isOn,
          status: isOn ? 'on' : 'off',
          isPowered: isOn,
          isGrounded: isGroundTerminal(moduleCell) || (onCircuit && net === led.netCathode),
        })
      })
    })

    if (onCircuit && !isOn && !hasBias) {
      errors.push(`LED ${led.componentId} has insufficient forward voltage`)
    }
  })

  capStates.forEach((cap) => {
    const onCircuit = activeNets.has(cap.netA) && activeNets.has(cap.netB)
    const vc = onCircuit ? cap.storedVoltage : 0
    gridData.forEach((row, y) => {
      if (!row) return
      row.forEach((cell, x) => {
        if (cell?.componentId !== cap.componentId) return
        const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
        const net = posToNet.get(posKey(x, y))
        const terminalV = onCircuit && net !== undefined ? voltages[net] ?? 0 : 0
        componentStates.set(cellComponentId, {
          componentId: cellComponentId,
          componentType: 'Capacitor',
          position: { x, y },
          outputVoltage: terminalV,
          outputCurrent: 0,
          power: 0.5 * cap.capacitance * vc * vc,
          capacitorVoltage: vc,
          status: Math.abs(vc) < 0.05 ? 'discharged' : Math.abs(vc) > 4 ? 'charged' : 'charging',
          isPowered: onCircuit && Math.abs(vc) > 0.05,
          isGrounded: isNetGrounded(net, groundNet, gridData, posToNet),
        })
        cell.capacitorVoltage = vc
      })
    })
  })

  diodeStates.forEach((d) => {
    const onCircuit = activeNets.has(d.netAnode) && activeNets.has(d.netCathode)
    const isOn = onCircuit && d.isOn
    gridData.forEach((row, y) => {
      if (!row) return
      row.forEach((cell, x) => {
        if (cell?.componentId !== d.componentId) return
        const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
        const net = posToNet.get(posKey(x, y))
        componentStates.set(cellComponentId, {
          componentId: cellComponentId,
          componentType: 'Diode',
          position: { x, y },
          outputVoltage: onCircuit && net !== undefined ? voltages[net] ?? 0 : 0,
          outputCurrent: 0,
          power: 0,
          isOn,
          status: isOn ? 'conducting' : 'off',
          isPowered: isOn,
          isGrounded: isNetGrounded(net, groundNet, gridData, posToNet),
        })
      })
    })
  })

  zenerStates.forEach((z) => {
    const onCircuit = activeNets.has(z.netAnode) && activeNets.has(z.netCathode)
    const isOn = onCircuit && z.mode !== 'off'
    gridData.forEach((row, y) => {
      if (!row) return
      row.forEach((cell, x) => {
        if (cell?.componentId !== z.componentId) return
        const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
        const net = posToNet.get(posKey(x, y))
        componentStates.set(cellComponentId, {
          componentId: cellComponentId,
          componentType: 'ZenerDiode',
          position: { x, y },
          outputVoltage: onCircuit && net !== undefined ? voltages[net] ?? 0 : 0,
          outputCurrent: 0,
          power: 0,
          zenerMode: z.mode,
          status: isOn ? (z.mode === 'zener' ? 'clamping' : 'conducting') : 'off',
          isPowered: isOn,
          isGrounded: isNetGrounded(net, groundNet, gridData, posToNet),
        })
      })
    })
  })

  npnStates.forEach((t) => {
    const onCircuit =
      activeNets.has(t.netBase) && activeNets.has(t.netCollector) && activeNets.has(t.netEmitter)
    const isOn = onCircuit && t.isOn
    gridData.forEach((row, y) => {
      if (!row) return
      row.forEach((cell, x) => {
        if (cell?.componentId !== t.componentId) return
        const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
        const net = posToNet.get(posKey(x, y))
        componentStates.set(cellComponentId, {
          componentId: cellComponentId,
          componentType: 'NPNTransistor',
          position: { x, y },
          outputVoltage: onCircuit && net !== undefined ? voltages[net] ?? 0 : 0,
          outputCurrent: 0,
          power: 0,
          isOn,
          status: isOn ? 'saturated' : 'off',
          isPowered: isOn,
          isGrounded: isNetGrounded(net, groundNet, gridData, posToNet),
        })
      })
    })
  })

  opAmpStates.forEach((op) => {
    const onCircuit =
      activeNets.has(op.netNonInv) &&
      activeNets.has(op.netInv) &&
      activeNets.has(op.netOut) &&
      activeNets.has(op.netVee)
    gridData.forEach((row, y) => {
      if (!row) return
      row.forEach((cell, x) => {
        if (cell?.componentId !== op.componentId) return
        const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
        const net = posToNet.get(posKey(x, y))
        const isOut = cell.moduleDefinition?.grid[cell.cellIndex ?? 0]?.pin === 'OUT'
        componentStates.set(cellComponentId, {
          componentId: cellComponentId,
          componentType: 'OpAmp',
          position: { x, y },
          outputVoltage: onCircuit && net !== undefined ? voltages[net] ?? 0 : 0,
          outputCurrent: 0,
          power: 0,
          status: onCircuit ? 'active' : 'unpowered',
          isPowered: onCircuit && (isOut ? op.outputVoltage > 0.1 : (voltages[net!] ?? 0) > 0.01),
          isGrounded: isNetGrounded(net, groundNet, gridData, posToNet),
        })
      })
    })
  })

  bridges.forEach((b) => {
    const onCircuit =
      activeNets.has(b.netAc1) &&
      activeNets.has(b.netAc2) &&
      activeNets.has(b.netPlus) &&
      activeNets.has(b.netMinus)
    gridData.forEach((row, y) => {
      if (!row) return
      row.forEach((cell, x) => {
        if (cell?.componentId !== b.componentId) return
        const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
        const net = posToNet.get(posKey(x, y))
        const v = onCircuit && net !== undefined ? voltages[net] ?? 0 : 0
        componentStates.set(cellComponentId, {
          componentId: cellComponentId,
          componentType: 'BridgeRectifier',
          position: { x, y },
          outputVoltage: v,
          outputCurrent: 0,
          power: 0,
          status: onCircuit ? 'rectifying' : 'unpowered',
          isPowered: onCircuit && v > 0.1,
          isGrounded: isNetGrounded(net, groundNet, gridData, posToNet),
        })
      })
    })
  })

  components.forEach((component) => {
    const moduleType = component.moduleDefinition.module
    const mcuTypes = ['Arduino Uno R3', 'ESP32', 'ArduinoUno', 'ESP32DevKit']
    if (!mcuTypes.includes(moduleType)) return

    getTerminals(component).forEach((terminal) => {
      const moduleCell = terminal.moduleCell
      const cellComponentId = `${component.componentId}-${terminal.cellIndex}`
      const net = posToNet.get(posKey(terminal.x, terminal.y))
      const onCircuit = net !== undefined && activeNets.has(net)
      const cellVoltage = onCircuit && net !== undefined ? voltages[net] ?? 0 : 0

      if (moduleCell.type === 'GPIO' || moduleCell.type === 'ANALOG') {
        const pin = gpioPinNumber(moduleCell)
        const gpioState = pin !== null ? gpioStates?.get(pin) : undefined
        const output = gpioOutputVoltage(moduleType, gpioState)
        const isPwm = gpioState?.state === 'PULSING'
        const gpioActive = output.active && onCircuit

        componentStates.set(cellComponentId, {
          componentId: cellComponentId,
          componentType: moduleType,
          position: { x: terminal.x, y: terminal.y },
          outputVoltage: gpioActive ? (moduleType.includes('ESP32') ? 3.3 : 5.0) : 0,
          outputCurrent: gpioActive ? totalCurrent : 0,
          power: gpioActive ? output.voltage * totalCurrent : 0,
          status: isPwm && gpioActive ? 'pwm' : gpioActive ? 'active' : 'inactive',
          isPowered: gpioActive,
          isGrounded: false,
          ...(isPwm && output.pwm !== undefined ? { pwm: output.pwm } : {}),
        })
        return
      }

      const existing = componentStates.get(cellComponentId)
      if (existing) {
        const grounded = isGroundTerminal(moduleCell)
        componentStates.set(cellComponentId, {
          ...existing,
          outputVoltage: grounded ? 0 : cellVoltage,
          isPowered: !grounded && onCircuit && cellVoltage > 0.1,
          isGrounded: grounded,
          status: grounded ? 'grounded' : onCircuit && cellVoltage > 0.1 ? 'active' : 'unpowered',
        })
      }
    })
  })

  const totalResistance =
    totalCurrent > 1e-9 ? totalVoltage / totalCurrent : resistors.reduce((sum, r) => sum + r.resistance, 0)

  const { nodeVoltages, updatedWires } = propagateVoltages({
    gridData,
    wires,
    posToNet,
    netVoltages: voltages,
    groundNet,
    activeNets,
    componentStates,
    totalCurrent,
  })

  const chains = buildSystemChains(gridData, wires)

  return {
    works: true,
    errors,
    netVoltages,
    nodeVoltages,
    componentStates,
    updatedWires,
    chains,
    totalVoltage,
    totalCurrent,
    totalResistance,
    totalPower,
  }
}
