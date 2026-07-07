import type { AliasSpec } from '../core/aliasTypes'

export const switchAliases: AliasSpec[] = [
  {
    name: 'Reed Switch',
    anchor: 'Switch',
    category: 'switches',
    description: 'Magnetically actuated reed switch',
    keywords: ['reed', 'magnetic', 'door sensor'],
  },
  {
    name: 'Relay',
    anchor: 'Switch',
    category: 'switches',
    description: 'SPST relay contact (coil driven separately)',
    keywords: ['relay', 'spst', 'contact'],
  },
  {
    name: 'Miniature Relay',
    anchor: 'Switch',
    category: 'switches',
    description: 'Miniature SPST relay contact (coil driven separately)',
    keywords: ['miniature relay', 'mini relay', 'small relay', 'spst'],
  },
  {
    name: 'DIP Switch',
    anchor: 'Switch',
    category: 'switches',
    description: 'DIP switch — single pole shown; add multiples in schematic',
    keywords: ['dip', 'switch', 'configuration'],
  },
  {
    name: 'Jumper',
    anchor: 'Switch',
    category: 'test',
    description: 'Closed jumper link (default ON)',
    keywords: ['jumper', 'shunt', 'link'],
  },
  {
    name: 'Tilt Sensor',
    anchor: 'Push Button',
    category: 'sensors',
    description: 'Ball tilt switch — closes when tilted',
    keywords: ['tilt', 'ball switch', 'orientation'],
  },
]
