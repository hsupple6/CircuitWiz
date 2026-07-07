import { parseNumericProperty, posKey } from './utils'
import { resolveLogicGateChip, type GateFn } from '../../modules/ics/logicGateChips'
import type { PlacedComponent } from './types'

type TerminalLike = {
  x: number
  y: number
  moduleCell: {
    type?: string
    pin?: string
  }
}

type ResistorStamp = {
  netA: number
  netB: number
  resistance: number
  componentId: string
}

export interface LogicGateChannelStamp {
  inputNets: number[]
  outputNet: number
  fn: GateFn
  outputHigh: boolean
}

export interface LogicGateICStamp {
  componentId: string
  chipId: string
  netVcc: number
  netGnd: number
  vth: number
  gates: LogicGateChannelStamp[]
}

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

export function evalLogicGate(fn: GateFn, inputs: boolean[]): boolean {
  switch (fn) {
    case 'and':
      return inputs.every(Boolean)
    case 'or':
      return inputs.some(Boolean)
    case 'nand':
      return !inputs.every(Boolean)
    case 'nor':
      return !inputs.some(Boolean)
    case 'xor':
      return inputs.reduce((acc, v) => acc !== v, false)
    case 'not':
      return !inputs[0]
    default:
      return false
  }
}

export function isLogicInputHigh(voltage: number, vth: number): boolean {
  return voltage >= vth
}

export function collectLogicGateICStamp(
  component: PlacedComponent,
  terminals: TerminalLike[],
  posToNet: Map<string, number>
): { stamp: LogicGateICStamp | null; resistors: ResistorStamp[]; errors: string[] } {
  const resistors: ResistorStamp[] = []
  const errors: string[] = []

  const chipId =
    String(component.moduleDefinition.properties?.chipId?.default ?? component.moduleDefinition.module) ||
    ''
  const chip = resolveLogicGateChip(chipId)
  if (!chip) {
    errors.push(`Unknown logic gate IC "${chipId}" on ${component.componentId}`)
    return { stamp: null, resistors, errors }
  }

  const vcc = findTerminal(
    terminals,
    (t) => t.moduleCell.pin === 'VCC' || t.moduleCell.type === 'DRIVER_PWR'
  )
  const gnd = findTerminal(
    terminals,
    (t) => t.moduleCell.pin === 'GND' || t.moduleCell.type === 'GND'
  )
  if (!vcc || !gnd) {
    errors.push(`${chipId} ${component.componentId} is missing VCC or GND`)
    return { stamp: null, resistors, errors }
  }

  const netVcc = posToNet.get(posKey(vcc.x, vcc.y))
  const netGnd = posToNet.get(posKey(gnd.x, gnd.y))
  if (netVcc === undefined || netGnd === undefined) {
    return { stamp: null, resistors, errors }
  }

  const pinToNet = new Map<string, number>()
  terminals.forEach((terminal) => {
    const pin = terminal.moduleCell.pin
    if (!pin || pin.startsWith('NC')) return
    const net = posToNet.get(posKey(terminal.x, terminal.y))
    if (net !== undefined) pinToNet.set(pin, net)
  })

  const gates: LogicGateChannelStamp[] = []
  for (const gate of chip.gates) {
    const inputNets = gate.inputs.map((pin) => pinToNet.get(pin))
    const outputNet = pinToNet.get(gate.output)
    if (inputNets.some((n) => n === undefined) || outputNet === undefined) {
      errors.push(`${chipId} ${component.componentId} gate ${gate.output} missing pin nets`)
      continue
    }
    gates.push({
      inputNets: inputNets as number[],
      outputNet,
      fn: gate.fn,
      outputHigh: false,
    })
  }

  const iq = parseNumericProperty(component.moduleDefinition.properties?.idleCurrent, 0.00001)
  const idleR = iq > 0 ? Math.min(1e6, 5 / iq) : 1e6
  stampResistor(resistors, netVcc, netGnd, idleR, `${component.componentId}_iq`)

  terminals.forEach((terminal) => {
    if (terminal.moduleCell.type !== 'INPUT') return
    const net = posToNet.get(posKey(terminal.x, terminal.y))
    if (net === undefined || net === netGnd || net === netVcc) return
    stampResistor(resistors, net, netGnd, 1e6, `${component.componentId}_${terminal.moduleCell.pin}_bleed`)
  })

  const vth = parseNumericProperty(component.moduleDefinition.properties?.vth, 2.5)

  return {
    stamp: {
      componentId: component.componentId,
      chipId,
      netVcc,
      netGnd,
      vth,
      gates,
    },
    resistors,
    errors,
  }
}

export function updateLogicGateStates(
  stamps: LogicGateICStamp[],
  voltages: number[] | undefined
): { states: LogicGateICStamp[]; changed: boolean } {
  let changed = false
  const states = stamps.map((ic) => {
    const gates = ic.gates.map((gate) => {
      const inputHighs = gate.inputNets.map((net) =>
        isLogicInputHigh(voltages?.[net] ?? 0, ic.vth)
      )
      const outputHigh = evalLogicGate(gate.fn, inputHighs)
      if (outputHigh !== gate.outputHigh) changed = true
      return { ...gate, outputHigh }
    })
    return { ...ic, gates }
  })
  return { states, changed }
}

export function buildLogicGateStamps(
  stamps: LogicGateICStamp[],
  voltages: number[] | undefined
): { resistors: ResistorStamp[] } {
  const resistors: ResistorStamp[] = []
  const outputRon = 50

  stamps.forEach((ic) => {
    const vccV = voltages?.[ic.netVcc] ?? 5
    if (vccV < 3) return

    ic.gates.forEach((gate, gateIdx) => {
      if (gate.outputHigh) {
        stampResistor(
          resistors,
          gate.outputNet,
          ic.netVcc,
          outputRon,
          `${ic.componentId}_g${gateIdx}_high`
        )
      } else {
        stampResistor(
          resistors,
          gate.outputNet,
          ic.netGnd,
          outputRon,
          `${ic.componentId}_g${gateIdx}_low`
        )
      }
    })
  })

  return { resistors }
}
