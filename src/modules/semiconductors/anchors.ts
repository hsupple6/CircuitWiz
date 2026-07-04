import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'

import Diode from './definitions/Diode.json'
import ZenerDiode from './definitions/ZenerDiode.json'
import NPNTransistor from './definitions/NPNTransistor.json'
import PNPTransistor from './definitions/PNPTransistor.json'
import MOSFET from './definitions/MOSFET.json'
import PMOSFET from './definitions/PMOSFET.json'
import OpAmp from './definitions/OpAmp.json'
import BridgeRectifier from './definitions/BridgeRectifier.json'

export const semiconductorAnchors: Record<string, ModuleRegistryEntry> = {
  Diode: {
    definition: Diode as ModuleDefinition,
    category: 'semiconductors',
    keywords: ['diode', 'rectifier', 'silicon', '1n4007'],
  },
  ZenerDiode: {
    definition: ZenerDiode as ModuleDefinition,
    category: 'semiconductors',
    keywords: ['zener', 'clamp', 'regulator', 'breakdown'],
  },
  NPNTransistor: {
    definition: NPNTransistor as ModuleDefinition,
    category: 'semiconductors',
    keywords: ['npn', 'transistor', 'bjt', '2n2222', 'switch'],
  },
  MOSFET: {
    definition: MOSFET as ModuleDefinition,
    category: 'semiconductors',
    keywords: ['mosfet', 'fet', 'nmos', 'n-channel', '2n7000', 'switch'],
  },
  PNPTransistor: {
    definition: PNPTransistor as ModuleDefinition,
    category: 'semiconductors',
    keywords: ['pnp', 'transistor', 'bjt', '2n3906', 'high-side'],
  },
  PMOSFET: {
    definition: PMOSFET as ModuleDefinition,
    category: 'semiconductors',
    keywords: ['pmos', 'p-channel', 'mosfet', 'irf9540', 'high-side'],
  },
  OpAmp: {
    definition: OpAmp as ModuleDefinition,
    category: 'semiconductors',
    keywords: ['op-amp', 'opamp', 'amplifier', 'lm358', 'tl072'],
  },
  BridgeRectifier: {
    definition: BridgeRectifier as ModuleDefinition,
    category: 'semiconductors',
    keywords: ['bridge', 'rectifier', 'full-wave', 'diode bridge'],
  },
}
