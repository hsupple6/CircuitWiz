import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'

import Switch from './definitions/Switch.json'
import PushButton from './definitions/PushButton.json'
import LimitSwitch from './definitions/LimitSwitch.json'

export const switchAnchors: Record<string, ModuleRegistryEntry> = {
  Switch: {
    definition: Switch as ModuleDefinition,
    category: 'switches',
    keywords: ['switch', 'toggle', 'spst'],
  },
  'Push Button': {
    definition: PushButton as ModuleDefinition,
    category: 'switches',
    keywords: ['button', 'push', 'momentary', 'tact'],
  },
  'Limit Switch': {
    definition: LimitSwitch as ModuleDefinition,
    category: 'switches',
    keywords: ['limit', 'endstop', 'normally open', 'no'],
  },
}
