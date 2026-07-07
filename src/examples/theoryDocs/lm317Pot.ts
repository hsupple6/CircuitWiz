import type { ExampleTheoryDoc } from './types'

export const lm317PotTheory: ExampleTheoryDoc = {
  title: 'LM317 + Potentiometer',
  content: `# LM317 Adjustable Regulator — Theory Guide

## What problem does this solve?

You need a **stable DC output** that you can **turn up or down** without swapping resistors — for a bench supply, sensor bias, or motor speed reference.

The **LM317** is a classic **linear voltage regulator**. Unlike a fixed 3.3 V or 5 V LDO, its output is set by a **feedback divider** on the **ADJ** pin. A **potentiometer** wired as that divider gives you a smooth voltage knob.

---

## Pin roles

| Pin | Role |
|-----|------|
| **VIN** | Unregulated input (must stay above Vout + dropout) |
| **VOUT** | Regulated output |
| **ADJ** | Feedback — regulator holds ADJ at **Vref** (~1.25 V) |
| **GND** | Ground reference |

This example uses **15 V** in. The LM317M is rated for **1.5 A** max output current.

---

## Feedback divider

The regulator drives **VOUT** so **ADJ** sits at **Vref** (1.25 V). Treat the pot as two resistors:

- **R1** — from **VOUT** to **ADJ** (top of pot, pin **A** → wiper **W**)
- **R2** — from **ADJ** to **GND** (wiper **W** → bottom **B**)

\`\`\`
VOUT ----[ R1 ]----+---- ADJ (held at Vref)
                   |
                 [ R2 ]
                   |
                  GND
\`\`\`

\`\`\`
Vout = Vref × (1 + R2 / R1)
\`\`\`

With a **10 kΩ** pot at **50%** wiper: R1 ≈ R2 ≈ 5 kΩ → **Vout ≈ 2.5 V**.

---

## Pot wiring in this schematic

| Pot pin | Connected to |
|---------|----------------|
| **A** | LM317 **VOUT** |
| **W** | LM317 **ADJ** |
| **B** | **GND** |

Turning the wiper **up** (more R2, less R1) **raises Vout**. Turning it **down** lowers Vout.

---

## This example — expected values

| Setting | Approx Vout |
|---------|-------------|
| Wiper **10%** | ~1.4 V |
| Wiper **50%** | ~2.5 V |
| Wiper **90%** | ~12.5 V |

A **1 kΩ** load on VOUT draws a few mA — light enough that the divider math still holds.

**Dropout:** VIN must stay roughly **2 V** above Vout. At 15 V in you can reach most of the table; very high wiper settings approach the headroom limit.

---

## What to do in CircuitWiz

1. Open **Interactive Controls** and sweep the **potentiometer** wiper.  
2. Hover **VOUT** — voltage should track the formula as you turn the knob.  
3. Confirm **ADJ** stays near **1.25 V** when the regulator is in regulation.  
4. Compare low vs high wiper: Vout should rise monotonically.

---

## Linear vs switching

The LM317 is **linear** — excess voltage is dropped inside the chip as heat. Simple and quiet, but inefficient when (VIN − Vout) × Iout is large. For big step-downs at high current, use a **buck** converter instead.`,
}
