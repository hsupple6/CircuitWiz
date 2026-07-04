import { parseNumericProperty, posKey } from '../utils'
import type { PlacedComponent } from '../types'
import { isDriverModule } from '../../../modules/drivers/logic'

export interface DriverChannelStamp {
  netCtrl: number
  netSupply: number
  netOut: number
  netGnd: number
  vth: number
  rdsOn: number
  componentId: string
  isOn: boolean
  /** Scale conductance by ctrl/supply ratio (PWM dimming) */
  pwmMode: boolean
  /** Optional load from netOut to netGnd when channel is on (speaker) */
  loadToGnd?: number
  /** Second output terminal (e.g. coil −) for relay path */
  netOutReturn?: number
  /** Resistance between netOut and netOutReturn when on (relay/stepper coil) */
  coilResistance?: number
  /** Enable pin — channel only active when this net is above vth */
  netEnable?: number
}

export interface DriverIdleLoadStamp {
  netPos: number
  netNeg: number
  resistance: number
  componentId: string
}

type TerminalLike = {
  x: number
  y: number
  moduleCell: {
    type?: string
    pin?: string
    isPowerable?: boolean
    isGroundable?: boolean
  }
}

function findTerminal(
  terminals: TerminalLike[],
  pred: (t: TerminalLike) => boolean
): TerminalLike | undefined {
  return terminals.find(pred)
}

function supplyTerminal(terminals: TerminalLike[]): TerminalLike | undefined {
  return findTerminal(
    terminals,
    (t) =>
      t.moduleCell.type === 'DRIVER_PWR' ||
      t.moduleCell.pin === 'VM' ||
      t.moduleCell.pin === 'VIN' ||
      t.moduleCell.pin === 'VCC' ||
      t.moduleCell.pin === 'VBAT'
  )
}

function gndTerminal(terminals: TerminalLike[]): TerminalLike | undefined {
  return findTerminal(
    terminals,
    (t) => t.moduleCell.type === 'GND' || t.moduleCell.pin === 'GND'
  )
}

function ctrlTerminals(terminals: TerminalLike[]): TerminalLike[] {
  return terminals.filter(
    (t) =>
      t.moduleCell.type === 'DRIVER_CTRL' ||
      t.moduleCell.type === 'INPUT' ||
      t.moduleCell.type === 'GPIO'
  )
}

function outTerminals(terminals: TerminalLike[]): TerminalLike[] {
  return terminals.filter((t) => t.moduleCell.type === 'DRIVER_OUT')
}

function outTerminalByPin(terminals: TerminalLike[], pin: string): TerminalLike | undefined {
  return findTerminal(
    terminals,
    (t) => t.moduleCell.type === 'DRIVER_OUT' && t.moduleCell.pin === pin
  )
}

function pairChannelsByPin(
  ctrls: TerminalLike[],
  outs: TerminalLike[]
): Array<{ ctrl: TerminalLike; out: TerminalLike }> {
  const pairs: Array<{ ctrl: TerminalLike; out: TerminalLike }> = []
  for (const ctrl of ctrls) {
    const pin = ctrl.moduleCell.pin ?? ''
    const suffix = pin.replace(/^IN/i, 'OUT')
    const matched =
      outTerminalByPin(outs, suffix) ??
      outTerminalByPin(outs, pin) ??
      outs.find((o) => o.moduleCell.pin === 'OUT') ??
      outs.find((o) => o.moduleCell.pin === '+')
    if (matched) pairs.push({ ctrl, out: matched })
  }
  return pairs
}

export function collectDriverStamps(
  moduleType: string,
  component: PlacedComponent,
  terminals: TerminalLike[],
  posToNet: Map<string, number>
): { channels: DriverChannelStamp[]; idleLoads: DriverIdleLoadStamp[] } {
  const channels: DriverChannelStamp[] = []
  const idleLoads: DriverIdleLoadStamp[] = []
  if (!isDriverModule(moduleType)) return { channels, idleLoads }

  const props = component.moduleDefinition.properties ?? {}
  const vth = parseNumericProperty(props.vth, 1.8)
  const rdsOn = parseNumericProperty(props.rdsOn ?? props.seriesResistance, 0.5)

  const supply = supplyTerminal(terminals)
  const gnd = gndTerminal(terminals)
  const netSupply = supply ? posToNet.get(posKey(supply.x, supply.y)) : undefined
  const netGnd = gnd ? posToNet.get(posKey(gnd.x, gnd.y)) : undefined

  if (netSupply !== undefined && netGnd !== undefined) {
    const idleR =
      moduleType === 'DisplayDriver' ||
      moduleType === 'SerialDriver' ||
      moduleType === 'AudioDriver'
        ? 1000 / Math.max(parseNumericProperty(props.idleCurrent, 0.01), 1e-6)
        : moduleType === 'PowerDriver'
          ? 10000
          : 5000
    idleLoads.push({
      netPos: netSupply,
      netNeg: netGnd,
      resistance: idleR,
      componentId: `${component.componentId}_idle`,
    })
  }

  if (moduleType === 'PowerDriver') {
    const vout = findTerminal(terminals, (t) => t.moduleCell.type === 'DRIVER_OUT')
    const netOut = vout ? posToNet.get(posKey(vout.x, vout.y)) : undefined
    if (netSupply !== undefined && netOut !== undefined && netGnd !== undefined) {
      channels.push({
        netCtrl: netSupply,
        netSupply,
        netOut,
        netGnd,
        vth: 0,
        rdsOn: parseNumericProperty(props.seriesResistance, 0.05),
        componentId: component.componentId,
        isOn: true,
        pwmMode: false,
      })
    }
    return { channels, idleLoads }
  }

  if (moduleType === 'DisplayDriver' || moduleType === 'AudioDriver') {
    return { channels, idleLoads }
  }

  const ctrls = ctrlTerminals(terminals)
  const outs = outTerminals(terminals)

  if (moduleType === 'BrushedDriver') {
    const pairs = pairChannelsByPin(ctrls, outs)
    for (const { ctrl, out } of pairs) {
      const netCtrl = posToNet.get(posKey(ctrl.x, ctrl.y))
      const netOut = posToNet.get(posKey(out.x, out.y))
      if (netCtrl === undefined || netSupply === undefined || netOut === undefined || netGnd === undefined) {
        continue
      }
      channels.push({
        netCtrl,
        netSupply,
        netOut,
        netGnd,
        vth,
        rdsOn,
        componentId: `${component.componentId}_${ctrl.moduleCell.pin}`,
        isOn: false,
        pwmMode: true,
      })
    }
    return { channels, idleLoads }
  }

  if (moduleType === 'EscDriver') {
    const pwm = findTerminal(terminals, (t) => t.moduleCell.pin === 'PWM')
    const netPwm = pwm ? posToNet.get(posKey(pwm.x, pwm.y)) : undefined
    if (netPwm !== undefined && netSupply !== undefined && netGnd !== undefined) {
      for (const phase of ['U', 'V', 'W']) {
        const phaseTerm = outTerminalByPin(outs, phase)
        const netPhase = phaseTerm ? posToNet.get(posKey(phaseTerm.x, phaseTerm.y)) : undefined
        if (netPhase === undefined) continue
        channels.push({
          netCtrl: netPwm,
          netSupply,
          netOut: netPhase,
          netGnd,
          vth: parseNumericProperty(props.vth, 1.1),
          rdsOn: parseNumericProperty(props.rdsOn, 0.01),
          componentId: `${component.componentId}_${phase}`,
          isOn: false,
          pwmMode: true,
        })
      }
    }
    return { channels, idleLoads }
  }

  if (moduleType === 'StepperDriver') {
    const en = findTerminal(terminals, (t) => t.moduleCell.pin === 'EN')
    const netEnable = en ? posToNet.get(posKey(en.x, en.y)) : undefined
    const coilR = parseNumericProperty(props.coilResistance, 2)
    const windings: Array<{ ctrlPin: string; plusPin: string; minusPin: string }> = [
      { ctrlPin: 'STEP', plusPin: 'A+', minusPin: 'A-' },
      { ctrlPin: 'DIR', plusPin: 'B+', minusPin: 'B-' },
    ]
    for (const w of windings) {
      const ctrl = findTerminal(terminals, (t) => t.moduleCell.pin === w.ctrlPin)
      const plus = findTerminal(terminals, (t) => t.moduleCell.pin === w.plusPin)
      const minus = findTerminal(terminals, (t) => t.moduleCell.pin === w.minusPin)
      const netCtrl = ctrl ? posToNet.get(posKey(ctrl.x, ctrl.y)) : undefined
      const netPlus = plus ? posToNet.get(posKey(plus.x, plus.y)) : undefined
      const netMinus = minus ? posToNet.get(posKey(minus.x, minus.y)) : undefined
      if (
        netCtrl === undefined ||
        netPlus === undefined ||
        netMinus === undefined ||
        netSupply === undefined ||
        netGnd === undefined
      ) {
        continue
      }
      channels.push({
        netCtrl,
        netSupply,
        netOut: netPlus,
        netGnd,
        netOutReturn: netMinus,
        coilResistance: coilR,
        netEnable,
        vth,
        rdsOn: 0.5,
        componentId: `${component.componentId}_${w.ctrlPin}`,
        isOn: false,
        pwmMode: true,
      })
    }
    return { channels, idleLoads }
  }

  if (moduleType === 'RelayDriver') {
    const ctrl = ctrls[0]
    const coilPos = findTerminal(terminals, (t) => t.moduleCell.pin === '+')
    const coilNeg = findTerminal(terminals, (t) => t.moduleCell.pin === '-')
    const netCtrl = ctrl ? posToNet.get(posKey(ctrl.x, ctrl.y)) : undefined
    const netPlus = coilPos ? posToNet.get(posKey(coilPos.x, coilPos.y)) : undefined
    const netMinus = coilNeg ? posToNet.get(posKey(coilNeg.x, coilNeg.y)) : undefined
    if (
      netCtrl !== undefined &&
      netSupply !== undefined &&
      netPlus !== undefined &&
      netMinus !== undefined &&
      netGnd !== undefined
    ) {
      channels.push({
        netCtrl,
        netSupply,
        netOut: netPlus,
        netGnd,
        netOutReturn: netMinus,
        coilResistance: parseNumericProperty(props.coilResistance, 120),
        vth,
        rdsOn,
        componentId: component.componentId,
        isOn: false,
        pwmMode: false,
      })
    }
    return { channels, idleLoads }
  }

  if (moduleType === 'SerialDriver') {
    const tx = findTerminal(terminals, (t) => t.moduleCell.pin === 'TX')
    const rx = findTerminal(terminals, (t) => t.moduleCell.pin === 'RX')
    if (tx && netSupply !== undefined && netGnd !== undefined) {
      const netCtrl = posToNet.get(posKey(tx.x, tx.y))
      if (netCtrl !== undefined) {
        channels.push({
          netCtrl,
          netSupply,
          netOut: netCtrl,
          netGnd,
          vth,
          rdsOn: 100,
          componentId: `${component.componentId}_tx`,
          isOn: false,
          pwmMode: false,
        })
      }
    }
    if (rx && netSupply !== undefined && netGnd !== undefined) {
      const netCtrl = posToNet.get(posKey(rx.x, rx.y))
      if (netCtrl !== undefined) {
        channels.push({
          netCtrl,
          netSupply,
          netOut: netCtrl,
          netGnd,
          vth,
          rdsOn: 100,
          componentId: `${component.componentId}_rx`,
          isOn: false,
          pwmMode: false,
        })
      }
    }
    return { channels, idleLoads }
  }

  // LEDDriver — single ctrl → out
  const ctrl = ctrls[0]
  const out = outs[0]
  if (!ctrl || !out || netSupply === undefined || netGnd === undefined) {
    return { channels, idleLoads }
  }
  const netCtrl = posToNet.get(posKey(ctrl.x, ctrl.y))
  const netOut = posToNet.get(posKey(out.x, out.y))
  if (netCtrl === undefined || netOut === undefined) return { channels, idleLoads }

  channels.push({
    netCtrl,
    netSupply,
    netOut,
    netGnd,
    vth,
    rdsOn,
    componentId: component.componentId,
    isOn: false,
    pwmMode: moduleType === 'LEDDriver',
  })

  return { channels, idleLoads }
}

export function driverChannelShouldBeOn(
  channel: DriverChannelStamp,
  voltages: number[],
  supplyVoltageHint: number
): boolean {
  if (channel.vth <= 0) return true
  const gndV = voltages[channel.netGnd] ?? 0
  if (channel.netEnable !== undefined) {
    const enV = voltages[channel.netEnable] ?? 0
    if (enV - gndV < channel.vth - 0.05) return false
  }
  const ctrlV = voltages[channel.netCtrl] ?? 0
  return ctrlV - gndV >= channel.vth - 0.05
}

export function driverChannelResistance(
  channel: DriverChannelStamp,
  voltages: number[],
  supplyVoltageHint: number
): number {
  if (!channel.isOn) return 1e9
  if (!channel.pwmMode) return channel.rdsOn

  const ctrlV = Math.max(0, (voltages[channel.netCtrl] ?? 0) - (voltages[channel.netGnd] ?? 0))
  const duty = Math.min(1, ctrlV / 5.0)
  if (duty <= 0.01) return 1e9
  return channel.rdsOn / duty
}
