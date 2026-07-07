import type { ExampleTheoryDoc } from './types'

export const parallelResistorsTheory: ExampleTheoryDoc = {
  title: 'Parallel Resistors',
  content: `# Parallel Resistors — Theory Guide

## What problem does this solve?

Resistors in **parallel** share the **same voltage** but split **current** — giving a **lower total resistance** than any single branch.

---

## Series vs parallel

| | Series | Parallel |
|---|--------|----------|
| Same current? | Yes | No |
| Same voltage? | No | Yes |
| Total R | R1 + R2 | Smaller than smallest |

---

## Two resistors in parallel

\`\`\`
        +----[ R1 ]----+
Vin ----+              +
        +----[ R2 ]----+
\`\`\`

\`\`\`
1/Req = 1/R1 + 1/R2
Req = (R1 × R2) / (R1 + R2)
\`\`\`

**Parallel Req is always less than the smallest resistor.**

---

## This example

| Part | Value |
|------|-------|
| **Vin** | 5 V |
| **R1** | 1 kΩ |
| **R2** | 2 kΩ |

\`\`\`
Req = (1000 × 2000) / 3000 ≈ 667 Ω
Itotal = 5 V / 667 Ω ≈ 7.5 mA
I1 = 5 mA ,  I2 = 2.5 mA
\`\`\`

---

## Intuition

A second path is another lane for current — more flow for the same voltage.

- Equal R in parallel → **half** resistance  
- Open branch → Req = other R alone  
- Short branch → disaster (huge current)

---

## What to do in CircuitWiz

1. Each resistor: **same voltage**, different currents  
2. Supply wire: **~7.5 mA** total  
3. Set R2 = R1 = 1 kΩ → Req = **500 Ω**`,
}
