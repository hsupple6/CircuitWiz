import {
  createDocument,
  createProgram,
  type Document,
  type Program,
  type Schematic,
} from '../types/workspace'
import { buildSchematic } from './schematicBuilder'

const BOOST_PWM_SKETCH = `/**
 * MOSFET boost converter — Arduino PWM on D9 drives the switching FET.
 * Average duty sets output: Vout ≈ Vin / (1 − D).
 */
const int PWM_PIN = 9;
const int PWM_DUTY = 153; // ~60% → ~2.5× step-up

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  analogWrite(PWM_PIN, PWM_DUTY);
}

void loop() {
  // Steady PWM for boost regulation in simulation
}
`

/**
 * Discrete boost: Battery → L → MOSFET/Diode switch node → output cap + load.
 * Arduino D9 PWM drives the gate. Idle preview uses pwmDuty on the MOSFET.
 */
export function mosfetBoostSchematic(): Schematic {
  return buildSchematic(
    'MOSFET Boost Converter',
    '3.7 V → inductor → NMOS switch → Schottky diode → 100 µF + 1 kΩ load. Arduino D9 PWM on gate; Vout ≈ Vin/(1−D).',
    ({ place, wire }) => {
      const battery = place('Battery', 2, 8, { voltage: 3.7 })
      const inductor = place('Inductor', 6, 8, { inductance: 0.0001, dcResistance: 0.1 })
      const fet = place('MOSFET', 11, 7, { vth: 2.5, rdsOn: 0.05, pwmDuty: 0.4 })
      const diode = place('Diode', 15, 8)
      const cap = place('Capacitor', 19, 8, { capacitance: 0.0001 })
      const load = place('Resistor', 23, 8, { resistance: 1000 })
      const arduino = place('Arduino Uno R3', 2, 16)
      const gateR = place('Resistor', 8, 16, { resistance: 100 })
      const gateBias = place('Resistor', 4, 14, { resistance: 10000 })

      const gndY = 12
      const swY = 8

      // Input rail
      wire(
        [battery.pin('5V'), { x: 2, y: swY }, inductor.at(0, 0)],
        { powered: true, color: '#f97316' }
      )

      // Switch node on drain pin only — gate shares row at (11,8), do not route SW through it
      wire([inductor.at(2, 0), { x: 12, y: swY }, { x: 12, y: 7 }, fet.pin('D')], { color: '#a855f7' })
      wire([fet.pin('D'), { x: 14, y: 7 }, { x: 14, y: swY }, diode.pin('A')], { color: '#a855f7' })

      // MOSFET source → ground
      wire(
        [fet.pin('S'), { x: 12, y: 9 }, { x: 12, y: gndY }, { x: 3, y: gndY }, battery.pin('GND')],
        { grounded: true, color: '#ef4444' }
      )

      // Output rail: diode → cap + → load (do not route through cap − pin at 21,8)
      wire([diode.pin('K'), cap.pin('1')], { powered: true, color: '#22c55e' })
      wire([cap.pin('1'), { x: 22, y: swY }, load.at(0, 0)], { powered: true, color: '#22c55e' })
      wire(
        [load.at(2, 0), { x: 25, y: swY }, { x: 25, y: gndY }, { x: 3, y: gndY }],
        { grounded: true, color: '#ef4444' }
      )
      wire([cap.pin('2'), { x: 21, y: gndY }, { x: 3, y: gndY }], { grounded: true, color: '#ef4444' })

      // Arduino ground + PWM only (Uno powered via USB in practice — avoids VIN/battery matrix conflict)
      wire(
        [arduino.pin('GND'), { x: 3, y: 19 }, { x: 3, y: gndY }],
        { grounded: true, color: '#ef4444' }
      )

      // Static gate bias (10k) + Arduino PWM via 100Ω series
      wire([battery.pin('5V'), { x: 4, y: 14 }, gateBias.at(0, 0)], { powered: true, color: '#f97316' })
      wire([gateBias.at(2, 0), { x: 11, y: 14 }, fet.pin('G')], { color: '#f97316' })
      wire([arduino.pin('D9'), { x: 4, y: 17 }, gateR.at(0, 0)], { color: '#3b82f6' })
      wire([gateR.at(2, 0), { x: 11, y: 17 }, fet.pin('G')], { color: '#3b82f6' })
    },
    { region: { title: 'Vin → L → NMOS → D → Vout', color: 'Violet', padding: 2 } }
  )
}

export function mosfetBoostExampleDoc(): Document {
  return createDocument(
    'MOSFET Boost Example',
    `# MOSFET Step-Up (Boost) Converter

Discrete boost topology simulated with averaged PWM duty:

| Block | Role |
|-------|------|
| **3.7 V Battery** | Input supply (Vin) |
| **100 µH Inductor** | Energy storage (DC model uses DCR) |
| **NMOS** | Low-side switch — gate driven by Arduino **D9** PWM |
| **Diode** | Routes inductor current to output when switch is off |
| **100 µF + 1 kΩ** | Output filter and load |
| **Arduino Uno** | PWM gate driver |

## Expected output

With ideal CCM boost: **Vout ≈ Vin / (1 − D)** (minus diode drop).

| Duty (D) | Approx Vout @ 3.7 V in |
|----------|------------------------|
| 40% (idle preview) | ~5.5 V |
| 60% (sketch default) | ~8.6 V |

## How to run

1. Open **Programs → MOSFET Boost PWM** and assign it to the Arduino (USB-powered separately from the 3.7 V boost input).
2. Run simulation — \`analogWrite(9, 153)\` holds ~60% duty.
3. Without simulation, the MOSFET \`pwmDuty\` property (40%) gives a static preview.

## Wiring notes

- Switch node (inductor ↔ drain ↔ diode anode) must stay separate from the gate trace.
- Common ground: battery −, MOSFET source, output return, Arduino GND.
`
  )
}

export function mosfetBoostExampleProgram(): Program {
  return createProgram('MOSFET Boost PWM', BOOST_PWM_SKETCH, 'arduino:avr:uno')
}
