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
]
