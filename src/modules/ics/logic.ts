import type { AnchorLogicProfile } from '../core/anchorLogic'

export const IC_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'LinearRegulator',
    domain: 'ics',
    category: 'ics',
    kicadSymbol: 'Regulator_Linear/LM317.kicad_sym',
    chain: 'systems/chain/components/registry.ts → VIN/ADJ/VOUT/GND',
    sim: 'systems/chain/regulatorStamps.ts → Vout from ADJ divider (Vref × (1 + R2/R1))',
  },
  {
    anchorId: 'FixedRegulator',
    domain: 'ics',
    category: 'ics',
    kicadSymbol: 'Regulator_Linear/AP1117-33.kicad_sym',
    chain: 'systems/chain/components/registry.ts → VIN→VOUT pass-through',
    sim: 'systems/chain/regulatorStamps.ts → fixed Vout from outputVoltage property',
  },
  {
    anchorId: 'LogicGateIC',
    domain: 'ics',
    category: 'ics',
    kicadSymbol: '74xx_74HC00.kicad_sym',
    chain: 'systems/chain/components/registry.ts → VCC/GND supply; I/O pins isolated',
    sim: 'systems/chain/logicGateStamps.ts → HC logic threshold + combinatorial outputs',
  },
]

export const IC_MODULE_TYPES = new Set(IC_ANCHOR_LOGIC.map((p) => p.anchorId))

export function isIcModule(moduleType: string): boolean {
  return IC_MODULE_TYPES.has(moduleType)
}
