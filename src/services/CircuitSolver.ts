/**
 * Netlist-based DC circuit solver using Modified Nodal Analysis (MNA).
 * Builds electrical nets from wire connectivity, stamps components, and solves for node voltages.
 */

import { WireConnection } from '../modules/types'

export interface SolvedComponentState {
  componentId: string
  componentType: string
  position: { x: number; y: number }
  outputVoltage: number
  outputCurrent: number
  power: number
  status: string
  isPowered: boolean
  isGrounded: boolean
  pwm?: number
  [key: string]: any
}

export interface CircuitSolveResult {
  works: boolean
  reason?: string
  errors: string[]
  netVoltages: Map<number, number>
  componentStates: Map<string, SolvedComponentState>
  updatedWires: WireConnection[]
  totalVoltage: number
  totalCurrent: number
  totalResistance: number
  totalPower: number
}

export interface GridCellLike {
  occupied?: boolean
  componentId?: string
  componentType?: string
  moduleDefinition?: any
  cellIndex?: number
  resistance?: number
  isOn?: boolean
  wiperPosition?: number
  x?: number
  y?: number
}

interface PlacedComponent {
  componentId: string
  baseX: number
  baseY: number
  moduleDefinition: any
  resistance?: number
}

interface TerminalInfo {
  x: number
  y: number
  cellIndex: number
  moduleCell: any
}

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

class UnionFind {
  parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x])
    }
    return this.parent[x]
  }

  union(a: number, b: number): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parent[rootB] = rootA
    }
  }
}

function posKey(x: number, y: number): string {
  return `${x},${y}`
}

function parseNumericProperty(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && 'default' in (value as object)) {
    const d = (value as { default: unknown }).default
    if (typeof d === 'number' && Number.isFinite(d)) return d
  }
  return fallback
}

function isGroundTerminal(moduleCell: any): boolean {
  if (!moduleCell) return false
  return (
    moduleCell.type === 'GND' ||
    moduleCell.type === 'NEGATIVE' ||
    moduleCell.isGroundable === true ||
    moduleCell.pin === '-' ||
    moduleCell.pin === 'GND'
  )
}

function isPositiveTerminal(moduleCell: any): boolean {
  if (!moduleCell) return false
  return (
    moduleCell.type === 'POSITIVE' ||
    moduleCell.type === 'VCC' ||
    moduleCell.type === 'LED_POSITIVE' ||
    moduleCell.isPowerable === true ||
    moduleCell.pin === '+' ||
    moduleCell.pin === '5V'
  )
}

function isConnectableTerminal(moduleCell: any): boolean {
  return Boolean(moduleCell?.isConnectable)
}

function getPlacedComponents(gridData: GridCellLike[][]): PlacedComponent[] {
  const byId = new Map<string, PlacedComponent>()

  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) return

      const existing = byId.get(cell.componentId)
      if (!existing) {
        byId.set(cell.componentId, {
          componentId: cell.componentId,
          baseX: x,
          baseY: y,
          moduleDefinition: cell.moduleDefinition,
          resistance: cell.resistance,
        })
      } else {
        if ((cell.cellIndex ?? 0) === 0) {
          existing.baseX = x
          existing.baseY = y
        }
        if (cell.resistance !== undefined) {
          existing.resistance = cell.resistance
        }
      }
    })
  })

  return Array.from(byId.values())
}

function getTerminals(component: PlacedComponent): TerminalInfo[] {
  const terminals: TerminalInfo[] = []
  component.moduleDefinition.grid.forEach((moduleCell: any, cellIndex: number) => {
    if (!isConnectableTerminal(moduleCell)) return
    terminals.push({
      x: component.baseX + moduleCell.x,
      y: component.baseY + moduleCell.y,
      cellIndex,
      moduleCell,
    })
  })
  return terminals
}

function gpioPinNumber(moduleCell: any): number | null {
  const pin = moduleCell?.pin
  if (!pin || typeof pin !== 'string') return null
  if (pin.startsWith('GPIO')) return parseInt(pin.replace('GPIO', ''), 10)
  if (pin.startsWith('D')) return parseInt(pin.replace('D', ''), 10)
  if (pin.startsWith('A')) return parseInt(pin.replace('A', ''), 10) + 100
  const parsed = parseInt(pin, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function gpioOutputVoltage(moduleType: string, gpioState: any): { voltage: number; pwm?: number; active: boolean } {
  const state = gpioState?.state ?? 'LOW'
  const fullVoltage = moduleType.includes('ESP32') ? 3.3 : 5.0

  if (state === 'HIGH') {
    return { voltage: fullVoltage, active: true }
  }
  if (state === 'PULSING') {
    const duty = typeof gpioState?.value === 'number' ? gpioState.value : 0.5
    return { voltage: fullVoltage * duty, pwm: duty * 100, active: duty > 0 }
  }
  return { voltage: 0, active: false }
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
  leds: LedStamp[]
): { voltages: number[]; sourceCurrents: number[] } | null {
  const nodeToUnknown = new Map<number, number>()
  let unknownNodeCount = 0
  for (let net = 0; net < nodeCount; net++) {
    if (net === groundNet) continue
    nodeToUnknown.set(net, unknownNodeCount++)
  }

  const activeLeds = leds.filter((led) => led.isOn)
  const ledAsSources: VoltageSourceStamp[] = activeLeds.map((led) => ({
    netPos: led.netAnode,
    netNeg: led.netCathode,
    voltage: led.forwardVoltage,
    componentId: led.componentId,
  }))
  const ledResistors: ResistorStamp[] = activeLeds.map((led) => ({
    netA: led.netAnode,
    netB: led.netCathode,
    resistance: led.seriesResistance,
    componentId: `${led.componentId}_led_r`,
  }))

  const allVoltageSources = [...voltageSources, ...ledAsSources]
  const allResistors = [...resistors, ...ledResistors]

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

function gridCellAt(gridData: GridCellLike[][], x: number, y: number): GridCellLike | undefined {
  return gridData[y]?.[x]
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

function isSwitchClosed(gridData: GridCellLike[][], componentId: string): boolean {
  for (let y = 0; y < gridData.length; y++) {
    const row = gridData[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (cell?.componentId === componentId && cell.isOn) return true
    }
  }
  return false
}

function getWiperRatio(
  gridData: GridCellLike[][],
  wiperX: number,
  wiperY: number,
  fallback = 0.5
): number {
  const cell = gridCellAt(gridData, wiperX, wiperY)
  const w = cell?.wiperPosition
  if (typeof w === 'number') return Math.max(0.05, Math.min(0.95, w))
  return fallback
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
      if (isGroundTerminal(terminal.moduleCell)) {
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
      const negative = terminals.find((t) => isGroundTerminal(t.moduleCell))
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

    if (moduleType === 'LED') {
      const anode = terminals.find((t) => t.moduleCell.type === 'LED_POSITIVE' || t.moduleCell.pin === '+')
      const cathode = terminals.find((t) => t.moduleCell.type === 'LED_NEGATIVE' || t.moduleCell.pin === '-')
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

    if (moduleType === 'Capacitor') {
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
      if (!input || !output || !isSwitchClosed(gridData, component.componentId)) return
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
  leds: LedStamp[]
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

/** Every source must reach its reference ground net through conductive components. */
function hasContinuityToGround(
  voltageSources: VoltageSourceStamp[],
  adj: Map<number, Set<number>>
): boolean {
  if (voltageSources.length === 0) return false
  return voltageSources.every((src) => hasPathBetween(src.netPos, src.netNeg, adj))
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

function isNetGrounded(
  net: number | undefined,
  groundNet: number,
  gridData: GridCellLike[][],
  posToNet: Map<string, number>
): boolean {
  if (net === undefined) return false
  if (net === groundNet) return true

  for (let y = 0; y < gridData.length; y++) {
    const row = gridData[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (!cell?.occupied || !cell.moduleDefinition) continue
      const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
      if (!isGroundTerminal(moduleCell)) continue
      if (posToNet.get(posKey(x, y)) === net) return true
    }
  }
  return false
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
    componentStates: new Map(),
    updatedWires: emptyWires,
    totalVoltage: 0,
    totalCurrent: 0,
    totalResistance: 0,
    totalPower: 0,
  })

  const netlist = buildNets(gridData, wires, gpioStates)
  const { nodeCount, groundNet, posToNet, resistors, voltageSources, leds, components, errors } = netlist

  if (nodeCount === 0) {
    return emptyResult('No electrical nodes in circuit', errors)
  }

  const hasSource = voltageSources.length > 0
  const hasGround = netlist.components.some((c) =>
    getTerminals(c).some((t) => isGroundTerminal(t.moduleCell))
  )

  if (!hasSource) {
    return emptyResult('No voltage source found in circuit', errors)
  }
  if (!hasGround) {
    return emptyResult('No ground reference found in circuit', errors)
  }

  const netAdjacency = buildNetAdjacency(resistors, leds)
  if (!hasContinuityToGround(voltageSources, netAdjacency)) {
    return emptyResult(
      'No continuity to ground — wire a complete path from power to a ground terminal',
      [
        'Every powered line must connect through components back to an isGroundable terminal',
        ...errors,
      ]
    )
  }

  const activeNets = computeActiveNets(voltageSources, netAdjacency)

  let ledStates = leds.map((led) => ({ ...led }))
  let solution: { voltages: number[]; sourceCurrents: number[] } | null = null

  for (let iteration = 0; iteration < 8; iteration++) {
    solution = solveMNA(nodeCount, groundNet, resistors, voltageSources, ledStates)
    if (!solution) {
      return emptyResult('Circuit could not be solved (singular matrix)', errors)
    }

    let changed = false
    ledStates = ledStates.map((led, idx) => {
      const anodeV = solution!.voltages[led.netAnode] ?? 0
      const cathodeV = solution!.voltages[led.netCathode] ?? 0
      const ledSourceIdx = voltageSources.length + idx
      const current = led.isOn ? (solution!.sourceCurrents[ledSourceIdx] ?? 0) : 0
      const shouldBeOn = ledHasForwardBias(anodeV, cathodeV, led.forwardVoltage) &&
        (!led.isOn || current > 1e-9)
      if (shouldBeOn !== led.isOn) {
        changed = true
        return { ...led, isOn: shouldBeOn }
      }
      return led
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

  const updatedWires = wires.map((wire) => {
    let maxVoltage = 0
    let wirePWM: number | undefined
    let isPowered = false
    let isGrounded = false

    wire.segments.forEach((segment) => {
      ;[segment.from, segment.to].forEach((point) => {
        const net = posToNet.get(posKey(point.x, point.y))
        if (net === undefined || !activeNets.has(net)) return
        const v = voltages[net] ?? 0
        maxVoltage = Math.max(maxVoltage, v)
        if (isNetGrounded(net, groundNet, gridData, posToNet)) isGrounded = true
        if (v > 0.1) isPowered = true

        const cell = gridData[point.y]?.[point.x]
        if (cell?.occupied && cell.componentId) {
          const state = componentStates.get(`${cell.componentId}-${cell.cellIndex ?? 0}`)
          if (state?.pwm !== undefined) wirePWM = state.pwm
        }
      })
    })

    return {
      ...wire,
      voltage: isPowered ? maxVoltage : 0,
      current: isPowered ? totalCurrent : 0,
      isPowered,
      isGrounded,
      ...(wirePWM !== undefined ? { pwm: wirePWM } : {}),
    }
  })

  return {
    works: true,
    errors,
    netVoltages,
    componentStates,
    updatedWires,
    totalVoltage,
    totalCurrent,
    totalResistance,
    totalPower,
  }
}
