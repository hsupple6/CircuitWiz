import {
  createDocument,
  createProgram,
  createSchematicGroupBox,
  type Document,
  type Program,
  type ProgramCompilation,
  type Schematic,
} from '../types/workspace'
import { buildSchematic } from './schematicBuilder'

/** Arduino sketch — source of truth: src/examples/sketches/bldc_esc_throttle/bldc_esc_throttle.ino */
export const BLDC_ESC_THROTTLE_SKETCH = `/**
 * BLDC motor spin example — Arduino Uno → 30A 3S ESC → brushless motor.
 * PWM throttle on D9 ramps up/down to drive the ESC (simulation reads analogWrite).
 */
const int ESC_PWM_PIN = 9;

const int THROTTLE_MIN = 110;
const int THROTTLE_MAX = 200;
const int THROTTLE_IDLE = 110;

void setup() {
  pinMode(ESC_PWM_PIN, OUTPUT);
  analogWrite(ESC_PWM_PIN, THROTTLE_IDLE);
  delay(2000);
}

void loop() {
  for (int t = THROTTLE_MIN; t <= THROTTLE_MAX; t++) {
    analogWrite(ESC_PWM_PIN, t);
    delay(20);
  }
  delay(800);
  for (int t = THROTTLE_MAX; t >= THROTTLE_MIN; t--) {
    analogWrite(ESC_PWM_PIN, t);
    delay(20);
  }
  delay(800);
}
`

const BLDC_COMPILE_OUTPUT = `Sketch uses 1164 bytes (3%) of program storage space. Maximum is 32256 bytes.
Global variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables. Maximum is 2048 bytes.`

function createPrecompiledProgram(name: string, code: string, board: string): Program {
  const program = createProgram(name, code, board)
  const compilation: ProgramCompilation = {
    success: true,
    compiledAt: '2026-07-03T00:00:00.000Z',
    output: BLDC_COMPILE_OUTPUT,
    filename: 'bldc_esc_throttle.ino.hex',
    size: 1164,
  }
  return { ...program, compilation }
}

/**
 * Arduino Uno + 3S LiPo + 30A ESC + brushless motor.
 * D9 PWM → ESC throttle; ESC U/V/W → motor phases; shared ground.
 */
export function bldcMotorEscSchematic(): Schematic {
  return buildSchematic(
    'BLDC Motor + ESC',
    'Arduino Uno drives a 30A 3S ESC (PWM on D9) → brushless motor. Run the BLDC ESC Throttle program and simulate.',
    ({ place, wire }) => {
      const arduino = place('Arduino Uno R3', 2, 4)
      const battery = place('Battery', 2, 22, { voltage: 11.1 })
      const esc = place('30A 3S ESC', 10, 8)
      const motor = place('Brushless Motor', 18, 8)

      const gndRailX = 0

      // 3S pack → ESC power
      wire(
        [
          battery.pin('5V'),
          { x: 0, y: 22 },
          { x: 0, y: 8 },
          esc.pin('VBAT'),
        ],
        { powered: true, color: '#f97316' }
      )

      // Common ground: battery, ESC, Arduino
      wire(
        [
          battery.pin('GND'),
          { x: 5, y: 22 },
          { x: 5, y: 6 },
          arduino.pin('GND'),
          { x: 10, y: 6 },
          esc.pin('GND')
        ],
        { grounded: true, color: '#ef4444' }
      )

      // Arduino VIN from 3S (within 7–12 V onboard reg spec)
      wire(
        [
          battery.pin('5V'),
          { x: 0, y: 22 },
          { x: 0, y: 7 },
          arduino.pin('VIN'),
        ],
        { powered: true, color: '#f97316' }
      )

      // PWM throttle
      wire(
        [
          arduino.pin('D9'),
          { x: 3, y: 15 },
          { x: 3, y: 9 },
          esc.pin('PWM'),
        ],
        { color: '#3b82f6' }
      )

      // 3-phase → motor
      wire([esc.pin('U'), { x: 10, y: 13 }, { x: 18, y: 13 }, motor.pin('IN1')], { color: '#22c55e' })
      wire([esc.pin('V'), { x: 11, y: 12 }, { x: 19, y: 12 }, motor.pin('IN2')], { color: '#22c55e' })
      wire([esc.pin('W'), { x: 12, y: 11 }, { x: 20, y: 11 }, motor.pin('IN3')], { color: '#22c55e' })
    },
    {
      groupBoxes: [
        {
          ...createSchematicGroupBox(0, 2, 38, 24, 'BLDC Powertrain', {
            name: 'Sky',
            fill: 'rgba(224, 242, 254, 0.55)',
            border: '#38BDF8',
          }),
          title: 'Uno → ESC → BLDC',
        },
      ],
    }
  )
}

export function bldcMotorExampleDoc(): Document {
  return createDocument(
    'BLDC Motor Example',
    `# BLDC Motor + ESC Example

Complete chain to spin a brushless motor in CircuitWiz:

| Block | Role |
|-------|------|
| **3S LiPo (Battery)** | 11.1 V → ESC \`VBAT\` and Arduino \`VIN\` |
| **Arduino Uno R3** | PWM throttle on **D9** |
| **30A 3S ESC** | Converts PWM → **U / V / W** phase outputs |
| **Brushless Motor** | \`IN1\`–\`IN3\` ← ESC phases |

## Wiring summary

- Battery **+** → ESC \`VBAT\` and Arduino \`VIN\`
- Battery **−**, ESC \`GND\`, Arduino \`GND\` → common ground
- Arduino **D9** → ESC \`PWM\`
- ESC **U / V / W** → Motor **IN1 / IN2 / IN3**

## Firmware

Open **Programs → BLDC ESC Throttle** (pre-compiled for \`arduino:avr:uno\`).

1. Assign the program to the Arduino in the device panel.
2. Run simulation — \`analogWrite(9, …)\` ramps ESC throttle and spins the motor in the solver.

The sketch arms the ESC at idle PWM for 2 s, then ramps throttle up and down continuously.
`
  )
}

export function bldcMotorExampleProgram(): Program {
  return createPrecompiledProgram(
    'BLDC ESC Throttle',
    BLDC_ESC_THROTTLE_SKETCH,
    'arduino:avr:uno'
  )
}
