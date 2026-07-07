import { createDocument, type Schematic, type Document } from '../types/workspace'
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
    { region: { title: 'Vout = Vin × R2/(R1+R2)', color: 'Indigo' } }
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
    { region: { title: 'I = (Vcc − Vf) / R', color: 'Pink' } }
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
    { region: { title: 'Req = R1×R2/(R1+R2)', color: 'Green' } }
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
    { region: { title: 'Vc(t=τ) = 63.2% × Vin', color: 'Blue' } }
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
    { region: { title: 'Vce(sat) ≈ 0 when Ib × β > Ic', color: 'Amber' } }
  )
}

/** Op-amp inverting amplifier */
export function opAmpInvertingSchematic(): Schematic {
  return buildSchematic(
    'Op-Amp Inverting Amplifier',
    'Verify: Vout = −(Rf/Rin) × Vin. With Rin=1kΩ, Rf=10kΩ, and a 9k/1k divider (~0.5V nominal at Rin), Vout ≈ −5V (clipped to GND on single supply).',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10)
      const rTop = place('Resistor', 4, 16, { resistance: 9000 })
      const rBot = place('Resistor', 6, 20, { resistance: 1000 })
      const rin = place('Resistor', 8, 14, { resistance: 1000 })
      const rf = place('Resistor', 10, 6, { resistance: 10000 })
      const op = place('OpAmp', 14, 9)
      const rLoad = place('Resistor', 20, 10, { resistance: 10000 })

      const vccRailY = 8
      const gndBusY = 18
      const outJunction = { x: 18, y: 10 }

      // Op-amp supply rails
      wire([ps.pin('5V'), { x: 2, y: vccRailY }, { x: 15, y: vccRailY }, op.pin('V+')], {
        powered: true,
        color: '#00ff00',
      })
      wire([op.pin('V-'), { x: 15, y: gndBusY }, { x: 3, y: gndBusY }, ps.pin('GND')], {
        grounded: true,
        color: '#ff0000',
      })
      wire([op.pin('+'), { x: 14, y: gndBusY }, { x: 3, y: gndBusY }], {
        grounded: true,
        color: '#ff0000',
      })

      // Vin divider (9k / 1k → 0.5 V nominal at tap; ~0.26 V under Rin loading)
      wire([ps.pin('5V'), { x: 2, y: 16 }, rTop.at(0, 0)], { powered: true, color: '#00ff00' })
      wire([rTop.at(2, 0), rBot.at(0, 0)])
      wire([rBot.at(2, 0), { x: 8, y: 20 }, { x: 8, y: gndBusY }, { x: 3, y: gndBusY }], {
        grounded: true,
        color: '#ff0000',
      })
      wire([rTop.at(2, 0), { x: 6, y: 14 }, rin.at(0, 0)])

      // Inverting input network: Rin → (−), Rf feedback (−) ↔ OUT
      wire([rin.at(2, 0), { x: 10, y: 14 }, { x: 10, y: 10 }, op.pin('-')], { color: '#666666' })
      wire([op.pin('-'), { x: 13, y: 10 }, { x: 13, y: 5 }, { x: 10, y: 5 }, rf.at(0, 0)], {
        color: '#666666',
      })
      wire([rf.at(2, 0), { x: outJunction.x, y: 6 }, outJunction, op.pin('OUT')], { color: '#666666' })

      // Output load completes the DC path to ground
      wire([outJunction, rLoad.at(0, 0)])
      wire([rLoad.at(2, 0), { x: 22, y: 10 }, { x: 22, y: gndBusY }, { x: 3, y: gndBusY }], {
        grounded: true,
        color: '#ff0000',
      })
    },
    { region: { title: 'Vout = −(Rf/Rin) × Vin', color: 'Purple' } }
  )
}

/** Zener voltage clamp — K (left/input) from R, A (right) to GND; Vclamp ≈ Vz at K */
export function zenerClampSchematic(): Schematic {
  return buildSchematic(
    'Zener Voltage Clamp',
    'Verify: Vclamp ≈ Vz at K (left pin). With 5V → R=1kΩ → K, 3.3V Zener, A (right) → GND → V_K ≈ 3.3V.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10)
      const r = place('Resistor', 6, 10, { resistance: 1000 })
      const z = place('ZenerDiode', 10, 10, { zenerVoltage: 3.3 })

      const gndBusY = 14

      wire([ps.pin('5V'), { x: 2, y: 9 }, { x: 6, y: 9 }, r.at(0, 0)], {
        powered: true,
        color: '#00ff00',
      })
      wire([r.at(2, 0), z.pin('K')], { color: '#666666' })
      wire([z.pin('A'), { x: 12, y: gndBusY }, { x: 3, y: gndBusY }, ps.pin('GND')], {
        grounded: true,
        color: '#ff0000',
      })
    },
    { region: { title: 'V_K clamps at Vz (K = left)', color: 'Cyan' } }
  )
}

/** Bridge rectifier with AC source */
export function bridgeRectifierSchematic(): Schematic {
  return buildSchematic(
    'Bridge Rectifier',
    'Verify: Vdc ≈ 0.9 × Vrms. With 12V RMS AC and a 1kΩ load, expect ~9.4V DC and ~9.4mA.',
    ({ place, wire }) => {
      const ac = place('ACSource', 2, 13, { vrms: 12, frequency: 60 })
      const bridge = place('BridgeRectifier', 13, 12)
      const rLoad = place('Resistor', 21, 14, { resistance: 1000 })

      const acHotY = 12
      const dcOutY = 14
      const gndBusY = 18

      // AC hot rail → bridge AC1
      wire(
        [ac.pin('AC1'), { x: 5, y: 13 }, { x: 5, y: acHotY }, { x: 13, y: acHotY }, bridge.pin('AC1')],
        { powered: true, color: '#00ff00' }
      )

      // AC return → ground bus (source AC2 + bridge AC2)
      wire([ac.pin('AC2'), { x: 3, y: 15 }, { x: 3, y: gndBusY }], { grounded: true, color: '#ff0000' })
      wire([bridge.pin('AC2'), { x: 15, y: 12 }, { x: 15, y: gndBusY }], { grounded: true, color: '#ff0000' })
      wire([{ x: 3, y: gndBusY }, { x: 15, y: gndBusY }], { grounded: true, color: '#ff0000' })

      // Rectified DC rail → load (same row, no vertical detour)
      wire([bridge.pin('+'), { x: 15, y: dcOutY }, rLoad.at(0, 0)], {
        powered: true,
        color: '#00ff00',
      })

      // Load return + bridge DC− → common ground bus
      wire([rLoad.at(2, 0), { x: 23, y: dcOutY }, { x: 23, y: gndBusY }], {
        grounded: true,
        color: '#ff0000',
      })
      wire([bridge.pin('-'), { x: 13, y: 14 }, { x: 13, y: gndBusY }], { grounded: true, color: '#ff0000' })
      wire([{ x: 13, y: gndBusY }, { x: 23, y: gndBusY }], { grounded: true, color: '#ff0000' })
    },
    { region: { title: '12Vrms AC → ~9.4V DC (1kΩ load)', color: 'Amber' } }
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
| Zener voltage clamp | V_K clamps at Vz (K = left pin) |
| Bridge rectifier | Vdc ≈ 0.9 × Vrms |
| BLDC Motor + ESC | PWM D9 → ESC → U/V/W → motor phases |
| MOSFET Boost | Vout ≈ Vin / (1 − D) with L, NMOS, diode, cap |
| LM317 + Potentiometer | Vout = Vref × (1 + R2/R1); sweep pot wiper |
| NPN Switch + LED | Close SPST → base bias → NPN saturates → LED on |

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
