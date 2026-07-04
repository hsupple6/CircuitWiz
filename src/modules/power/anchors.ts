import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'
import { PowerType } from '../types/Power'

import PowerSupply from './definitions/PowerSupply.json'
import ACSource from './definitions/ACSource.json'

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
}
