import type { ExampleTheoryDoc } from './types'

export const voltageDividerTheory: ExampleTheoryDoc = {
  title: 'Voltage Divider',
  content: `# Voltage Divider — Theory Guide

## What problem does this solve?

Many parts of a circuit need **less voltage** than the main power supply provides.

- A microcontroller I/O pin might want **3.3 V** logic while the board has **5 V**
- A sensor output might need to be scaled down before you read it with an ADC
- You sometimes need a **reference voltage** that is a fixed fraction of your supply

A **voltage divider** is two resistors in **series**. They split the supply voltage so the point **between** the resistors sits at a predictable level. No chips required — just physics.

---

## Start with the basics

### Voltage

**Voltage** (V) is electrical *pressure*. Think of it like water pressure in a pipe: higher voltage means more "push" on electric charge.

We measure it in **volts**. This example uses a **5 V** supply — the positive rail is 5 V above ground (0 V).

### Current

**Current** (I) is the *flow* of charge — how many electrons per second move through a wire. We measure it in **amperes** (amps, A), or milliamps (mA) for small circuits.

### Resistance

A **resistor** limits current. Its value is in **ohms** (Ω). More ohms → less current for the same voltage.

**Ohm's law** ties the three together:

\`\`\`
V = I × R
\`\`\`

Rearrange when you need current or resistance: \`I = V / R\`, \`R = V / I\`.

---

## Resistors in series

When resistors are connected **end to end** (in **series**), the same current flows through **both**. There is only one path.

\`\`\`
Vin ----[ R1 ]----+---- Vout (middle tap)
                  |
                [ R2 ]
                  |
                 GND
\`\`\`

\`\`\`
Rtotal = R1 + R2
I = Vin / (R1 + R2)
Vout = Vin × R2 / (R1 + R2)
\`\`\`

That is the **voltage divider formula**. Memorize it — it appears everywhere.

### Intuition

- **Bigger R2** → **higher Vout** (tap closer to Vin)
- **Bigger R1** → **lower Vout** (tap closer to ground)
- **Equal resistors** → split **in half**

---

## This example circuit

| Part | Value |
|------|-------|
| **Vin** | 5 V |
| **R1** | 10 kΩ |
| **R2** | 10 kΩ |

\`\`\`
Vout = 5 V × 10k / (10k + 10k) = 2.5 V
\`\`\`

**Expect ~2.5 V** at the junction between the two resistors.

### Step-by-step

1. **Rtotal** = 20 kΩ  
2. **I** = 5 V / 20 kΩ = **0.25 mA**  
3. **Vout** = 0.25 mA × 10 kΩ = **2.5 V**  
4. **VR1** = 5 V − 2.5 V = **2.5 V**

---

## Limitations

A voltage divider is **not a power supply** for heavy loads. A load at Vout draws current and **pulls the tap voltage down**. For stable output under load, use a **regulator**.

---

## What to do in CircuitWiz

1. Hover the **junction** between R1 and R2 — **~2.5 V**  
2. Confirm **5 V** and **GND** rails  
3. Change R1 or R2 in properties and watch Vout update`,
}
