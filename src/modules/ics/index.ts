import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'

import LinearRegulator from './definitions/LinearRegulator.json'
import FixedRegulator from './definitions/FixedRegulator.json'
import { logicGateAnchors } from './logicGateAnchors'

export const icAnchors: Record<string, ModuleRegistryEntry> = {
  LinearRegulator: {
    definition: LinearRegulator as ModuleDefinition,
    category: 'ics',
    paletteGroup: 'regulators',
    keywords: ['lm317', 'linear regulator', 'adjustable regulator', 'voltage regulator'],
  },
  FixedRegulator: {
    definition: FixedRegulator as ModuleDefinition,
    category: 'ics',
    paletteGroup: 'regulators',
    keywords: ['ldo', 'fixed regulator', 'ams1117', 'lm7805', 'linear regulator', 'voltage regulator'],
  },
  ...logicGateAnchors,
}

export { icAliases } from './aliases'
