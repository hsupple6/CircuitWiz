/**
 * Integration test for LED circuit reliability in the electrical solver.
 *
 * Builds circuits with the REAL agent ops (placeComponent / connectPins), then
 * runs the REAL solver (calculateElectricalFlow) and asserts on the resulting
 * LED state + circuitInfo.errors. This is the regression guard for the
 * "V reaches the resistor but the LED won't light" class of bugs.
 *
 * Scenarios:
 *   1. Clean loop            -> LED lights, no error.
 *   2. Near-miss endpoint    -> a wire that ends 1 cell off the LED pin still
 *                               connects (forgiving connectivity) and lights.
 *   3. Reversed LED          -> auto-oriented so it lights, and reported as
 *                               "reversed (auto-corrected)".
 *   4. Genuinely open loop   -> LED stays OFF and a reason is reported.
 *   5. Example regression    -> the canonical clean loop lights every time.
 *
 * Run with: npx tsx scripts/test-led-simulation.ts
 */

import { createProjectFolder, type ProjectFolder } from '../src/types/workspace'
import { createSchematicInFolder } from '../src/agent/project/operations'
import { placeComponent, connectPins } from '../src/agent/schematic/operations'
import { getSchematic, updateSchematicInFolder } from '../src/agent/helpers'
import { SCHEMATIC_LAYOUT_GUIDELINES, nextHorizontalOrigin } from '../src/agent/schematic/layoutGuidelines'
import { calculateElectricalFlow } from '../src/systems/ElectricalSystem'
import type { WireConnection } from '../src/modules/types'
import type { Schematic } from '../src/types/workspace'

// Minimal localStorage polyfill (some helpers may touch it defensively).
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string) { this.store.set(k, v) }
  removeItem(k: string) { this.store.delete(k) }
  clear() { this.store.clear() }
}
;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let failures = 0
function check(label: string, condition: boolean, extra?: string): void {
  if (condition) {
    console.log(`  \u2713 ${label}`)
  } else {
    failures++
    console.error(`  \u2717 FAIL: ${label}${extra ? ` — ${extra}` : ''}`)
  }
}

type Part = { moduleName: string; componentId: string; gridX: number; properties?: Record<string, unknown> }
type Conn = { fromComponentId: string; fromPin: string; toComponentId: string; toPin: string }

const CHAIN: Part[] = [
  { moduleName: 'PowerSupply', componentId: 'ps1', gridX: 2, properties: { voltage: 5, current: 1 } },
  { moduleName: 'Resistor', componentId: 'r1', gridX: 3, properties: { resistance: 330 } },
  { moduleName: 'LED', componentId: 'led1', gridX: 3 },
]

const CLEAN: Conn[] = [
  { fromComponentId: 'ps1', fromPin: '5V', toComponentId: 'r1', toPin: '1' },
  { fromComponentId: 'r1', fromPin: '2', toComponentId: 'led1', toPin: '+' },
  { fromComponentId: 'led1', fromPin: '-', toComponentId: 'ps1', toPin: 'GND' },
]

// Anode/cathode swapped: power drives the cathode side.
const REVERSED: Conn[] = [
  { fromComponentId: 'ps1', fromPin: '5V', toComponentId: 'r1', toPin: '1' },
  { fromComponentId: 'r1', fromPin: '2', toComponentId: 'led1', toPin: '-' },
  { fromComponentId: 'led1', fromPin: '+', toComponentId: 'ps1', toPin: 'GND' },
]

// No return path from the LED back to the supply ground.
const OPEN: Conn[] = [
  { fromComponentId: 'ps1', fromPin: '5V', toComponentId: 'r1', toPin: '1' },
  { fromComponentId: 'r1', fromPin: '2', toComponentId: 'led1', toPin: '+' },
]

/** Build a schematic via the real ops. Throws with detail on any op failure. */
function buildSchematic(seed: number, connections: Conn[]): Schematic {
  const base = createProjectFolder(`LED ${seed}`, 'LED sim test')
  const created = createSchematicInFolder(base, 'S1', 'LED sim')
  let folder: ProjectFolder = created.folder
  const schematicId = created.schematic.id

  const { x: ox, y: oy } = SCHEMATIC_LAYOUT_GUIDELINES.placementOrigin
  let nextX = ox
  for (const part of CHAIN) {
    const sch = getSchematic(folder, schematicId)
    if (!sch) throw new Error('schematic missing during placement')
    const result = placeComponent(sch, part.moduleName, nextX, oy, part.properties ?? {}, part.componentId)
    if ('error' in result) throw new Error(`place ${part.moduleName}: ${result.error}`)
    const updated = updateSchematicInFolder(folder, schematicId, () => result.schematic)
    if (!updated) throw new Error(`save placement ${part.moduleName}`)
    folder = updated
    nextX = nextHorizontalOrigin(nextX, part.gridX)
  }

  for (const conn of connections) {
    const sch = getSchematic(folder, schematicId)
    if (!sch) throw new Error('schematic missing during wiring')
    const result = connectPins(sch, conn.fromComponentId, conn.fromPin, conn.toComponentId, conn.toPin)
    if ('error' in result) {
      throw new Error(`wire ${conn.fromComponentId}.${conn.fromPin}->${conn.toComponentId}.${conn.toPin}: ${result.error}`)
    }
    const updated = updateSchematicInFolder(folder, schematicId, () => result.schematic)
    if (!updated) throw new Error('save wire')
    folder = updated
  }

  const sch = getSchematic(folder, schematicId)
  if (!sch) throw new Error('schematic missing after build')
  return sch
}

/** All grid coordinates occupied by a given component. */
function componentCellKeys(schematic: Schematic, componentId: string): Set<string> {
  const keys = new Set<string>()
  schematic.gridData.forEach((row, y) => {
    row?.forEach((cell, x) => {
      const c = cell as { componentId?: string } | undefined
      if (c?.componentId === componentId) keys.add(`${x},${y}`)
    })
  })
  return keys
}

/**
 * Shift every wire endpoint that currently lands on a `componentId` cell by
 * (dx,dy), producing a "near-miss" that no longer sits exactly on the pin.
 */
function perturbEndpointsOn(
  wires: WireConnection[],
  componentCells: Set<string>,
  dx: number,
  dy: number
): { wires: WireConnection[]; moved: number } {
  let moved = 0
  const cloned: WireConnection[] = JSON.parse(JSON.stringify(wires))
  const shift = (p: { x: number; y: number }) => {
    if (componentCells.has(`${p.x},${p.y}`)) {
      p.x += dx
      p.y += dy
      moved++
    }
  }
  cloned.forEach((w) => w.segments.forEach((s) => { shift(s.from); shift(s.to) }))
  return { wires: cloned, moved }
}

/** True if any solved cell for this LED id is lit. */
function ledIsOn(componentStates: Map<string, { isOn?: boolean }>, ledId: string): boolean {
  for (const [key, state] of componentStates) {
    if (key.startsWith(`${ledId}-`) && state.isOn) return true
  }
  return false
}

function solve(schematic: Schematic, wires?: WireConnection[]) {
  return calculateElectricalFlow(schematic.gridData, wires ?? schematic.wires)
}

// ---------------------------------------------------------------------------
// Detailed single runs
// ---------------------------------------------------------------------------
console.log('\nScenario 1 — clean loop lights:')
{
  const sch = buildSchematic(1, CLEAN)
  const res = solve(sch)
  const on = ledIsOn(res.componentStates, 'led1')
  check('LED lights on a clean PowerSupply -> Resistor -> LED -> GND loop', on)
  const errs = res.circuitInfo?.errors ?? []
  check('no "insufficient forward voltage" error on a working clean loop',
    !errs.some((e) => e.includes('insufficient forward voltage')), errs.join(' | '))
}

console.log('\nScenario 2 — near-miss wire endpoint still connects:')
{
  const sch = buildSchematic(2, CLEAN)
  const ledCells = componentCellKeys(sch, 'led1')
  // Move the wire endpoints that touch the LED one cell up (off the pin).
  const { wires, moved } = perturbEndpointsOn(sch.wires, ledCells, 0, -1)
  check('a wire endpoint was actually moved off the LED pin', moved > 0, `moved=${moved}`)
  // Confirm the endpoint is genuinely no longer on any LED cell.
  const stillOnLed = wires.some((w) => w.segments.some((s) =>
    ledCells.has(`${s.from.x},${s.from.y}`) || ledCells.has(`${s.to.x},${s.to.y}`)))
  check('perturbed endpoint is off-pin (no longer on an LED cell)', !stillOnLed)
  const res = solve(sch, wires)
  check('LED still lights via forgiving 1-cell connectivity snapping', ledIsOn(res.componentStates, 'led1'))
}

console.log('\nScenario 3 — reversed LED auto-corrects and lights:')
{
  const sch = buildSchematic(3, REVERSED)
  const res = solve(sch)
  check('reverse-wired LED still lights (auto-oriented)', ledIsOn(res.componentStates, 'led1'))
  const errs = res.circuitInfo?.errors ?? []
  check('reversed LED is reported as "reversed (auto-corrected)"',
    errs.some((e) => e.toLowerCase().includes('reversed')), errs.join(' | '))
}

console.log('\nScenario 4 — genuinely open loop stays off with a reason:')
{
  const sch = buildSchematic(4, OPEN)
  const res = solve(sch)
  check('open circuit keeps the LED OFF', !ledIsOn(res.componentStates, 'led1'))
  const errs = res.circuitInfo?.errors ?? []
  check('open circuit reports at least one reason', errs.length > 0, `errors=${errs.length}`)
}

console.log('\nScenario 5 — canonical example regression:')
{
  const sch = buildSchematic(5, CLEAN)
  const res = solve(sch)
  check('the canonical example loop lights', ledIsOn(res.componentStates, 'led1'))
}

// ---------------------------------------------------------------------------
// Prove it works EVERY TIME across many runs.
// ---------------------------------------------------------------------------
console.log('\nRepeated runs (prove reliability every time):')
const ITERATIONS = 200
let cleanAllOn = true
let nearAllOn = true
let revAllOn = true
let openAllOff = true
for (let i = 0; i < ITERATIONS; i++) {
  const seed = 1000 + i
  try {
    const cleanSch = buildSchematic(seed, CLEAN)
    if (!ledIsOn(solve(cleanSch).componentStates, 'led1')) cleanAllOn = false

    const nearSch = buildSchematic(seed + 100000, CLEAN)
    const ledCells = componentCellKeys(nearSch, 'led1')
    const { wires } = perturbEndpointsOn(nearSch.wires, ledCells, 0, -1)
    if (!ledIsOn(solve(nearSch, wires).componentStates, 'led1')) nearAllOn = false

    const revSch = buildSchematic(seed + 200000, REVERSED)
    if (!ledIsOn(solve(revSch).componentStates, 'led1')) revAllOn = false

    const openSch = buildSchematic(seed + 300000, OPEN)
    if (ledIsOn(solve(openSch).componentStates, 'led1')) openAllOff = false
  } catch (err) {
    failures++
    console.error(`  \u2717 iteration ${i} threw: ${(err as Error).message}`)
    break
  }
}
check(`clean loop lights for all ${ITERATIONS} runs`, cleanAllOn)
check(`near-miss loop lights for all ${ITERATIONS} runs`, nearAllOn)
check(`reversed loop lights for all ${ITERATIONS} runs`, revAllOn)
check(`open loop stays off for all ${ITERATIONS} runs`, openAllOff)

console.log('')
if (failures > 0) {
  console.error(`\u2717 ${failures} check(s) failed.`)
  process.exit(1)
} else {
  console.log('\u2713 All checks passed. User-built LED circuits light reliably.')
  process.exit(0)
}
