/**
 * LM317M + potentiometer feedback test — sweeps wiper and checks Vout tracks
 * Vref × (1 + R2/R1) with R1/R2 from the pot divider.
 *
 * Run: npx tsx nodal_solver_tests/test_lm317_pot.ts
 */

import { solveCircuit } from '../src/services/CircuitSolver'
import { buildSchematic } from '../src/examples/schematicBuilder'
import { posKey } from '../src/systems/chain/utils'

const VREF = 1.25
const VIN = 15
const POT_R = 10_000

function expectedVout(wiper: number): number {
  const ratio = Math.min(0.999, Math.max(0.001, wiper))
  const r1 = POT_R * (1 - ratio)
  const r2 = POT_R * ratio
  return Math.min(37, VREF * (1 + r2 / r1))
}

function lm317PotSchematic(wiperPosition: number) {
  return buildSchematic(
    `LM317 + Pot ${Math.round(wiperPosition * 100)}%`,
    `15V → LM317M, pot A=VOUT W=ADJ B=GND, 1kΩ load on VOUT`,
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10, { voltage: VIN })
      const reg = place('LM317M', 8, 8)
      const pot = place('Potentiometer', 14, 10, { resistance: POT_R, wiperPosition })
      const rLoad = place('Resistor', 18, 8, { resistance: 1_000 })

      wire([ps.pin('5V'), { x: 6, y: 8 }, reg.pin('VIN')], { powered: true })
      wire([ps.pin('GND'), reg.pin('GND')], { grounded: true })
      wire([reg.pin('GND'), pot.pin('B')], { grounded: true })
      wire([reg.pin('VOUT'), pot.pin('A')])
      wire([reg.pin('ADJ'), pot.pin('W')])
      wire([reg.pin('VOUT'), rLoad.at(0, 0)])
      wire(
        [rLoad.at(2, 0), { x: 20, y: 8 }, { x: 20, y: 14 }, { x: 3, y: 14 }, ps.pin('GND')],
        { grounded: true }
      )
    }
  )
}

function voutVoltage(schematic: ReturnType<typeof lm317PotSchematic>): number {
  const result = solveCircuit(schematic.gridData, schematic.wires)
  const voutKey = posKey(8 + 2, 8 + 0) // LM317 VOUT pin at origin (8,8) + cell (2,0)
  const v = result.nodeVoltages.get(voutKey) ?? 0
  return v
}

const WIPER_POSITIONS = [0.1, 0.25, 0.5, 0.75, 0.9]

let passed = 0
let failed = 0

console.log('LM317M + potentiometer feedback test')
console.log(`Vin=${VIN}V  Vref=${VREF}V  Pot=${POT_R}Ω\n`)
console.log('Wiper%   Expected   Measured   Δ        Status')
console.log('------   --------   --------   ---      ------')

for (const wiper of WIPER_POSITIONS) {
  const schematic = lm317PotSchematic(wiper)
  const result = solveCircuit(schematic.gridData, schematic.wires)
  const expected = expectedVout(wiper)
  const measured = result.nodeVoltages.get(posKey(10, 8)) ?? 0
  const tol = Math.max(0.05, expected * 0.03)
  const ok = result.works && Math.abs(measured - expected) <= tol

  if (ok) passed++
  else failed++

  console.log(
    `${String(Math.round(wiper * 100)).padStart(5)}%   ` +
      `${expected.toFixed(3).padStart(8)}   ` +
      `${measured.toFixed(3).padStart(8)}   ` +
      `${(measured - expected).toFixed(3).padStart(7)}   ` +
      (ok ? 'PASS' : `FAIL${result.works ? '' : ` (${result.reason})`}`)
  )
}

console.log(`\n${passed} passed, ${failed} failed`)

// Monotonicity: higher wiper → higher Vout
const voltages = WIPER_POSITIONS.map((w) => {
  const s = lm317PotSchematic(w)
  return solveCircuit(s.gridData, s.wires).nodeVoltages.get(posKey(10, 8)) ?? 0
})
let monotonic = true
for (let i = 1; i < voltages.length; i++) {
  if (voltages[i] <= voltages[i - 1] + 0.01) monotonic = false
}
if (monotonic) {
  console.log('Monotonic sweep: PASS (Vout rises with wiper)')
  passed++
} else {
  console.log('Monotonic sweep: FAIL', voltages.map((v) => v.toFixed(2)).join(' → '))
  failed++
}

process.exit(failed > 0 ? 1 : 0)
