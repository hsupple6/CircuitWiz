import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'

import Antenna from './definitions/Antenna.json'
import BluetoothModule from './definitions/BluetoothModule.json'
import WirelessCharger from './definitions/WirelessCharger.json'

export const wirelessAnchors: Record<string, ModuleRegistryEntry> = {
  Antenna: {
    definition: Antenna as ModuleDefinition,
    category: 'wireless',
    keywords: ['antenna', 'rf', 'radio', 'feed', 'coax', 'wireless'],
  },
  BluetoothModule: {
    definition: BluetoothModule as ModuleDefinition,
    category: 'wireless',
    keywords: ['bluetooth', 'ble', 'hc-05', 'uart', 'wireless module'],
  },
  WirelessCharger: {
    definition: WirelessCharger as ModuleDefinition,
    category: 'wireless',
    paletteGroup: 'wireless-charging',
    keywords: ['wireless charger', 'qi', 'inductive', 'tx coil'],
  },
}

export { wirelessAliases } from './aliases'
