import type { ModuleRegistryEntry } from '../core/registryTypes'
import { buildLogicGateModule } from './buildLogicGateModule'
import { LOGIC_GATE_CHIPS } from './logicGateChips'

export const logicGateAnchors: Record<string, ModuleRegistryEntry> = Object.fromEntries(
  LOGIC_GATE_CHIPS.map((chip) => [
    chip.id,
    {
      definition: buildLogicGateModule(chip),
      category: 'ics',
      paletteGroup: 'logic-gates',
      keywords: chip.keywords,
    },
  ])
)
