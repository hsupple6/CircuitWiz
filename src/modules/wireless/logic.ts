import type { AnchorLogicProfile } from '../core/anchorLogic'

export const WIRELESS_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'Antenna',
    domain: 'wireless',
    category: 'wireless',
    kicadSymbol: 'Device/L.kicad_sym',
    chain: 'systems/chain/components/registry.ts → FEED/SHLD connectable; no internal bridge',
    sim: 'systems/chain/wirelessStamps.ts → RF pin high-Z bleed',
  },
  {
    anchorId: 'BluetoothModule',
    domain: 'wireless',
    category: 'wireless',
    kicadSymbol: 'Device/Q_NPN.kicad_sym',
    chain: 'systems/chain/components/registry.ts → UART + ANT; dummy KEY/STATE',
    sim: 'systems/chain/wirelessStamps.ts → idle load + TX/RX pass-through',
  },
  {
    anchorId: 'WirelessCharger',
    domain: 'wireless',
    category: 'wireless',
    kicadSymbol: 'Device/L.kicad_sym',
    chain: 'systems/chain/components/registry.ts → VIN→COIL/OUT drive',
    sim: 'systems/chain/wirelessStamps.ts → Qi TX idle + coil drive',
  },
]

export const WIRELESS_MODULE_TYPES = new Set(WIRELESS_ANCHOR_LOGIC.map((p) => p.anchorId))

export function isWirelessModule(moduleType: string): boolean {
  return WIRELESS_MODULE_TYPES.has(moduleType)
}
