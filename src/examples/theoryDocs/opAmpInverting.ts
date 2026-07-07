import type { ExampleTheoryDoc } from './types'

export const opAmpInvertingTheory: ExampleTheoryDoc = {
  title: 'Op-Amp Inverting Amplifier',
  content: `# Op-Amp Inverting Amplifier — Theory Guide

## What problem does this solve?

Scale or invert a small signal with a gain set **only by resistors** — repeatable and linear.

---

## Golden rules (negative feedback)

1. **V+ ≈ V−** (op-amp drives output until inputs match)  
2. **No current** into input pins (ideal)

---

## Formula

\`\`\`
Vout = −(Rf / Rin) × Vin
\`\`\`

**Gain magnitude:** \`Av = Rf / Rin\` (minus sign = inverted).

---

## This example

| Part | Value |
|------|-------|
| **Rin** | 1 kΩ |
| **Rf** | 10 kΩ |
| **Gain** | 10× inverted |
| **V+** | Ground |
| Supply | 5 V single-rail |

Input divider **9 kΩ / 1 kΩ** on 5 V:

\`\`\`
Vin_nominal = 5 V × 1k/(9k+1k) = 0.5 V
Vout_ideal = −10 × 0.5 V = −5 V
\`\`\`

**Single 5 V supply cannot output negative voltage** → output **clips near 0 V**.

That is normal — **rails limit swing**.

---

## Virtual ground

The **−** input sits at ~0 V via feedback without a direct wire — **virtual ground**.

---

## What to do in CircuitWiz

1. Read **Vin** at Rin (may be ~0.26–0.5 V with loading)  
2. Output **clips at ~0 V**, not −5 V  
3. Apply \`Vout = −10×Vin\` mentally and compare`,
}
