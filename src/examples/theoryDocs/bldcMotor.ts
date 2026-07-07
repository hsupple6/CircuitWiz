import type { ExampleTheoryDoc } from './types'

export const bldcMotorTheory: ExampleTheoryDoc = {
  title: 'BLDC Motor + ESC',
  content: `# BLDC Motor + ESC — Theory Guide

## What problem does this solve?

A **brushless DC (BLDC)** motor has no commutator brushes. Instead, an **Electronic Speed Controller (ESC)** energizes three **phase windings** in sequence to spin the rotor with magnets.

You control speed with a **PWM throttle signal** — just like a servo command — not by connecting the motor straight to a battery.

---

## Main blocks

| Block | Role |
|-------|------|
| **3S LiPo (11.1 V)** | High power for motor + ESC |
| **Arduino Uno** | Sends **PWM throttle** on D9 |
| **30A ESC** | Converts DC + PWM → **3-phase AC** to motor |
| **Brushless motor** | **U / V / W** (or IN1–IN3) phase inputs |

---

## Why three wires?

A BLDC motor has **three stator windings**. The ESC drives them in a rotating pattern to pull the permanent-magnet rotor around.

That is **very different** from a brushed DC motor (2 wires, direct battery voltage = speed).

---

## PWM throttle

RC-style ESCs expect a **pulse** on the signal wire:

- **~1 ms pulse** → stop / idle  
- **~2 ms pulse** → full throttle  
- Repetition rate ~**50 Hz** (20 ms period)

Arduino \`analogWrite(9, value)\` produces **~490 Hz PWM** on Uno — CircuitWiz reads the **duty** as throttle level for simulation.

The example program **ramps** throttle up and down on D9.

---

## Power wiring

- **Battery +** → ESC **VBAT** (and Arduino **VIN** in this schematic)  
- **Battery −**, ESC **GND**, Arduino **GND** → **common ground** (critical)  
- **Arduino D9** → ESC **PWM** (signal only — low current)

**Never** power a motor from a GPIO pin directly.

---

## This example values

| Item | Value |
|------|-------|
| Battery | **11.1 V** (3S LiPo nominal) |
| ESC | **30 A**, **3S** rated |
| Control | **D9** PWM |

Phase wires **U, V, W** → motor **IN1, IN2, IN3**.

---

## What simulation shows

1. Import **BLDC ESC Throttle** program to the Arduino  
2. **Run** simulation — D9 PWM ramps  
3. ESC model converts throttle → phase drive → motor response

Hover ESC and motor pins during sim for phase activity.

---

## Safety (real hardware)

- Remove props before arming ESC  
- LiPo needs proper charger and storage  
- Current rating (30 A) must exceed motor draw  
- Common ground between logic and power`,
}
