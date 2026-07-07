import type { ExampleTheoryDoc } from './types'

export const npnSwitchLedTheory: ExampleTheoryDoc = {
  title: 'NPN Switch + LED',
  content: `# NPN Switch + LED — Theory Guide

## What this circuit does

A **toggle switch** feeds the NPN **base** through a **10 kΩ** resistor. When the switch is **closed**, the transistor **saturates** and pulls the LED cathode toward ground so current flows: **5 V → 220 Ω → LED → collector → emitter → GND**.

When the switch is **open**, base drive is removed and the LED turns **off**.

---

## Signal path

\`\`\`
5V ──[Switch]──[10k]── B (NPN)
                        │
5V ──[220Ω]──[LED]──── C
                        │
                       E ── GND
\`\`\`

A **100 kΩ** base pull-down keeps the base near ground when the switch is open.

---

## Parts in this example

| Part | Value | Role |
|------|-------|------|
| Switch | SPST | Connects 5 V to base bias when closed |
| R_base | 10 kΩ | Limits base current |
| R_pull | 100 kΩ | Holds base low when switch open |
| R_LED | 220 Ω | LED current limit |
| NPN | — | Low-side switch for the LED |

---

## When the switch is closed

\`\`\`
Ib ≈ (5 V − 0.7 V) / 10 kΩ ≈ 0.43 mA
I_LED ≈ (5 V − 2 V − 0.2 V) / 220 Ω ≈ 13 mA
\`\`\`

(Vce(sat) ≈ 0.2 V in the simulator.)

---

## What to do in CircuitWiz

1. Open **Circuit Controls** and **close** the switch (or click the switch body on the grid).
2. LED should show **on**; collector ~0.2 V, base ~5 V.
3. **Open** the switch — LED off, base ~0 V.`,
}
