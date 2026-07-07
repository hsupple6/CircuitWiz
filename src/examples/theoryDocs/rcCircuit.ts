import type { ExampleTheoryDoc } from './types'

export const rcCircuitTheory: ExampleTheoryDoc = {
  title: 'RC Circuit',
  content: `# RC Circuit — Theory Guide

## What problem does this solve?

Capacitors **store charge**. Resistors **limit how fast** charge moves. Together: **delays**, **filters**, and **smoothing**.

---

## Capacitor basics

Rated in **farads** (F); this example uses **100 µF**.

At **steady DC** after charging: cap looks **open** (no current), voltage = final value.

While charging: voltage and current change over time.

---

## Time constant τ

\`\`\`
τ = R × C   (seconds)
\`\`\`

After one τ:

\`\`\`
Vc(t = τ) ≈ 63.2% of final voltage
Vc(t = 5τ) ≈ 99%  ("fully charged")
\`\`\`

Charging from 0 V:

\`\`\`
Vc(t) = Vin × (1 − e^(−t/τ))
\`\`\`

---

## This example

| Part | Value |
|------|-------|
| **Vin** | 5 V |
| **R** | 1 kΩ |
| **C** | 100 µF |

\`\`\`
τ = 1000 × 0.0001 = 0.1 s
Vc at t=τ ≈ 0.632 × 5 V ≈ 3.16 V
\`\`\`

Initial current: \`I₀ ≈ Vin/R = 5 mA\` (decays as cap fills).

---

## Why the resistor?

Without R, a huge **inrush current** could damage the supply or cap. R slows the charge.

---

## Uses

Power-on reset delays, debouncing, low-pass filters.

---

## What to do in CircuitWiz

1. DC steady state: cap **~5 V**, **~0 A**  
2. Change **C = 10 µF** → τ = **10 ms**  
3. Change **R = 10 kΩ** → τ = **1 s**`,
}
