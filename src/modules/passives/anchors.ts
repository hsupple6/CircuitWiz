import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'

import Resistor from './definitions/Resistor.json'
import Capacitor from './definitions/Capacitor.json'
import Inductor from './definitions/Inductor.json'
import Potentiometer from '../output/definitions/Potentiometer.json'

export const passiveAnchors: Record<string, ModuleRegistryEntry> = {
  Resistor: {
    definition: Resistor as ModuleDefinition,
    category: 'passives',
    keywords: ['resistor', 'ohm', 'pull-up'],
  },
  Capacitor: {
    definition: Capacitor as ModuleDefinition,
    category: 'passives',
    keywords: ['capacitor', 'ceramic', 'electrolytic', 'decouple', 'uf'],
  },
  Inductor: {
    definition: Inductor as ModuleDefinition,
    category: 'passives',
    keywords: ['inductor', 'coil', 'choke', 'ferrite'],
  },
  Potentiometer: {
    definition: Potentiometer as ModuleDefinition,
    category: 'passives',
    keywords: ['potentiometer', 'pot', 'knob', 'analog', 'divider'],
  },
}
