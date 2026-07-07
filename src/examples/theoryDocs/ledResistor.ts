import type { ExampleTheoryDoc } from './types'

export const ledResistorTheory: ExampleTheoryDoc = {
  title: 'LED + Resistor',
  content: `# LED + Resistor — Theory Guide

## What problem does this solve?

An **LED** needs a **minimum voltage** to turn on (forward voltage **Vf**) and will destroy itself without a **current limit**.

A **series resistor** sets how much current flows. This is the most common circuit after a voltage divider.

---

## How an LED behaves

A diode conducts in one direction (+ → −). Once on, voltage across the LED stays near **Vf**:

| Color | Vf (approx) |
|-------|-------------|
| Red | ~1.8 V |
| Green | ~2.1 V |
| White / blue | ~3.0–3.3 V |

CircuitWiz uses **~2 V** for a standard LED.

The **resistor** takes the rest of the supply voltage — not the LED.

---

## The formula

\`\`\`
5V ----[ R ]----[ LED ]---- GND

I = (Vcc − Vf) / R
\`\`\`

Same current through R and LED (series).

---

## This example

| Part | Value |
|------|-------|
| **Vcc** | 5 V |
| **R** | 220 Ω |
| **Vf** | ~2 V |

\`\`\`
I = (5 − 2) / 220 = 3 / 220 ≈ 13.6 mA
\`\`\`

**Expect ~13–14 mA** — good indicator brightness (typical target 5–20 mA).

Resistor power: \`P ≈ I²R ≈ 40 mW\` — fine for ¼ W.

---

## Wrong resistor?

| Too small R | Too large R |
|-------------|-------------|
| LED overheats | Dim or off |
| Resistor may smoke | Safe but weak |

**Never** connect an LED directly to 5 V — current is uncontrolled.

---

## What to do in CircuitWiz

1. Hover resistor / LED — **~13.6 mA**  
2. **~2 V** on LED, **~3 V** on resistor  
3. Try **R = 1 kΩ** → **~3 mA** (dimmer)`,
}
