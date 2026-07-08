import type { WireConnection } from '../../modules/types'
import { resolveLogicModule } from '../../modules/logicModule'
import type { CircuitGraph, GridCellLike, SolvedComponentState } from './types'
import {
  gpioOutputVoltage,
  gpioPinNumber,
  isMicrocontrollerModule,
  parseNumericProperty,
} from './components/registry'
import { buildCircuitGraph } from './graph'
import { isGroundReference } from './terminals'
import { omitPwm, posKey, stripPwmFromWires } from './utils'

export { stripPwmFromWires }

type GpioStateLike = {
  state?: string
  value?: number
  microcontrollerId?: string
}

function mcuRailVoltage(moduleType: string): number {
  return moduleType.includes('ESP32') ? 3.3 : 5.0
}

function resolveGpioStateForComponent(
  componentId: string,
  pin: number,
  gpioStates: Map<number, unknown>
): GpioStateLike | undefined {
  const state = gpioStates.get(pin) as GpioStateLike | undefined
  if (!state) return undefined
  if (state.microcontrollerId && state.microcontrollerId !== componentId) return undefined
  return state
}

function buildGraphAdjacency(
  graph: ReturnType<typeof buildCircuitGraph>
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  const addEdge = (from: string, to: string) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set())
    adjacency.get(from)!.add(to)
  }

  graph.wireAdj.forEach((neighbors, node) => {
    neighbors.forEach((neighbor) => addEdge(node, neighbor))
  })

  for (const edge of graph.internalEdges) {
    if (edge.bidirectional) {
      addEdge(edge.from, edge.to)
      addEdge(edge.to, edge.from)
    } else {
      addEdge(edge.from, edge.to)
    }
  }

  return adjacency
}

interface GpioLoadTrace {
  visited: Set<string>
  hasGround: boolean
  seriesResistance: number
  ledForwardVoltage: number
  /** componentId -> forward voltage for LEDs on this branch */
  leds: Map<string, number>
}

function traceGpioLoadNetwork(
  startKey: string,
  adjacency: Map<string, Set<string>>,
  graph: CircuitGraph,
  gridData: GridCellLike[][]
): GpioLoadTrace {
  const visited = new Set<string>()
  const leds = new Map<string, number>()
  const queue = [startKey]
  let hasGround = false
  let seriesResistance = 0
  let ledForwardVoltage = 0
  const countedResistors = new Set<string>()
  const countedLeds = new Set<string>()

  while (queue.length > 0) {
    const key = queue.shift()!
    if (visited.has(key)) continue
    visited.add(key)

    const terminal = graph.terminals.get(key)
    if (terminal && isGroundReference(terminal.moduleCell)) {
      hasGround = true
      continue
    }

    if (terminal) {
      const cell = gridData[terminal.y]?.[terminal.x]
      if (terminal.moduleType === 'Resistor' && cell && !countedResistors.has(terminal.componentId)) {
        countedResistors.add(terminal.componentId)
        const resistance =
          (cell as { resistance?: number }).resistance ??
          parseNumericProperty(cell.moduleDefinition?.properties?.resistance, 1000)
        seriesResistance += Math.max(resistance, 1)
      }
      if (terminal.moduleType === 'LED' && !countedLeds.has(terminal.componentId)) {
        countedLeds.add(terminal.componentId)
        const vf = parseNumericProperty(
          cell?.moduleDefinition?.properties?.forwardVoltage,
          2
        )
        ledForwardVoltage += vf
        leds.set(terminal.componentId, vf)
      }
    }

    for (const neighbor of adjacency.get(key) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor)
    }
  }

  return { visited, hasGround, seriesResistance, ledForwardVoltage, leds }
}

function computeBranchCurrent(rail: number, trace: GpioLoadTrace): number {
  if (!trace.hasGround) return 0
  const driveVoltage = Math.max(0, rail - trace.ledForwardVoltage)
  if (driveVoltage <= 0.05) return 0
  if (trace.seriesResistance > 0) {
    return driveVoltage / trace.seriesResistance
  }
  if (trace.leds.size > 0) {
    return 0.02
  }
  return 0
}

function computeBranchNodeVoltages(
  startKey: string,
  rail: number,
  trace: GpioLoadTrace,
  graph: CircuitGraph,
  gridData: GridCellLike[][],
  adjacency: Map<string, Set<string>>
): Map<string, number> {
  const voltages = new Map<string, number>()
  const branchCurrent = computeBranchCurrent(rail, trace)

  if (!trace.hasGround || branchCurrent <= 0) {
    trace.visited.forEach((key) => voltages.set(key, 0))
    return voltages
  }

  const distFromGpio = new Map<string, number>()
  const queue = [startKey]
  distFromGpio.set(startKey, 0)
  while (queue.length > 0) {
    const key = queue.shift()!
    for (const neighbor of adjacency.get(key) ?? []) {
      if (!trace.visited.has(neighbor) || distFromGpio.has(neighbor)) continue
      distFromGpio.set(neighbor, (distFromGpio.get(key) ?? 0) + 1)
      queue.push(neighbor)
    }
  }

  voltages.set(startKey, rail)

  const seenResistors = new Set<string>()
  graph.terminals.forEach((terminal, key) => {
    if (!trace.visited.has(key) || terminal.moduleType !== 'Resistor') return
    if (seenResistors.has(terminal.componentId)) return

    const pins = [...graph.terminals.entries()]
      .filter(([k, t]) => t.componentId === terminal.componentId && trace.visited.has(k))
      .map(([k]) => k)
    if (pins.length < 2) return
    seenResistors.add(terminal.componentId)

    pins.sort((a, b) => (distFromGpio.get(a) ?? 0) - (distFromGpio.get(b) ?? 0))
    const [highKey, lowKey] = pins
    const cell = gridData[terminal.y]?.[terminal.x]
    const resistance =
      (cell as { resistance?: number }).resistance ??
      parseNumericProperty(cell?.moduleDefinition?.properties?.resistance, 1000)
    const vHigh = voltages.get(highKey) ?? rail
    voltages.set(highKey, Math.max(voltages.get(highKey) ?? 0, vHigh))
    voltages.set(lowKey, Math.max(0, (voltages.get(highKey) ?? vHigh) - branchCurrent * resistance))
  })

  let changed = true
  while (changed) {
    changed = false
    for (const key of trace.visited) {
      const terminal = graph.terminals.get(key)
      if (terminal && isGroundReference(terminal.moduleCell)) {
        if ((voltages.get(key) ?? -1) !== 0) {
          voltages.set(key, 0)
          changed = true
        }
        continue
      }

      for (const neighbor of adjacency.get(key) ?? []) {
        if (!trace.visited.has(neighbor)) continue
        const keyTerm = graph.terminals.get(key)
        const neighborTerm = graph.terminals.get(neighbor)
        const sameComponent =
          keyTerm && neighborTerm && keyTerm.componentId === neighborTerm.componentId
        if (sameComponent && (keyTerm.moduleType === 'Resistor' || keyTerm.moduleType === 'LED')) {
          continue
        }

        const keyV = voltages.get(key)
        const neighborV = voltages.get(neighbor)
        if (keyV !== undefined && neighborV === undefined) {
          voltages.set(neighbor, keyV)
          changed = true
        } else if (neighborV !== undefined && keyV === undefined) {
          voltages.set(key, neighborV)
          changed = true
        }
      }
    }
  }

  const seenLeds = new Set<string>()
  graph.terminals.forEach((terminal, key) => {
    if (!trace.visited.has(key) || terminal.moduleType !== 'LED') return
    if (seenLeds.has(terminal.componentId)) return
    seenLeds.add(terminal.componentId)

    const moduleCell = terminal.moduleCell
    const isCathode =
      moduleCell.type === 'LED_NEGATIVE' ||
      terminal.polarity === 'negative' ||
      (typeof moduleCell.pin === 'string' && moduleCell.pin.includes('-'))
    if (isCathode) {
      voltages.set(key, 0)
      return
    }
    const vf = parseNumericProperty(
      gridData[terminal.y]?.[terminal.x]?.moduleDefinition?.properties?.forwardVoltage,
      2
    )
    const upstream = voltages.get(key) ?? rail
    voltages.set(key, Math.max(upstream, vf))
  })

  trace.visited.forEach((key) => {
    if (!voltages.has(key)) voltages.set(key, 0)
  })

  return voltages
}

function resistorVoltageDropForKey(
  key: string,
  voltages: Map<string, number>,
  graph: CircuitGraph,
  gridData: GridCellLike[][]
): number | undefined {
  const terminal = graph.terminals.get(key)
  if (!terminal || terminal.moduleType !== 'Resistor') return undefined

  const pins = [...graph.terminals.entries()]
    .filter(([, t]) => t.componentId === terminal.componentId)
    .map(([k]) => k)
  if (pins.length < 2) return undefined

  const pinVoltages = pins.map((pin) => voltages.get(pin) ?? 0)
  return Math.abs(Math.max(...pinVoltages) - Math.min(...pinVoltages))
}

function stampMcuPinState(
  componentStates: Map<string, SolvedComponentState>,
  cellComponentId: string,
  moduleType: string,
  x: number,
  y: number,
  output: ReturnType<typeof gpioOutputVoltage>,
  gpioState: GpioStateLike,
  branchCurrent: number
): void {
  const rail = mcuRailVoltage(moduleType)
  const isPwm = gpioState.state === 'PULSING'
  const voltage = output.active ? rail : 0
  const current = output.active ? branchCurrent : 0

  componentStates.set(cellComponentId, {
    componentId: cellComponentId,
    componentType: moduleType,
    position: { x, y },
    outputVoltage: voltage,
    outputCurrent: current,
    power: voltage * current,
    status: isPwm && output.active ? 'pwm' : output.active ? 'active' : 'inactive',
    isPowered: output.active,
    isGrounded: false,
    ...(isPwm && output.pwm !== undefined ? { pwm: output.pwm } : {}),
  })
}

/** Stamp live GPIO/PWM states onto MCU pins even when the full circuit cannot be solved. */
export function applyGpioComponentStates(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  gpioStates: Map<number, unknown>,
  componentStates: Map<string, SolvedComponentState>
): void {
  if (gpioStates.size === 0) return

  const graph = buildCircuitGraph(gridData, wires)
  const adjacency = buildGraphAdjacency(graph)

  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (!cell?.occupied || !cell.moduleDefinition || cell.componentId === undefined) return
      if (!isMicrocontrollerModule(cell.moduleDefinition)) return

      const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
      if (!moduleCell) return
      if (moduleCell.type !== 'GPIO' && moduleCell.type !== 'ANALOG') return

      const pin = gpioPinNumber(moduleCell)
      if (pin === null) return

      const gpioState = resolveGpioStateForComponent(cell.componentId, pin, gpioStates)
      if (!gpioState) return

      const moduleType = resolveLogicModule(cell.moduleDefinition)
      const output = gpioOutputVoltage(moduleType, gpioState)
      const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
      const trace = output.active
        ? traceGpioLoadNetwork(posKey(x, y), adjacency, graph, gridData)
        : null
      const branchCurrent = trace ? computeBranchCurrent(mcuRailVoltage(moduleType), trace) : 0

      stampMcuPinState(
        componentStates,
        cellComponentId,
        moduleType,
        x,
        y,
        output,
        gpioState,
        branchCurrent
      )
    })
  })
}

/** Carry live GPIO voltage (and PWM only for PULSING pins) onto wires touching MCU GPIO cells. */
export function applyGpioWireHints(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  gpioStates: Map<number, unknown>
): WireConnection[] {
  if (gpioStates.size === 0) return stripPwmFromWires(wires)

  return wires.map((wire) => {
    let wirePWM: number | undefined
    let wireVoltage = 0
    let wireCurrent = wire.current ?? 0
    let wirePowered = false
    let touchedGpio = false

    const segments = wire.segments.map((segment) => {
      let segPwm: number | undefined
      let segVoltage = segment.voltage ?? 0
      let segCurrent = segment.current ?? 0
      let segPowered = (segment.voltage ?? 0) > 0.1
      let segmentTouchedGpio = false

      for (const pt of [segment.from, segment.to]) {
        const cell = gridData[pt.y]?.[pt.x]
        if (!cell?.occupied || !cell.moduleDefinition || !isMicrocontrollerModule(cell.moduleDefinition)) {
          continue
        }
        const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
        if (!moduleCell) continue
        if (moduleCell.type !== 'GPIO' && moduleCell.type !== 'ANALOG') continue

        const pin = gpioPinNumber(moduleCell)
        if (pin === null) continue

        const gpioState = resolveGpioStateForComponent(cell.componentId!, pin, gpioStates)
        if (!gpioState) continue

        const moduleType = resolveLogicModule(cell.moduleDefinition)
        const rail = mcuRailVoltage(moduleType)
        segmentTouchedGpio = true
        touchedGpio = true

        if (gpioState.state === 'PULSING') {
          segPwm = (gpioState.value ?? 0.5) * 100
          wirePWM = segPwm
          segVoltage = rail
          segPowered = (gpioState.value ?? 0) > 0.001
        } else if (gpioState.state === 'HIGH') {
          segVoltage = rail
          segPowered = true
        } else if (gpioState.state === 'LOW') {
          segVoltage = 0
          segPowered = false
        }

        segCurrent = Math.max(segCurrent, segment.current ?? wire.current ?? 0)
      }

      if (!segmentTouchedGpio) {
        wireVoltage = Math.max(wireVoltage, segVoltage)
        wirePowered = wirePowered || segPowered
        if (segPwm !== undefined) wirePWM = segPwm
        if (segPwm === undefined) return omitPwm(segment)
        return {
          ...omitPwm(segment),
          isPowered: segPowered,
          pwm: segPwm,
          voltage: segVoltage,
          current: segCurrent,
          power: segVoltage * segCurrent,
        }
      }

      wireVoltage = Math.max(wireVoltage, segVoltage)
      wirePowered = wirePowered || segPowered
      if (segPwm === undefined) {
        return {
          ...omitPwm(segment),
          isPowered: segPowered,
          voltage: segVoltage,
          current: segCurrent,
          power: segVoltage * segCurrent,
        }
      }
      return {
        ...omitPwm(segment),
        isPowered: segPowered,
        pwm: segPwm,
        voltage: segVoltage,
        current: segCurrent,
        power: segVoltage * segCurrent,
      }
    })

    const base = omitPwm(wire)
    if (!touchedGpio) {
      return wirePWM === undefined
        ? { ...base, segments }
        : {
            ...base,
            isPowered: wirePowered,
            pwm: wirePWM,
            voltage: wireVoltage,
            current: wireCurrent,
            power: wireVoltage * wireCurrent,
            segments,
          }
    }

    if (wirePWM === undefined) {
      return {
        ...base,
        isPowered: wirePowered,
        voltage: wireVoltage,
        current: wireCurrent,
        power: wireVoltage * wireCurrent,
        segments,
      }
    }
    return {
      ...base,
      isPowered: wirePowered,
      pwm: wirePWM,
      voltage: wireVoltage,
      current: wireCurrent,
      power: wireVoltage * wireCurrent,
      segments,
    }
  })
}

/**
 * Walk from active GPIO pins through wires and loads so passives show live V/I.
 * Used when the DC solver cannot run or returns zero current for GPIO-only circuits.
 */
export function applyGpioVoltagePropagation(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  gpioStates: Map<number, unknown>,
  componentStates: Map<string, SolvedComponentState>,
  options?: { preferSolver?: boolean }
): WireConnection[] {
  if (gpioStates.size === 0) return wires
  if (options?.preferSolver) return wires

  const graph = buildCircuitGraph(gridData, wires)
  const adjacency = buildGraphAdjacency(graph)
  const nodeVoltage = new Map<string, number>()
  const nodeCurrent = new Map<string, number>()

  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (!cell?.occupied || !cell.moduleDefinition || cell.componentId === undefined) return
      if (!isMicrocontrollerModule(cell.moduleDefinition)) {
        return
      }
      const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
      if (!moduleCell) return
      if (moduleCell.type !== 'GPIO' && moduleCell.type !== 'ANALOG') return

      const pin = gpioPinNumber(moduleCell)
      if (pin === null) return

      const gpioState = resolveGpioStateForComponent(cell.componentId, pin, gpioStates)
      if (!gpioState) return

      const moduleType = resolveLogicModule(cell.moduleDefinition)
      const output = gpioOutputVoltage(moduleType, gpioState)
      const startKey = posKey(x, y)
      const rail = mcuRailVoltage(moduleType)
      const trace = traceGpioLoadNetwork(startKey, adjacency, graph, gridData)
      const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`

      if (!output.active) {
        if (gpioState.state === 'LOW') {
          trace.visited.forEach((key) => {
            nodeVoltage.set(key, 0)
            nodeCurrent.set(key, 0)
          })
        }
        stampMcuPinState(
          componentStates,
          cellComponentId,
          moduleType,
          x,
          y,
          output,
          gpioState,
          0
        )
        return
      }

      const branchCurrent = computeBranchCurrent(rail, trace)
      const branchVoltages = computeBranchNodeVoltages(
        startKey,
        rail,
        trace,
        graph,
        gridData,
        adjacency
      )

      branchVoltages.forEach((voltage, key) => {
        nodeVoltage.set(key, voltage)
        nodeCurrent.set(key, branchCurrent)
      })

      stampMcuPinState(
        componentStates,
        cellComponentId,
        moduleType,
        x,
        y,
        output,
        gpioState,
        branchCurrent
      )
    })
  })

  if (nodeVoltage.size === 0) return wires

  const ledAnodes = new Map<string, number>()
  traceLedAnodeVoltages(graph, nodeVoltage, ledAnodes)

  nodeVoltage.forEach((_voltage, key) => {
    const [x, y] = key.split(',').map(Number)
    const cell = gridData[y]?.[x]
    if (!cell?.occupied || !cell.moduleDefinition || cell.componentId === undefined) return
    if (isMicrocontrollerModule(cell.moduleDefinition)) return

    const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
    const moduleType = resolveLogicModule(cell.moduleDefinition)
    const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
    if (!moduleCell) return
    const grounded = isGroundReference(moduleCell)
    const voltage = grounded ? 0 : (nodeVoltage.get(key) ?? 0)
    const current = nodeCurrent.get(key) ?? 0

    if (moduleType === 'LED') {
      const vf = parseNumericProperty(cell.moduleDefinition.properties?.forwardVoltage, 2)
      const anodeV = ledAnodes.get(cell.componentId) ?? voltage
      const isCathode = moduleCell.type === 'LED_NEGATIVE'
      const isOn = !grounded && !isCathode && anodeV >= vf - 0.05 && current > 1e-6

      componentStates.set(cellComponentId, {
        componentId: cellComponentId,
        componentType: moduleType,
        position: { x, y },
        inputVoltage: anodeV,
        outputVoltage: isOn ? (isCathode ? 0 : anodeV) : 0,
        outputCurrent: isOn ? current : 0,
        power: isOn ? vf * current : 0,
        forwardVoltage: vf,
        isOn,
        status: isOn ? 'on' : 'off',
        isPowered: isOn,
        isGrounded: grounded || isCathode,
      })
      return
    }

    if (moduleType === 'Resistor') {
      const drop = resistorVoltageDropForKey(key, nodeVoltage, graph, gridData)
      componentStates.set(cellComponentId, {
        ...(componentStates.get(cellComponentId) ?? {}),
        componentId: cellComponentId,
        componentType: moduleType,
        position: { x, y },
        outputVoltage: voltage,
        outputCurrent: current,
        power: voltage * current,
        ...(drop !== undefined ? { voltageDrop: drop } : {}),
        status: grounded ? 'grounded' : voltage > 0.1 ? 'active' : 'unpowered',
        isPowered: !grounded && voltage > 0.1,
        isGrounded: grounded,
      })
      return
    }

    componentStates.set(cellComponentId, {
      ...(componentStates.get(cellComponentId) ?? {}),
      componentId: cellComponentId,
      componentType: moduleType,
      position: { x, y },
      outputVoltage: voltage,
      outputCurrent: current,
      power: voltage * current,
      status: grounded ? 'grounded' : voltage > 0.1 ? 'active' : 'unpowered',
      isPowered: !grounded && voltage > 0.1,
      isGrounded: grounded,
    })
  })

  return wires.map((wire) => {
    let maxVoltage = wire.voltage ?? 0
    let maxCurrent = wire.current ?? 0
    const segments = wire.segments.map((segment) => {
      const fromKey = posKey(segment.from.x, segment.from.y)
      const toKey = posKey(segment.to.x, segment.to.y)
      const fromV = nodeVoltage.get(fromKey)
      const toV = nodeVoltage.get(toKey)
      const nodeKnown = fromV !== undefined || toV !== undefined
      const segV = nodeKnown
        ? (fromV ?? toV ?? 0)
        : (segment.voltage ?? 0)
      const segI = Math.max(
        nodeCurrent.get(fromKey) ?? 0,
        nodeCurrent.get(toKey) ?? 0,
        segment.current ?? 0
      )
      maxVoltage = Math.max(maxVoltage, segV)
      maxCurrent = Math.max(maxCurrent, segI)
      const segBase = segV <= 0.1 ? omitPwm(segment) : segment
      return {
        ...segBase,
        voltage: segV,
        current: segI,
        isPowered: segV > 0.1,
        power: segV * segI,
      }
    })

    return {
      ...(maxVoltage <= 0.1 ? omitPwm(wire) : wire),
      voltage: maxVoltage,
      current: maxCurrent,
      isPowered: maxVoltage > 0.1,
      power: maxVoltage * maxCurrent,
      segments,
    }
  })
}

function traceLedAnodeVoltages(
  graph: CircuitGraph,
  nodeVoltage: Map<string, number>,
  ledAnodes: Map<string, number>
): void {
  graph.terminals.forEach((terminal, key) => {
    if (terminal.moduleType !== 'LED') return
    const moduleCell = terminal.moduleCell
    const isAnode =
      moduleCell.type === 'LED_POSITIVE' ||
      terminal.polarity === 'positive' ||
      (typeof moduleCell.pin === 'string' && moduleCell.pin.includes('+'))
    if (!isAnode) return
    const v = nodeVoltage.get(key) ?? 0
    ledAnodes.set(terminal.componentId, Math.max(ledAnodes.get(terminal.componentId) ?? 0, v))
  })
}
