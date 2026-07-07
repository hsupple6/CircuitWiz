import type { AnchorLogicProfile } from '../core/anchorLogic'

export const POWER_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'PowerSupply',
    domain: 'power',
    category: 'power',
    kicadSymbol: 'Device/Battery.kicad_sym',
    chain: 'systems/chain/components/registry.ts → VCC/GND source',
    sim: 'systems/chain/solver/engine.ts → PowerSupply/Battery stamp',
    voltageFlow: 'utils/powerSupplies.ts',
  },
  {
    anchorId: 'ACSource',
    domain: 'power',
    category: 'power',
    kicadSymbol: 'Simulation_SPICE/VSIN.kicad_sym',
    passiveValue: 'ac',
    chain: 'systems/chain/components/registry.ts → AC pairBidirectional',
    sim: 'systems/chain/solver/engine.ts → ACSource stamp',
  },
  {
    anchorId: 'LiIonPack',
    domain: 'power',
    category: 'power',
    kicadSymbol: 'Device/Battery.kicad_sym',
    chain: 'systems/chain/components/registry.ts → P+/P− source; CHG± tied to pack',
    sim: 'systems/chain/powerStamps.ts → LiIonPack voltage source + charge tie',
    voltageFlow: 'utils/powerSupplies.ts',
  },
  {
    anchorId: 'ChargerProtection',
    domain: 'power',
    category: 'power',
    kicadSymbol: 'Device/R_US.kicad_sym',
    chain: 'systems/chain/components/registry.ts → BAT± to OUT± pass-through',
    sim: 'systems/chain/powerStamps.ts → protection series R bridge',
  },
]

export const POWER_PACK_MODULE_TYPES = new Set(['PowerSupply', 'LiIonPack'])

export function isPowerPackModule(moduleType: string): boolean {
  return POWER_PACK_MODULE_TYPES.has(moduleType) || moduleType === 'Battery'
}
