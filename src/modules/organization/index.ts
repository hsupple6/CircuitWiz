import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'

import GroupBox from './definitions/GroupBox.json'

export const organizationAnchors: Record<string, ModuleRegistryEntry> = {
  'Group Box': {
    definition: GroupBox as ModuleDefinition,
    category: 'organization',
    keywords: ['group', 'box', 'region', 'label', 'organize', 'section', 'annotation'],
  },
}

export const organizationAliases: never[] = []
