import type { AnchorLogicProfile } from '../core/anchorLogic'

export const SWITCH_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'Switch',
    domain: 'switches',
    category: 'switches',
    kicadSymbol: 'Switch/SW_SPST.kicad_sym',
    chain: 'systems/chain/components/registry.ts → closed SPST',
    sim: 'systems/chain/solver/engine.ts → Switch stamp',
  },
  {
    anchorId: 'Push Button',
    domain: 'switches',
    category: 'switches',
    kicadSymbol: 'Switch/SW_Push.kicad_sym',
    chain: 'systems/chain/components/registry.ts → momentary closed',
    sim: 'systems/chain/solver/engine.ts → Push Button stamp',
  },
  {
    anchorId: 'Limit Switch',
    domain: 'switches',
    category: 'switches',
    kicadSymbol: 'Switch/SW_Push.kicad_sym',
    chain: 'same as Push Button',
    sim: 'same as Push Button',
  },
]
