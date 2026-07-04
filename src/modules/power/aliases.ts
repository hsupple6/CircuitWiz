import type { AliasSpec } from '../core/aliasTypes'

export const powerAliases: AliasSpec[] = [
  {
    name: 'Battery',
    anchor: 'PowerSupply',
    category: 'power',
    paletteGroup: 'batteries',
    kicadSymbol: 'Device/Battery.kicad_sym',
    description: 'DC battery cell or pack',
    keywords: ['battery', 'cell', 'lipo', '9v', 'aa'],
  },
  {
    name: 'Battery Holder',
    anchor: 'PowerSupply',
    category: 'power',
    paletteGroup: 'batteries',
    kicadSymbol: 'Device/Battery.kicad_sym',
    description: 'Battery holder with + and − terminals',
    keywords: ['battery holder', 'aa', 'aaa', '18650'],
  },
  {
    name: 'Coin Cell Holder',
    anchor: 'PowerSupply',
    category: 'power',
    paletteGroup: 'batteries',
    kicadSymbol: 'Device/Battery.kicad_sym',
    description: 'Coin cell battery holder (CR2032 etc.)',
    keywords: ['coin cell', 'cr2032', 'holder'],
  },
  {
    name: 'Barrel Jack',
    anchor: 'PowerSupply',
    category: 'power',
    kicadSymbol: 'Device/Battery.kicad_sym',
    description: 'DC barrel jack power input',
    keywords: ['barrel', 'dc jack', '2.1mm', 'power input'],
  },
]
