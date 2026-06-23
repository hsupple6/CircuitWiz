import {
  createSchematicGroupBox,
  createDocument,
  type Schematic,
  type Document,
} from '../types/workspace'
import { buildSchematic } from './schematicBuilder'

function placeholderSchematic(
  name: string,
  description: string,
  note: string,
  formula: string
): Schematic {
  return buildSchematic(
    name,
    `${description}\n\nExpected: ${formula}\n\n${note}`,
    () => {},
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(4, 6, 28, 14, name, {
            name: 'Amber',
            fill: 'rgba(254, 243, 199, 0.55)',
            border: '#FBBF24',
          }),
          title: name,
        },
        {
          id: `ex-note-${name.replace(/\s+/g, '-')}`,
          x: 6,
          y: 8,
          width: 24,
          height: 10,
          title: 'Pending component library',
          color: 'rgba(255, 255, 255, 0.7)',
          borderColor: '#94A3B8',
        },
      ],
    }
  )
}

/** Voltage divider — Vout = Vin × R2/(R1+R2) */
export function voltageDividerSchematic(): Schematic {
  return buildSchematic(
    'Voltage Divider',
    'Verify: Vout = Vin × R2/(R1+R2). With Vin=5V, R1=R2=10kΩ, expect Vout ≈ 2.5V at the junction.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10)
      const r1 = place('Resistor', 6, 10, { resistance: 10000 })
      const r2 = place('Resistor', 6, 14, { resistance: 10000 })

      wire([ps.pin('5V'), r1.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([r1.at(2, 0), { x: 8, y: 10 }, { x: 8, y: 14 }, r2.at(0, 0)], { color: '#666666' })
      wire([r2.at(2, 0), { x: 8, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
        grounded: true,
        color: '#ff0000',
      })
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(1, 8, 30, 10, 'Voltage Divider', {
            name: 'Indigo',
            fill: 'rgba(224, 231, 255, 0.55)',
            border: '#818CF8',
          }),
          title: 'Vout = Vin × R2/(R1+R2)',
        },
      ],
    }
  )
}

/** LED + resistor — I = (Vcc - Vf) / R */
export function ledResistorSchematic(): Schematic {
  return buildSchematic(
    'LED + Resistor',
    'Verify: I_LED = (Vcc - Vf) / R. With 5V, Vf≈2V, R=220Ω, expect I ≈ 13.6 mA.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 12)
      const r = place('Resistor', 6, 12, { resistance: 220 })
      const led = place('LED', 10, 12)

      wire([ps.pin('5V'), r.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([r.at(2, 0), led.pin('+')], { color: '#666666' })
      wire([led.pin('-'), { x: 12, y: 12 }, { x: 12, y: 16 }, { x: 3, y: 16 }, { x: 3, y: 10 }, ps.pin('GND')], {
        grounded: true,
        color: '#ff0000',
      })
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(1, 10, 32, 10, 'LED + Resistor', {
            name: 'Pink',
            fill: 'rgba(252, 231, 243, 0.55)',
            border: '#F472B6',
          }),
          title: 'I = (Vcc − Vf) / R',
        },
      ],
    }
  )
}

/** Parallel resistors — Req = R1×R2/(R1+R2) */
export function parallelResistorsSchematic(): Schematic {
  return buildSchematic(
    'Parallel Resistors',
    'Verify: Req = R1×R2/(R1+R2). With R1=1kΩ and R2=2kΩ in parallel, expect Req ≈ 667Ω.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 8)
      const r1 = place('Resistor', 6, 8, { resistance: 1000 })
      const r2 = place('Resistor', 6, 12, { resistance: 2000 })

      wire([ps.pin('5V'), { x: 4, y: 8 }, r1.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([{ x: 4, y: 8 }, { x: 4, y: 12 }, r2.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([r1.at(2, 0), { x: 10, y: 8 }, { x: 10, y: 12 }, r2.at(2, 0)], { color: '#666666' })
      wire(
        [r1.at(2, 0), { x: 10, y: 8 }, { x: 10, y: 16 }, { x: 3, y: 16 }, { x: 3, y: 8 }, ps.pin('GND')],
        { grounded: true, color: '#ff0000' }
      )
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(1, 6, 32, 12, 'Parallel Resistors', {
            name: 'Green',
            fill: 'rgba(209, 250, 229, 0.55)',
            border: '#34D399',
          }),
          title: 'Req = R1×R2/(R1+R2)',
        },
      ],
    }
  )
}

/** RC circuit — Vc at t=τ is 63.2% of Vin */
export function rcCircuitSchematic(): Schematic {
  return buildSchematic(
    'RC Circuit',
    'Verify: at t = τ = R×C, capacitor voltage reaches 63.2% of Vin. R=1kΩ, C=100µF → τ=0.1s.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10)
      const r = place('Resistor', 6, 10, { resistance: 1000 })
      const c = place('Capacitor', 10, 10, { capacitance: 0.0001 })

      wire([ps.pin('5V'), r.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([r.at(2, 0), c.pin('1')], { color: '#666666' })
      wire([c.pin('2'), { x: 12, y: 10 }, { x: 12, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
        grounded: true,
        color: '#ff0000',
      })
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(1, 8, 32, 10, 'RC Circuit', {
            name: 'Blue',
            fill: 'rgba(219, 234, 254, 0.55)',
            border: '#60A5FA',
          }),
          title: 'Vc(t=τ) = 63.2% × Vin',
        },
      ],
    }
  )
}

export function npnTransistorSchematic(): Schematic {
  return placeholderSchematic(
    'NPN Transistor Switch',
    'Collector-emitter should saturate when base current is sufficient.',
    'NPN transistor component is not yet in the library. Build this test once transistors are added.',
    'Vce(sat) ≈ 0 when Ib × β > Ic'
  )
}

export function opAmpInvertingSchematic(): Schematic {
  return placeholderSchematic(
    'Op-Amp Inverting Amplifier',
    'Inverting amplifier gain verification.',
    'Op-amp component is not yet in the library. Use Rf and Rin to verify Vout = -(Rf/Rin)×Vin.',
    'Vout = -(Rf/Rin) × Vin'
  )
}

export function zenerClampSchematic(): Schematic {
  return placeholderSchematic(
    'Zener Voltage Clamp',
    'Output should clamp at the Zener breakdown voltage.',
    'Zener diode component is not yet in the library.',
    'Vout clamps at Vz'
  )
}

export function bridgeRectifierSchematic(): Schematic {
  return placeholderSchematic(
    'Bridge Rectifier',
    'Full-wave rectified DC output from AC input.',
    'Bridge rectifier / diode components are not yet in the library.',
    'Vdc ≈ 0.9 × Vrms'
  )
}

export function simulationTestReferenceDoc(): Document {
  return createDocument(
    'Simulation Test Reference',
    `# Simulation Correctness Test Cases

| Circuit | What to verify |
|---------|----------------|
| Voltage divider | Vout = Vin × R2/(R1+R2) |
| LED + resistor | I = (Vcc − Vf) / R |
| Parallel resistors | Req = R1×R2/(R1+R2) |
| RC circuit | Vc at t = τ is 63.2% of Vin |
| NPN transistor switch | Collector-emitter saturates when base current sufficient |
| Op-amp inverting amplifier | Vout = −(Rf/Rin) × Vin |
| Zener voltage clamp | Output clamps at Zener voltage |
| Bridge rectifier | Vdc ≈ 0.9 × Vrms |

Open each schematic in this folder to run the preset layout. Circuits marked as pending need additional components in the library.
`
  )
}

export function allSimulationTestSchematics(): Schematic[] {
  return [
    voltageDividerSchematic(),
    ledResistorSchematic(),
    parallelResistorsSchematic(),
    rcCircuitSchematic(),
    npnTransistorSchematic(),
    opAmpInvertingSchematic(),
    zenerClampSchematic(),
    bridgeRectifierSchematic(),
  ]
}
