import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'
import { PowerType } from '../types/Power'

import PowerSupply from './definitions/PowerSupply.json'
import ACSource from './definitions/ACSource.json'
import LiIonPack from './definitions/LiIonPack.json'
import ChargerProtection from './definitions/ChargerProtection.json'

export const powerAnchors: Record<string, ModuleRegistryEntry> = {
  PowerSupply: {
    definition: PowerSupply as ModuleDefinition,
    type: PowerType,
    category: 'power',
    keywords: ['power supply', 'bench', '5v', 'barrel'],
  },
  ACSource: {
    definition: ACSource as ModuleDefinition,
    type: PowerType,
    category: 'power',
    keywords: ['ac', 'alternating', 'sine', 'transformer', 'mains'],
  },
  LiIonPack: {
    definition: LiIonPack as ModuleDefinition,
    type: PowerType,
    category: 'power',
    paletteGroup: 'batteries',
    keywords: ['li-ion', 'lithium', '18650', 'battery module', 'lipo pack'],
  },
  ChargerProtection: {
    definition: ChargerProtection as ModuleDefinition,
    type: PowerType,
    category: 'power',
    paletteGroup: 'protection',
    keywords: ['bms', 'protection', 'dw01', 'tp4056 protect', 'charger protection'],
  },
}
