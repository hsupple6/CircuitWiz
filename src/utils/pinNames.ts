import type { ModuleDefinition } from '../modules/types'

type ModuleCell = ModuleDefinition['grid'][number]

const DUAL_TERMINAL_MODULES = new Set(['Resistor', 'Capacitor', 'Inductor'])

const GLOBAL_ALIASES: Record<string, string[]> = {
  A: ['ANODE', 'IN', 'INPUT', '+', 'POS', 'POSITIVE'],
  K: ['CATHODE', 'OUT', 'OUTPUT', '-', 'NEG', 'NEGATIVE'],
  G: ['GATE'],
  D: ['DRAIN'],
  S: ['SOURCE'],
  B: ['BASE'],
  C: ['COLLECTOR'],
  E: ['EMITTER'],
  '+': ['PLUS', 'POS', 'POSITIVE', 'ANODE'],
  '-': ['MINUS', 'NEG', 'NEGATIVE', 'CATHODE'],
  '1': ['T1', 'PIN1', 'LEFT', 'LEAD1'],
  '2': ['T2', 'PIN2', 'RIGHT', 'LEAD2'],
  AC1: ['AC', 'L', 'HOT'],
  AC2: ['AC_RETURN', 'N', 'NEUTRAL'],
  '5V': ['VCC', 'VDD', 'POWER', 'V+'],
  GND: ['VSS', 'GROUND', 'V-'],
  'V+': ['VCC', 'VDD'],
  'V-': ['VEE', 'GND', 'VSS'],
  OUT: ['OUTPUT'],
}

function canonicalPin(value: string): string {
  return value.trim().toUpperCase()
}

function isDualTerminalLead(moduleName: string, cell: ModuleCell): boolean {
  return DUAL_TERMINAL_MODULES.has(moduleName) && cell.type === 'LEAD'
}

export function primaryPinName(
  cell: ModuleCell,
  moduleName?: string,
  gridWidth?: number
): string {
  if (cell.pin) return cell.pin
  if (moduleName && gridWidth && isDualTerminalLead(moduleName, cell)) {
    if (cell.x === 0) return '1'
    if (cell.x === gridWidth - 1) return '2'
  }
  return cell.type
}

function aliasesForCell(moduleName: string, cell: ModuleCell, gridWidth?: number): string[] {
  const names = new Set<string>()
  const dualLead = isDualTerminalLead(moduleName, cell)

  if (cell.pin) names.add(canonicalPin(cell.pin))
  if (!dualLead && cell.type) names.add(canonicalPin(cell.type))

  if (dualLead && gridWidth) {
    if (cell.x === 0) {
      names.add('1')
      names.add('LEFT')
    } else if (cell.x === gridWidth - 1) {
      names.add('2')
      names.add('RIGHT')
    }
  }

  for (const base of [...names]) {
    for (const alias of GLOBAL_ALIASES[base] ?? []) {
      names.add(canonicalPin(alias))
    }
  }

  if (moduleName === 'Diode') {
    if (cell.type === 'ANODE' || cell.pin === 'A') {
      ;['ANODE', 'IN', 'INPUT'].forEach((a) => names.add(a))
    }
    if (cell.type === 'CATHODE' || cell.pin === 'K') {
      ;['CATHODE', 'OUT', 'OUTPUT'].forEach((a) => names.add(a))
    }
  }

  if (moduleName === 'ZenerDiode') {
    if (cell.type === 'CATHODE' || cell.pin === 'K') {
      ;['CATHODE', 'IN', 'INPUT'].forEach((a) => names.add(a))
    }
    if (cell.type === 'ANODE' || cell.pin === 'A') {
      ;['ANODE', 'OUT', 'OUTPUT'].forEach((a) => names.add(a))
    }
  }

  return [...names]
}

export function cellMatchesPin(
  moduleName: string,
  cell: ModuleCell,
  requestedPin: string,
  gridWidth?: number
): boolean {
  if (!cell.isConnectable) return false
  const req = canonicalPin(requestedPin)
  return aliasesForCell(moduleName, cell, gridWidth).includes(req)
}

export function listConnectablePins(moduleName: string, def: ModuleDefinition) {
  return def.grid
    .filter((cell) => cell.isConnectable)
    .map((cell) => {
      const name = primaryPinName(cell, moduleName, def.gridX)
      return {
        name,
        type: cell.type,
        relX: cell.x,
        relY: cell.y,
        aliases: aliasesForCell(moduleName, cell, def.gridX).filter(
          (a) => a !== canonicalPin(name)
        ),
        wiringNote:
          'Absolute grid cell = component origin + relX/relY. Connect wires only to these terminal cells, never the body (relX=1 on 3-wide passives).',
      }
    })
}
