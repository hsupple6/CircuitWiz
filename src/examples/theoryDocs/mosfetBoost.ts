import type { ExampleTheoryDoc } from './types'

export const mosfetBoostTheory: ExampleTheoryDoc = {
  title: 'MOSFET Boost Converter',
  content: `# MOSFET Boost Converter — Theory Guide

## What problem does this solve?

You have **3.7 V** (single Li-ion cell) but need **5 V, 8 V, or more** for a load.

A **boost converter** stores energy in an **inductor** and releases it at higher voltage through a **switch + diode + capacitor**.

---

## Topology (this schematic)

\`\`\`
Vin ----[ L ]----+----[ Diode ]----+---- Vout (cap + load)
                 |                  |
               [ NMOS ]              |
                 |                  |
                GND                GND
\`\`\`

**NMOS** on the **low side** — source to ground, drain at the **switch node**.

---

## Two phases (simplified)

### Switch ON (FET conducts)

- Inductor tied **Vin → GND** through FET  
- Current ramps **up** in L — energy stored in magnetic field  
- Diode **reverse-biased** — load fed by capacitor

### Switch OFF (FET blocks)

- Inductor current **cannot stop instantly**  
- Voltage on switch node **flies up**  
- Diode **forward-biases** → current flows to **output cap + load**  
- Inductor **discharges** into output

Repeat at high frequency (PWM).

---

## Average output voltage (CCM)

In continuous conduction mode, ideal relationship:

\`\`\`
Vout ≈ Vin / (1 − D) − Vdiode
\`\`\`

| Symbol | Meaning |
|--------|---------|
| **D** | PWM **duty cycle** (fraction ON) |
| **Vdiode** | Diode forward drop (~0.7 V) |

Higher **D** → higher **Vout** (more energy transferred per cycle).

---

## This example numbers

| Part | Value |
|------|-------|
| **Vin** | 3.7 V |
| **L** | 100 µH |
| **Cout** | 100 µF |
| **Load** | 1 kΩ |
| **Idle D** | 40% (MOSFET property) |
| **Sim D** | ~60% (Arduino D9 PWM, sketch default) |

**Idle preview (40%):**

\`\`\`
Vout ≈ 3.7 / (1 − 0.4) − 0.7 ≈ 5.5 V
\`\`\`

**With simulation (~60%):**

\`\`\`
Vout ≈ 3.7 / (1 − 0.6) − 0.7 ≈ 8.5 V
\`\`\`

---

## Where to measure (important)

| Location | Voltage |
|----------|---------|
| Battery / inductor input | **~3.7 V** |
| Switch node (drain) | **Low when FET on** (~1 V avg in sim) — not Vout |
| **Right of diode** (cap, load) | **Boosted Vout** (~5.5 V idle, ~8.5 V sim) |

The **green output rail** is the boosted side.

---

## Gate drive

- **10 kΩ** bias from battery  
- **100 Ω** + **Arduino D9 PWM** for switching  
- Assign **MOSFET Boost PWM** program and **Run** simulation

---

## CircuitWiz model notes

- Inductor at DC uses **DCR** (wire resistance)  
- PWM is **averaged** duty, not cycle-by-cycle switching ripple  
- Good for learning **topology + regulation**, not MHz switching losses

---

## What to do in CircuitWiz

1. Without sim: hover **load** — **~5.5 V**  
2. Run **MOSFET Boost PWM** on Arduino  
3. Hover **diode cathode / load** — **~8.5 V**  
4. Do **not** expect 8 V on the MOSFET drain — that is the switch node`,
}
