import type { ExampleTheoryDoc } from './types'

export const bridgeRectifierTheory: ExampleTheoryDoc = {
  title: 'Bridge Rectifier',
  content: `# Bridge Rectifier — Theory Guide

## What problem does this solve?

Wall power is **AC** — voltage reverses direction 50/60 times per second. Most electronics want **DC** (one direction only).

A **bridge rectifier** (four diodes) **flips** negative half-cycles so the load always sees the same polarity.

---

## AC basics

**RMS voltage** (Vrms) is what multimeters read on AC outlets.

Peak voltage:

\`\`\`
Vpeak = Vrms × √2 ≈ Vrms × 1.414
\`\`\`

For **12 Vrms**:

\`\`\`
Vpeak ≈ 12 × 1.414 ≈ 17 V
\`\`\`

---

## What the bridge does

Four diodes route current so **+** of the load always sees the more positive AC line, **−** always the more negative — regardless of AC polarity.

You get **pulsating DC** — always positive but rippling at **2× line frequency** (120 Hz for 60 Hz mains).

---

## Average DC (this example)

With resistive load and ideal diodes, a common estimate:

\`\`\`
Vdc ≈ 0.9 × Vrms
\`\`\`

| Quantity | Value |
|----------|-------|
| **Vrms** | 12 V |
| **Vdc (approx)** | 0.9 × 12 ≈ **10.8 V** |
| **Load R** | 1 kΩ |

CircuitWiz models diode drops — expect closer to **~9.4 V** and **~9.4 mA** on the load (as in the schematic title).

Each diode drops ~0.7 V during conduction; two conduct in series per half-cycle → lose ~1.4 V from the ideal peak average.

---

## Current

\`\`\`
I ≈ Vdc / Rload ≈ 9.4 V / 1 kΩ ≈ 9.4 mA
\`\`\`

---

## Ripple

Real circuits add a **capacitor** after the bridge to smooth ripple. This example is **unfiltered** — good for learning rectification, not clean DC.

---

## Uses

- Phone chargers (before switching regulator)  
- Old linear power supplies  
- Any AC → DC conversion

---

## What to do in CircuitWiz

1. Hover **load resistor** — **~9.4 V DC**, **~9 mA**  
2. Compare to **12 Vrms** input — see diode + averaging loss  
3. AC source is **60 Hz** — ripple concept is 120 Hz at output`,
}
