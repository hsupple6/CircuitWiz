import type { ExampleTheoryDoc } from './types'

export const zenerClampTheory: ExampleTheoryDoc = {
  title: 'Zener Voltage Clamp',
  content: `# Zener Voltage Clamp — Theory Guide

## What problem does this solve?

You have a **higher voltage** (5 V) but need a node that **cannot rise above** a safe level (~3.3 V) — for protection or reference.

A **Zener diode** operated in **reverse breakdown** holds its terminal voltage near **Vz** (Zener voltage).

---

## Normal diode vs Zener

| Mode | Normal diode | Zener |
|------|--------------|-------|
| Forward | Conducts ~0.7 V | Same |
| Reverse | Blocks (leakage) | **Breaks down at Vz** |

In this schematic the Zener is **reverse-biased**: **K** (cathode) at the clamp node, **A** (anode) to ground.

---

## How clamping works

\`\`\`
5V ----[ R 1k ]----+---- Vclamp (K)
                   |
                 [ Zener 3.3V ]
                   |
                  GND (A)
\`\`\`

- Below Vz: Zener is high impedance → node set by divider (if any)  
- Above Vz: Zener **conducts** → pulls current → **Vclamp ≈ Vz**

Series resistor **limits current** through the Zener so it does not burn up.

---

## This example

| Part | Value |
|------|-------|
| **Vin** | 5 V |
| **R** | 1 kΩ |
| **Vz** | 3.3 V |

**Expect V at K (left pin) ≈ 3.3 V** when clamping.

Zener current (rough):

\`\`\`
Iz ≈ (5 V − 3.3 V) / 1 kΩ ≈ 1.7 mA
\`\`\`

Power in Zener: \`Pz ≈ 3.3 V × 1.7 mA ≈ 5.6 mW\` — fine for small signal Zeners.

---

## Uses

- **Overvoltage protection** on inputs  
- **Shunt regulators** (simple, inefficient)  
- **Reference voltage** (with stable Iz)

---

## Limits

- Needs **series R** — always  
- Not efficient for power regulation (waste in R + Zener)  
- Exact voltage varies slightly with **Iz** and temperature

---

## What to do in CircuitWiz

1. Hover **K pin** (left) — **~3.3 V**  
2. Hover series resistor — **~1.7 mA**  
3. Try **Vz = 5.1 V** — clamp moves up`,
}
