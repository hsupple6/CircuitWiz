import type { ExampleTheoryDoc } from './types'

export const npnSwitchTheory: ExampleTheoryDoc = {
  title: 'NPN Transistor Switch',
  content: `# NPN Transistor Switch — Theory Guide

## What problem does this solve?

A logic pin can only supply **milliamps**. A relay, motor, or heavy load may need **much more**.

An **NPN transistor** is a **current-controlled switch**: small **base current** allows larger **collector–emitter** current through the load.

This is a **low-side switch** — load on top, transistor pulls the bottom to ground.

---

## Pins

| Pin | Role |
|-----|------|
| **B** (base) | Control input |
| **C** (collector) | High-current side → load |
| **E** (emitter) | Usually **GND** |

---

## Regions

- **Cutoff** — off → Ic ≈ 0  
- **Saturation** — fully on → Vce ≈ 0.1–0.3 V (small switch drop)

---

## Current gain β

\`\`\`
Ic ≈ β × Ib     (β often 100–300)
Ib ≥ Ic / β     (design margin)
\`\`\`

---

## This example

| Part | Value |
|------|-------|
| **Vcc** | 5 V |
| **R_load** | 1 kΩ |
| **R_base** | 10 kΩ |

When **ON**:

\`\`\`
Ic ≈ (5 V − 0.2 V) / 1 kΩ ≈ 4.8 mA
Ib ≈ (5 V − 0.7 V) / 10 kΩ ≈ 0.43 mA  (plenty for β=100)
\`\`\`

**Expect Vce(sat) ~0.2 V** when saturated.

When **OFF**: collector near **5 V**, no load current.

---

## Why R_base?

Limits base current — without it you'd short the GPIO / destroy the transistor.

---

## What to do in CircuitWiz

1. Collector **~0.2–0.5 V** when on, **~5 V** when off  
2. Load current **~4.8 mA** when on  
3. Base **~0.7 V** above emitter when conducting`,
}
