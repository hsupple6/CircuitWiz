import type { AnchorLogicProfile } from '../core/anchorLogic'

export const PASSIVE_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'Resistor',
    domain: 'passives',
    category: 'passives',
    kicadSymbol: 'Device/R_US.kicad_sym',
    passiveValue: 'resistor',
    chain: 'systems/chain/components/registry.ts → LEAD pairBidirectional',
    sim: 'systems/chain/solver/engine.ts → Resistor stamp',
    voltageFlow: 'passives/voltageFlow/Resistor.tsx',
  },
  {
    anchorId: 'Capacitor',
    domain: 'passives',
    category: 'passives',
    kicadSymbol: 'Device/C.kicad_sym',
    passiveValue: 'capacitor',
    chain: 'systems/chain/components/registry.ts → LEAD pairBidirectional',
    sim: 'systems/chain/solver/engine.ts → Capacitor stamp',
  },
  {
    anchorId: 'Inductor',
    domain: 'passives',
    category: 'passives',
    kicadSymbol: 'Device/L.kicad_sym',
    passiveValue: 'inductor',
    chain: 'systems/chain/components/registry.ts → LEAD pairBidirectional',
    sim: 'systems/chain/solver/engine.ts → Inductor stamp',
  },
]
