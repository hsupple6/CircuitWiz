import { parseNumericProperty, posKey } from './utils'
import type { PlacedComponent } from './types'
import { isWirelessModule } from '../../modules/wireless/logic'
import type { DriverChannelStamp, DriverIdleLoadStamp } from './components/driverStamps'

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
      t.moduleCell.pin === 'VCC' ||
      t.moduleCell.pin === 'VIN'
  )
}

function gndTerminal(terminals: TerminalLike[]): TerminalLike | undefined {
  return findTerminal(
    terminals,
    (t) => t.moduleCell.type === 'GND' || t.moduleCell.pin === 'GND'
  )
}

export function collectWirelessStamps(
  moduleType: string,
  component: PlacedComponent,
  terminals: TerminalLike[],
  posToNet: Map<string, number>
): { channels: DriverChannelStamp[]; idleLoads: DriverIdleLoadStamp[] } {
  const channels: DriverChannelStamp[] = []
  const idleLoads: DriverIdleLoadStamp[] = []
  if (!isWirelessModule(moduleType)) return { channels, idleLoads }

  if (moduleType === 'BluetoothModule') {
    const props = component.moduleDefinition.properties ?? {}
    const vth = parseNumericProperty(props.vth, 1.5)
    const supply = supplyTerminal(terminals)
    const gnd = gndTerminal(terminals)
    const netSupply = supply ? posToNet.get(posKey(supply.x, supply.y)) : undefined
    const netGnd = gnd ? posToNet.get(posKey(gnd.x, gnd.y)) : undefined

    if (netSupply !== undefined && netGnd !== undefined) {
      const idleR = 1000 / Math.max(parseNumericProperty(props.idleCurrent, 0.008), 1e-6)
      idleLoads.push({
        netPos: netSupply,
        netNeg: netGnd,
        resistance: idleR,
        componentId: `${component.componentId}_idle`,
      })
    }

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
  }

  if (moduleType === 'WirelessCharger') {
    const props = component.moduleDefinition.properties ?? {}
    const supply = supplyTerminal(terminals)
    const gnd = gndTerminal(terminals)
    const netSupply = supply ? posToNet.get(posKey(supply.x, supply.y)) : undefined
    const netGnd = gnd ? posToNet.get(posKey(gnd.x, gnd.y)) : undefined

    if (netSupply !== undefined && netGnd !== undefined) {
      const idleR = 1000 / Math.max(parseNumericProperty(props.idleCurrent, 0.01), 1e-6)
      idleLoads.push({
        netPos: netSupply,
        netNeg: netGnd,
        resistance: idleR,
        componentId: `${component.componentId}_idle`,
      })
    }

    const out = findTerminal(
      terminals,
      (t) => t.moduleCell.type === 'DRIVER_OUT' || t.moduleCell.pin === 'OUT'
    )
    const netOut = out ? posToNet.get(posKey(out.x, out.y)) : undefined
    if (netSupply !== undefined && netOut !== undefined && netGnd !== undefined) {
      channels.push({
        netCtrl: netSupply,
        netSupply,
        netOut,
        netGnd,
        vth: 0,
        rdsOn: 0.2,
        componentId: component.componentId,
        isOn: true,
        pwmMode: false,
      })
    }
  }

  return { channels, idleLoads }
}

/** RF / UART control pins that should not float in DC sim. */
export function isWirelessFloatingPin(moduleType: string, moduleCell: { type?: string; pin?: string }): boolean {
  if (!isWirelessModule(moduleType)) return false
  if (moduleType === 'Antenna') {
    return moduleCell.type === 'RF' || moduleCell.pin === 'FEED'
  }
  if (moduleType === 'BluetoothModule') {
    return (
      moduleCell.type === 'DRIVER_CTRL' ||
      moduleCell.type === 'RF' ||
      moduleCell.pin === 'TX' ||
      moduleCell.pin === 'RX' ||
      moduleCell.pin === 'EN'
    )
  }
  if (moduleType === 'WirelessCharger') {
    return moduleCell.type === 'RF' || moduleCell.pin === 'COIL'
  }
  return false
}
