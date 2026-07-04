import {
  createSchematicGroupBox,
  createDocument,
  type Schematic,
  type Document,
} from '../types/workspace'
import { buildSchematic } from './schematicBuilder'

/** Voltage divider — Vout = Vin × R2/(R1+R2) */
export function voltageDividerSchematic(): Schematic {
  return buildSchematic(
    'Voltage Divider',
    'Verify: Vout = Vin × R2/(R1+R2). With Vin=5V, R1=R2=10kΩ, expect Vout ≈ 2.5V at the junction.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10)
      const r1 = place('Resistor', 6, 10, { resistance: 10000 })
      const r2 = place('Resistor', 6, 14, { resistance: 10000 })

      wire([ps.pin('5V'), { x: 2, y: 9 }, { x: 6, y: 9 }, r1.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([r1.at(2, 0), { x: 8, y: 10 }, { x: 8, y: 14 }], { color: '#666666' })
      wire([{ x: 8, y: 10 }, { x: 10, y: 10 }], { color: '#666666' })
      wire([r2.at(0, 0), { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
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

      wire([ps.pin('5V'), { x: 2, y: 11 }, { x: 6, y: 11 }, r.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([r.at(2, 0), led.pin('+')], { color: '#666666' })
      wire([led.pin('-'), { x: 12, y: 16 }, { x: 3, y: 16 }, ps.pin('GND')], {
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

      wire([ps.pin('5V'), { x: 2, y: 7 }, { x: 4, y: 7 }, { x: 4, y: 8 }, r1.at(0, 0)], {
        powered: true,
        color: '#00ff00',
      })
      wire([{ x: 4, y: 8 }, { x: 4, y: 12 }, r2.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([r1.at(2, 0), { x: 10, y: 8 }, { x: 10, y: 12 }, r2.at(2, 0)], { color: '#666666' })
      wire([{ x: 10, y: 8 }, { x: 12, y: 8 }], { color: '#666666' })
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

      wire([ps.pin('5V'), { x: 2, y: 9 }, { x: 6, y: 9 }, r.at(0, 0)], {
        powered: true,
        color: '#00ff00',
      })
      wire([r.at(2, 0), c.pin('1')], { color: '#666666' })
      wire([{ x: 12, y: 10 }, { x: 14, y: 10 }], { color: '#666666' })
      wire([c.pin('2'), { x: 12, y: 14 }, { x: 3, y: 14 }, ps.pin('GND')], {
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

/** NPN transistor low-side switch */
export function npnTransistorSchematic(): Schematic {
  return buildSchematic(
    'NPN Transistor Switch',
    'Verify: collector-emitter saturates when base current is sufficient. With 5V, R_load=1kΩ, R_base=10kΩ, Vce(sat) ≈ 0.2V.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 8)
      const rLoad = place('Resistor', 6, 8, { resistance: 1000 })
      const q = place('NPNTransistor', 10, 7)
      const rBase = place('Resistor', 6, 14, { resistance: 10000 })

      wire([ps.pin('5V'), { x: 2, y: 7 }, { x: 6, y: 7 }, rLoad.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([rLoad.at(2, 0), { x: 8, y: 8 }, { x: 8, y: 7 }, { x: 11, y: 7 }, q.pin('C')], { color: '#666666' })
      wire([q.pin('E'), { x: 11, y: 10 }, { x: 3, y: 10 }, { x: 3, y: 8 }, ps.pin('GND')], {
        grounded: true,
        color: '#ff0000',
      })
      wire([ps.pin('5V'), { x: 2, y: 13 }, { x: 4, y: 13 }, { x: 4, y: 14 }, rBase.at(0, 0)], {
        powered: true,
        color: '#00ff00',
      })
      wire([rBase.at(2, 0), { x: 8, y: 14 }, { x: 8, y: 8 }, { x: 10, y: 8 }, q.pin('B')], { color: '#666666' })
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(1, 6, 32, 12, 'NPN Transistor Switch', {
            name: 'Amber',
            fill: 'rgba(254, 243, 199, 0.55)',
            border: '#FBBF24',
          }),
          title: 'Vce(sat) ≈ 0 when Ib × β > Ic',
        },
      ],
    }
  )
}

/** Op-amp inverting amplifier */
export function opAmpInvertingSchematic(): Schematic {
  return buildSchematic(
    'Op-Amp Inverting Amplifier',
    'Verify: Vout = −(Rf/Rin) × Vin. With Rin=1kΩ, Rf=10kΩ, Vin=0.5V → Vout ≈ −5V (clipped to rails).',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10)
      const rin = place('Resistor', 6, 12, { resistance: 1000 })
      const rf = place('Resistor', 10, 8, { resistance: 10000 })
      const op = place('OpAmp', 14, 9)

      wire([ps.pin('5V'), { x: 2, y: 9 }, { x: 15, y: 9 }, op.pin('V+')], { powered: true, color: '#00ff00' })
      wire([ps.pin('GND'), { x: 3, y: 12 }, { x: 3, y: 11 }, { x: 15, y: 11 }, op.pin('V-')], {
        grounded: true,
        color: '#ff0000',
      })
      wire([op.pin('+'), { x: 14, y: 12 }, { x: 3, y: 12 }, ps.pin('GND')], {
        grounded: true,
        color: '#ff0000',
      })
      wire([ps.pin('5V'), { x: 2, y: 11 }, { x: 4, y: 11 }, { x: 4, y: 12 }, rin.at(0, 0)], {
        powered: true,
        color: '#00ff00',
      })
      wire([rin.at(2, 0), { x: 8, y: 12 }, { x: 8, y: 10 }, { x: 14, y: 10 }, op.pin('-')], { color: '#666666' })
      wire([op.pin('-'), { x: 13, y: 10 }, { x: 13, y: 8 }, rf.at(0, 0)], { color: '#666666' })
      wire([rf.at(2, 0), { x: 12, y: 8 }, { x: 12, y: 10 }, { x: 16, y: 10 }, op.pin('OUT')], { color: '#666666' })
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(1, 7, 36, 12, 'Op-Amp Inverting Amplifier', {
            name: 'Violet',
            fill: 'rgba(237, 233, 254, 0.55)',
            border: '#A78BFA',
          }),
          title: 'Vout = −(Rf/Rin) × Vin',
        },
      ],
    }
  )
}

/** Zener voltage clamp */
export function zenerClampSchematic(): Schematic {
  return buildSchematic(
    'Zener Voltage Clamp',
    'Verify: output clamps at Zener voltage. With 5V input, R=1kΩ, 3.3V Zener → Vout ≈ 3.3V.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10)
      const r = place('Resistor', 6, 10, { resistance: 1000 })
      const z = place('ZenerDiode', 10, 10, { zenerVoltage: 3.3 })

      wire([ps.pin('5V'), { x: 2, y: 9 }, { x: 6, y: 9 }, r.at(0, 0)], {
        powered: true,
        color: '#00ff00',
      })
      wire([r.at(2, 0), { x: 8, y: 10 }, z.pin('K')], { color: '#666666' })
      wire([z.pin('A'), { x: 10, y: 14 }, { x: 12, y: 14 }, { x: 3, y: 14 }, { x: 3, y: 10 }, ps.pin('GND')], {
        grounded: true,
        color: '#ff0000',
      })
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(1, 8, 32, 10, 'Zener Voltage Clamp', {
            name: 'Cyan',
            fill: 'rgba(207, 250, 254, 0.55)',
            border: '#22D3EE',
          }),
          title: 'Vout clamps at Vz',
        },
      ],
    }
  )
}

/** Bridge rectifier with AC source */
export function bridgeRectifierSchematic(): Schematic {
  return buildSchematic(
    'Bridge Rectifier',
    'Verify: Vdc ≈ 0.9 × Vrms. With 12V RMS AC and a 1kΩ load, expect rectified DC across the load.',
    ({ place, wire }) => {
      const ac = place('ACSource', 2, 10, { vrms: 12 })
      const bridge = place('BridgeRectifier', 8, 9)
      const rLoad = place('Resistor', 14, 10, { resistance: 1000 })

      wire([ac.pin('AC1'), { x: 2, y: 9 }, { x: 8, y: 9 }, bridge.pin('AC1')], { powered: true, color: '#00ff00' })
      wire([ac.pin('AC2'), { x: 3, y: 11 }, { x: 10, y: 11 }, { x: 10, y: 9 }, bridge.pin('AC2')], {
        grounded: true,
        color: '#ff0000',
      })
      wire([bridge.pin('-'), { x: 8, y: 12 }, { x: 3, y: 12 }, { x: 3, y: 10 }, ac.pin('AC2')], {
        grounded: true,
        color: '#ff0000',
      })
      wire([bridge.pin('+'), { x: 10, y: 8 }, { x: 14, y: 8 }, { x: 14, y: 10 }, rLoad.at(0, 0)], {
        powered: true,
        color: '#00ff00',
      })
      wire([rLoad.at(2, 0), { x: 16, y: 12 }, { x: 8, y: 12 }, { x: 8, y: 11 }, bridge.pin('-')], {
        color: '#666666',
      })
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(1, 8, 36, 10, 'Bridge Rectifier', {
            name: 'Orange',
            fill: 'rgba(255, 237, 213, 0.55)',
            border: '#FB923C',
          }),
          title: 'Vdc ≈ 0.9 × Vrms',
        },
      ],
    }
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
| BLDC Motor + ESC | PWM D9 → ESC → U/V/W → motor phases |

Open each schematic in this folder to run the preset layout.
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
