import type { AnchorLogicProfile } from '../core/anchorLogic'

export const SEMICONDUCTOR_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'Diode',
    domain: 'semiconductors',
    category: 'semiconductors',
    kicadSymbol: 'Device/D.kicad_sym',
    chain: 'systems/chain/components/registry.ts → ANODE→CATHODE directed',
    sim: 'systems/chain/solver/engine.ts → Diode stamp',
  },
  {
    anchorId: 'ZenerDiode',
    domain: 'semiconductors',
    category: 'semiconductors',
    kicadSymbol: 'Device/D_Zener.kicad_sym',
    chain: 'systems/chain/components/registry.ts → Zener bidirectional',
    sim: 'systems/chain/solver/engine.ts → ZenerDiode stamp',
  },
  {
    anchorId: 'NPNTransistor',
    domain: 'semiconductors',
    category: 'semiconductors',
    kicadSymbol: 'Device/Q_NPN.kicad_sym',
    chain: 'systems/chain/components/registry.ts → C↔E',
    sim: 'systems/chain/solver/engine.ts → NPNTransistor stamp',
  },
  {
    anchorId: 'MOSFET',
    domain: 'semiconductors',
    category: 'semiconductors',
    kicadSymbol: 'Device/Q_NMOS.kicad_sym',
    chain: 'systems/chain/components/registry.ts → D↔S',
    sim: 'systems/chain/solver/engine.ts → MOSFET stamp',
  },
  {
    anchorId: 'OpAmp',
    domain: 'semiconductors',
    category: 'semiconductors',
    kicadSymbol: 'Amplifier_Operational/LM358.kicad_sym',
    chain: 'systems/chain/components/registry.ts → (no internal edges)',
    sim: 'systems/chain/solver/engine.ts → OpAmp stamp',
  },
  {
    anchorId: 'BridgeRectifier',
    domain: 'semiconductors',
    category: 'semiconductors',
    kicadSymbol: 'Device/D_Bridge.kicad_sym',
    chain: 'systems/chain/components/registry.ts → bridge paths',
    sim: 'systems/chain/solver/engine.ts → BridgeRectifier stamp',
  },
]
