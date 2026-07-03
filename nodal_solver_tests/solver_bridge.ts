/**
 * Runs CircuitWiz solveCircuit on preset test schematics and prints JSON to stdout.
 * Invoked by the Python test harness via: npx tsx nodal_solver_tests/solver_bridge.ts
 */

import { solveCircuit } from '../src/services/CircuitSolver'
import { buildSchematic, placeModule, wireBetween } from '../src/examples/schematicBuilder'
import type { Schematic } from '../src/types/workspace'

interface SerializedComponent {
  componentId: string
  componentType: string
  position: { x: number; y: number }
  outputVoltage: number
  outputCurrent: number
  voltageDrop?: number
  power?: number
  capacitorVoltage?: number
  isOn?: boolean
  status?: string
}

interface SerializedCircuit {
  id: string
  name: string
  works: boolean
  reason?: string
  errors: string[]
  totalVoltage: number
  totalCurrent: number
  totalResistance: number
  totalPower: number
  components: SerializedComponent[]
}

function serializeCircuit(id: string, schematic: Schematic): SerializedCircuit {
  const result = solveCircuit(schematic.gridData, schematic.wires)
  const components: SerializedComponent[] = []

  result.componentStates.forEach((state) => {
    components.push({
      componentId: state.componentId,
      componentType: state.componentType,
      position: state.position,
      outputVoltage: state.outputVoltage,
      outputCurrent: state.outputCurrent,
      voltageDrop: state.voltageDrop,
      power: state.power,
      capacitorVoltage: state.capacitorVoltage,
      isOn: state.isOn,
      status: state.status,
    })
  })

  return {
    id,
    name: schematic.name,
    works: result.works,
    reason: result.reason,
    errors: result.errors,
    totalVoltage: result.totalVoltage,
    totalCurrent: result.totalCurrent,
    totalResistance: result.totalResistance,
    totalPower: result.totalPower,
    components,
  }
}

function voltageDividerSchematic(): Schematic {
  return buildSchematic('Voltage Divider', 'R1 and R2 in series from 5V to GND.', ({ place, wire }) => {
    const ps = place('PowerSupply', 2, 10)
    const r1 = place('Resistor', 6, 10, { resistance: 10_000 })
    const r2 = place('Resistor', 6, 14, { resistance: 10_000 })

    wire([ps.pin('5V'), r1.at(0, 0)], { powered: true })
    wire([r1.at(2, 0), { x: 8, y: 12 }, r2.at(0, 0)])
    wire([r2.at(2, 0), { x: 8, y: 16 }, { x: 3, y: 16 }, { x: 3, y: 10 }, ps.pin('GND')], { grounded: true })
  })
}

function seriesResistorsSchematic(): Schematic {
  return buildSchematic('Series Resistors', '3kΩ + 2kΩ from 5V to GND.', ({ place, wire }) => {
    const ps = place('PowerSupply', 2, 10)
    const r1 = place('Resistor', 6, 10, { resistance: 3_000 })
    const r2 = place('Resistor', 10, 10, { resistance: 2_000 })

    wire([ps.pin('5V'), r1.at(0, 0)], { powered: true })
    wire([r1.at(2, 0), r2.at(0, 0)])
    wire([r2.at(2, 0), { x: 12, y: 10 }, { x: 12, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
      grounded: true,
    })
  })
}

function singleResistorLoadSchematic(): Schematic {
  return buildSchematic('Single Resistor Load', '5V through 1kΩ to GND.', ({ place, wire }) => {
    const ps = place('PowerSupply', 2, 10)
    const r = place('Resistor', 6, 10, { resistance: 1_000 })

    wire([ps.pin('5V'), r.at(0, 0)], { powered: true })
    wire([r.at(2, 0), { x: 8, y: 10 }, { x: 8, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
      grounded: true,
    })
  })
}

function parallelResistorsSchematic(): Schematic {
  return buildSchematic('Parallel Resistors', '1kΩ || 2kΩ from 5V to GND.', ({ place, wire }) => {
    const ps = place('PowerSupply', 2, 8)
    const r1 = place('Resistor', 6, 8, { resistance: 1_000 })
    const r2 = place('Resistor', 6, 12, { resistance: 2_000 })

    wire([ps.pin('5V'), { x: 4, y: 8 }, r1.at(0, 0)], { powered: true })
    wire([{ x: 4, y: 8 }, { x: 4, y: 12 }, r2.at(0, 0)], { powered: true })
    wire([r1.at(2, 0), { x: 10, y: 8 }, { x: 10, y: 12 }, r2.at(2, 0)])
    wire([r1.at(2, 0), { x: 10, y: 8 }, { x: 10, y: 16 }, { x: 3, y: 16 }, { x: 3, y: 8 }, ps.pin('GND')], {
      grounded: true,
    })
  })
}

function ledResistorSchematic(): Schematic {
  return buildSchematic('LED + Resistor', '5V -> 220Ω -> LED -> GND.', ({ place, wire }) => {
    const ps = place('PowerSupply', 2, 12)
    const r = place('Resistor', 6, 12, { resistance: 220 })
    const led = place('LED', 10, 12)

    wire([ps.pin('5V'), r.at(0, 0)], { powered: true })
    wire([r.at(2, 0), led.pin('+')])
    wire([led.pin('-'), { x: 12, y: 12 }, { x: 12, y: 16 }, { x: 3, y: 16 }, { x: 3, y: 10 }, ps.pin('GND')], {
      grounded: true,
    })
  })
}

function rcCircuitSchematic(): Schematic {
  return buildSchematic('RC Circuit', '5V -> 1kΩ -> 100µF -> GND.', ({ place, wire }) => {
    const ps = place('PowerSupply', 2, 10)
    const r = place('Resistor', 6, 10, { resistance: 1_000 })
    const c = place('Capacitor', 10, 10, { capacitance: 0.0001 })

    wire([ps.pin('5V'), r.at(0, 0)], { powered: true })
    wire([r.at(2, 0), c.pin('1')])
    wire([c.pin('2'), { x: 12, y: 10 }, { x: 12, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
      grounded: true,
    })
  })
}

function npnTransistorSchematic(): Schematic {
  return buildSchematic('NPN Transistor Switch', 'Low-side NPN switch with base bias.', ({ place, wire }) => {
    const ps = place('PowerSupply', 2, 8)
    const rLoad = place('Resistor', 6, 8, { resistance: 1_000 })
    const q = place('NPNTransistor', 10, 7)
    const rBase = place('Resistor', 6, 14, { resistance: 10_000 })

    wire([ps.pin('5V'), rLoad.at(0, 0)], { powered: true })
    wire([rLoad.at(2, 0), q.pin('C')])
    wire([q.pin('E'), { x: 11, y: 9 }, { x: 11, y: 12 }, { x: 3, y: 12 }, { x: 3, y: 8 }, ps.pin('GND')], {
      grounded: true,
    })
    wire([ps.pin('5V'), { x: 4, y: 14 }, rBase.at(0, 0)], { powered: true })
    wire([rBase.at(2, 0), { x: 8, y: 14 }, { x: 8, y: 8 }, q.pin('B')])
  })
}

function zenerClampSchematic(): Schematic {
  return buildSchematic('Zener Voltage Clamp', '3.3V Zener shunt regulator.', ({ place, wire }) => {
    const ps = place('PowerSupply', 2, 10)
    const r = place('Resistor', 6, 10, { resistance: 1_000 })
    const z = place('ZenerDiode', 10, 10, { zenerVoltage: 3.3 })

    wire([ps.pin('5V'), r.at(0, 0)], { powered: true })
    wire([r.at(2, 0), { x: 8, y: 10 }, z.pin('K')])
    wire([z.pin('A'), { x: 10, y: 14 }, { x: 12, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
      grounded: true,
    })
  })
}

function halfWaveRectifierSchematic(): Schematic {
  return buildSchematic('Half-Wave Rectifier', '12Vrms AC through a diode into 1kΩ load.', ({ place, wire }) => {
    const ac = place('ACSource', 2, 10, { vrms: 12 })
    const d = place('Diode', 8, 10)
    const rLoad = place('Resistor', 12, 10, { resistance: 1_000 })

    wire([ac.pin('AC1'), d.pin('A')], { powered: true })
    wire([ac.pin('AC2'), { x: 3, y: 10 }], { grounded: true })
    wire([d.pin('K'), rLoad.at(0, 0)])
    wire([rLoad.at(2, 0), { x: 14, y: 10 }, { x: 14, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ac.pin('AC2')], {
      grounded: true,
    })
  })
}

function opAmpOpenLoopSchematic(): Schematic {
  return buildSchematic(
    'Op-Amp Open Loop',
    'Non-inverting input driven by divider; inverting input at ground.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10)
      const rTop = place('Resistor', 6, 10, { resistance: 10_000 })
      const rBottom = place('Resistor', 6, 14, { resistance: 10_000 })
      const op = place('OpAmp', 12, 9)
      const rOut = place('Resistor', 16, 10, { resistance: 10_000 })

      wire([ps.pin('5V'), op.pin('V+')], { powered: true })
      wire([op.pin('V-'), { x: 13, y: 11 }, { x: 13, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
        grounded: true,
      })
      wire([ps.pin('5V'), rTop.at(0, 0)], { powered: true })
      wire([rTop.at(2, 0), { x: 8, y: 12 }, rBottom.at(0, 0)])
      wire([rBottom.at(2, 0), { x: 8, y: 16 }, { x: 3, y: 16 }, { x: 3, y: 10 }, ps.pin('GND')], { grounded: true })
      wire([{ x: 8, y: 12 }, { x: 8, y: 11 }, op.pin('+')])
      wire([op.pin('-'), { x: 11, y: 10 }, { x: 11, y: 14 }, { x: 3, y: 14 }], { grounded: true })
      wire([op.pin('OUT'), rOut.at(0, 0)])
      wire([rOut.at(2, 0), { x: 18, y: 10 }, { x: 18, y: 14 }, { x: 3, y: 14 }], { grounded: true })
    }
  )
}

const circuits: SerializedCircuit[] = [
  serializeCircuit('voltage_divider', voltageDividerSchematic()),
  serializeCircuit('series_resistors', seriesResistorsSchematic()),
  serializeCircuit('single_resistor', singleResistorLoadSchematic()),
  serializeCircuit('parallel_resistors', parallelResistorsSchematic()),
  serializeCircuit('led_resistor', ledResistorSchematic()),
  serializeCircuit('rc_circuit', rcCircuitSchematic()),
  serializeCircuit('npn_switch', npnTransistorSchematic()),
  serializeCircuit('zener_clamp', zenerClampSchematic()),
  serializeCircuit('half_wave_rectifier', halfWaveRectifierSchematic()),
  serializeCircuit('op_amp_open_loop', opAmpOpenLoopSchematic()),
]

process.stdout.write(JSON.stringify({ circuits }, null, 2))
