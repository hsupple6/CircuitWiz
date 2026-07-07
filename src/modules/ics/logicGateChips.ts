export type GateFn = 'and' | 'or' | 'nand' | 'nor' | 'xor' | 'not'

export interface GateSpec {
  inputs: string[]
  output: string
  fn: GateFn
}

export interface LogicGateChipSpec {
  id: string
  description: string
  keywords: string[]
  /** DIP pin number (1–14) → label */
  pinout: Record<number, string>
  gates: GateSpec[]
  kicadSymbol?: string
}

function quad2Pinout(): Record<number, string> {
  return {
    1: '1A',
    2: '1B',
    3: '1Y',
    4: '2A',
    5: '2B',
    6: '2Y',
    7: 'GND',
    8: '3Y',
    9: '3A',
    10: '3B',
    11: '4Y',
    12: '4A',
    13: '4B',
    14: 'VCC',
  }
}

function quad2Gates(fn: GateFn): GateSpec[] {
  return [1, 2, 3, 4].map((n) => ({
    inputs: [`${n}A`, `${n}B`],
    output: `${n}Y`,
    fn,
  }))
}

function hexInvPinout(): Record<number, string> {
  return {
    1: '1Y',
    2: '1A',
    3: '2Y',
    4: '2A',
    5: '3Y',
    6: '3A',
    7: 'GND',
    8: '4A',
    9: '4Y',
    10: '5A',
    11: '5Y',
    12: '6A',
    13: '6Y',
    14: 'VCC',
  }
}

function hexInvGates(): GateSpec[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    inputs: [`${n}A`],
    output: `${n}Y`,
    fn: 'not' as const,
  }))
}

function triple3Pinout(): Record<number, string> {
  return {
    1: '1A',
    2: '1B',
    3: '1C',
    4: '1Y',
    5: '2A',
    6: '2B',
    7: 'GND',
    8: '2C',
    9: '2Y',
    10: '3A',
    11: '3B',
    12: '3C',
    13: '3Y',
    14: 'VCC',
  }
}

function triple3Gates(fn: GateFn): GateSpec[] {
  return [1, 2, 3].map((n) => ({
    inputs: [`${n}A`, `${n}B`, `${n}C`],
    output: `${n}Y`,
    fn,
  }))
}

function dual4Pinout(): Record<number, string> {
  return {
    1: '1A',
    2: '1B',
    3: '2A',
    4: '2B',
    5: '1Y',
    6: '2Y',
    7: 'GND',
    8: '4B',
    9: '4A',
    10: 'NC',
    11: 'NC',
    12: '3A',
    13: '3B',
    14: 'VCC',
  }
}

function dual4Gates(fn: GateFn): GateSpec[] {
  return [
    { inputs: ['1A', '1B', '2A', '2B'], output: '1Y', fn },
    { inputs: ['3A', '3B', '4A', '4B'], output: '2Y', fn },
  ]
}

function nand8Pinout(): Record<number, string> {
  return {
    1: 'A1',
    2: 'A2',
    3: 'A3',
    4: 'A4',
    5: 'B1',
    6: 'B2',
    7: 'GND',
    8: 'B3',
    9: 'B4',
    10: 'Y',
    11: 'NC1',
    12: 'NC2',
    13: 'NC3',
    14: 'VCC',
  }
}

export const LOGIC_GATE_CHIPS: LogicGateChipSpec[] = [
  {
    id: '74HC00',
    description: 'Quad 2-input NAND gate',
    keywords: ['74hc00', 'nand', 'quad gate', 'hc00'],
    pinout: quad2Pinout(),
    gates: quad2Gates('nand'),
    kicadSymbol: '74xx_74HC00.kicad_sym',
  },
  {
    id: '74HC02',
    description: 'Quad 2-input NOR gate',
    keywords: ['74hc02', 'nor', 'quad gate', 'hc02'],
    pinout: quad2Pinout(),
    gates: quad2Gates('nor'),
    kicadSymbol: '74xx_74HC02.kicad_sym',
  },
  {
    id: '74HC04',
    description: 'Hex inverter',
    keywords: ['74hc04', 'not', 'inverter', 'hex', 'hc04'],
    pinout: hexInvPinout(),
    gates: hexInvGates(),
    kicadSymbol: '74xx_74HC04.kicad_sym',
  },
  {
    id: '74HC08',
    description: 'Quad 2-input AND gate',
    keywords: ['74hc08', 'and', 'quad gate', 'hc08'],
    pinout: quad2Pinout(),
    gates: quad2Gates('and'),
    kicadSymbol: '74xx_74HC08.kicad_sym',
  },
  {
    id: '74HC10',
    description: 'Triple 3-input NAND gate',
    keywords: ['74hc10', 'nand', 'triple gate', 'hc10'],
    pinout: triple3Pinout(),
    gates: triple3Gates('nand'),
    kicadSymbol: '74xx_74HC10.kicad_sym',
  },
  {
    id: '74HC11',
    description: 'Triple 3-input AND gate',
    keywords: ['74hc11', 'and', 'triple gate', 'hc11'],
    pinout: triple3Pinout(),
    gates: triple3Gates('and'),
    kicadSymbol: '74xx_74HC11.kicad_sym',
  },
  {
    id: '74HC14',
    description: 'Hex Schmitt-trigger inverter',
    keywords: ['74hc14', 'schmitt', 'inverter', 'hex', 'hc14'],
    pinout: hexInvPinout(),
    gates: hexInvGates(),
    kicadSymbol: '74xx_74HC14.kicad_sym',
  },
  {
    id: '74HC20',
    description: 'Dual 4-input NAND gate',
    keywords: ['74hc20', 'nand', 'dual gate', 'hc20'],
    pinout: dual4Pinout(),
    gates: dual4Gates('nand'),
    kicadSymbol: '74xx_74HC20.kicad_sym',
  },
  {
    id: '74HC21',
    description: 'Dual 4-input AND gate',
    keywords: ['74hc21', 'and', 'dual gate', 'hc21'],
    pinout: dual4Pinout(),
    gates: dual4Gates('and'),
    kicadSymbol: '74xx_74HC21.kicad_sym',
  },
  {
    id: '74HC27',
    description: 'Triple 3-input NOR gate',
    keywords: ['74hc27', 'nor', 'triple gate', 'hc27'],
    pinout: triple3Pinout(),
    gates: triple3Gates('nor'),
    kicadSymbol: '74xx_74HC27.kicad_sym',
  },
  {
    id: '74HC30',
    description: '8-input NAND gate',
    keywords: ['74hc30', 'nand', '8-input', 'hc30'],
    pinout: nand8Pinout(),
    gates: [
      {
        inputs: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'],
        output: 'Y',
        fn: 'nand',
      },
    ],
    kicadSymbol: '74xx_74HC30.kicad_sym',
  },
  {
    id: '74HC32',
    description: 'Quad 2-input OR gate',
    keywords: ['74hc32', 'or', 'quad gate', 'hc32'],
    pinout: quad2Pinout(),
    gates: quad2Gates('or'),
    kicadSymbol: '74xx_74HC32.kicad_sym',
  },
  {
    id: '74HC86',
    description: 'Quad 2-input XOR gate',
    keywords: ['74hc86', 'xor', 'quad gate', 'hc86'],
    pinout: quad2Pinout(),
    gates: quad2Gates('xor'),
    kicadSymbol: '74xx_74HC86.kicad_sym',
  },
]

export const LOGIC_GATE_CHIP_INDEX = new Map(LOGIC_GATE_CHIPS.map((c) => [c.id, c]))

export function resolveLogicGateChip(chipId: string): LogicGateChipSpec | undefined {
  return LOGIC_GATE_CHIP_INDEX.get(chipId)
}
