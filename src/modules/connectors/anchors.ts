import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'
import { ConnectorType } from '../types/Connector'

import NPinConnector from './definitions/NPinConnector.json'

export const connectorAnchors: Record<string, ModuleRegistryEntry> = {
  NPinConnector: {
    definition: NPinConnector as ModuleDefinition,
    type: ConnectorType,
    category: 'connectors',
    keywords: [
      'connector',
      'n pin',
      'terminal',
      'header',
      'jst',
      'screw terminal',
      'plug',
      'socket',
      'male',
      'female',
    ],
  },
}
