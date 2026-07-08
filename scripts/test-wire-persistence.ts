/**
 * Integration test for AI-placed WIRE persistence across reload.
 *
 * Mirrors scripts/test-planning-persistence.ts, but for the schematic wiring
 * path. Reproduces the exact real-world flow the AI uses when it wires a circuit:
 *   1. project_create_schematic            -> createSchematicInFolder()
 *   2. schematic_place_component (xN)       -> placeComponent()
 *   3. schematic_connect_pins   (xN)        -> connectPins()
 * Each tool call threads the folder through ctx and persists to (mocked)
 * localStorage after every call (mirrors runAgentTurn's onFolderUpdate), then
 * a page reload calls loadLocalSession().
 *
 * The contract we assert: after the compact(save) -> JSON -> hydrate(load)
 * round-trip, every wire survives byte-for-byte (id, colorId, and every
 * segment.from/segment.to coordinate), the wire count is exact, and every wire
 * endpoint still lands on a real connectable component cell in the reconstructed
 * gridData (guards the "dangling endpoint after gridData rebuild" risk).
 *
 * Drives the REAL production functions so it fails if wire persistence regresses.
 * Run with: npx tsx scripts/test-wire-persistence.ts
 */

import {
  createProjectFolder,
  type ProjectFolder,
  type Schematic,
} from '../src/types/workspace'
import { createSchematicInFolder } from '../src/agent/project/operations'
import {
  placeComponent,
  connectPins,
  listWires,
  listComponents,
} from '../src/agent/schematic/operations'
import { getSchematic, updateSchematicInFolder } from '../src/agent/helpers'
import { SCHEMATIC_LAYOUT_GUIDELINES, nextHorizontalOrigin } from '../src/agent/schematic/layoutGuidelines'
import {
  saveLocalSession,
  loadLocalSession,
  type LocalSession,
} from '../src/services/localProjectStorage'
import type { WireConnection } from '../src/modules/types'

// ---------------------------------------------------------------------------
// Minimal localStorage polyfill for node.
// ---------------------------------------------------------------------------
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}
;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let failures = 0
function check(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  \u2713 ${label}`)
  } else {
    failures++
    console.error(`  \u2717 FAIL: ${label}`)
  }
}

/** Mirrors App.persistSession/updateFolders: replace folder by id, write session. */
function persist(folders: ProjectFolder[], folder: ProjectFolder): ProjectFolder[] {
  const next = folders.map((f) => (f.id === folder.id ? folder : f))
  const session: LocalSession = {
    projectFolders: next,
    selectedFolderId: folder.id,
    selectedItemId: null,
    activeView: 'schematic',
  }
  const result = saveLocalSession(session)
  if (!result.ok) throw new Error(`saveLocalSession failed: ${result.error}`)
  return next
}

/** Compact wire representation for byte-for-byte comparison across a reload. */
function wireFingerprint(wires: WireConnection[]): string {
  return JSON.stringify(
    [...wires]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((w) => ({
        id: w.id,
        colorId: w.colorId,
        segs: w.segments.map((s) => ({ f: s.from, t: s.to })),
      }))
  )
}

/** Does grid cell (x,y) hold a connectable component pin? */
function isConnectableCell(schematic: Schematic, x: number, y: number): boolean {
  const cell = schematic.gridData[y]?.[x] as
    | { occupied?: boolean; cellIndex?: number; moduleDefinition?: { grid?: Array<{ isConnectable?: boolean }> } }
    | undefined
  if (!cell?.occupied) return false
  const mc = cell.moduleDefinition?.grid?.[cell.cellIndex ?? 0]
  return Boolean(mc?.isConnectable)
}

// The exact switch-controlled-LED circuit the agent dev test builds, using real
// module + pin names so connectPins resolves genuine pin coordinates.
const CHAIN: Array<{
  moduleName: string
  componentId: string
  gridX: number
  properties?: Record<string, unknown>
}> = [
  { moduleName: 'PowerSupply', componentId: 'ps1', gridX: 2, properties: { voltage: 5, current: 1 } },
  { moduleName: 'Push Button', componentId: 'btn1', gridX: 3 },
  { moduleName: 'Resistor', componentId: 'r1', gridX: 3, properties: { resistance: 330 } },
  { moduleName: 'LED', componentId: 'led1', gridX: 3 },
]

const CONNECTIONS = [
  { fromComponentId: 'ps1', fromPin: '5V', toComponentId: 'btn1', toPin: 'IN' },
  { fromComponentId: 'btn1', fromPin: 'OUT', toComponentId: 'r1', toPin: '1' },
  { fromComponentId: 'r1', fromPin: '2', toComponentId: 'led1', toPin: '+' },
  { fromComponentId: 'led1', fromPin: '-', toComponentId: 'ps1', toPin: 'GND' },
]

interface RunResult {
  ok: boolean
  detail: string
}

/** One full AI wiring run: build + persist per tool call, then reload + verify. */
function runOnce(seed: number): RunResult {
  localStorage.clear()

  const base = createProjectFolder(`Circuit ${seed}`, 'Wire persistence test')
  let folders: ProjectFolder[] = [base]

  // 1. project_create_schematic
  const created = createSchematicInFolder(base, 'S1', 'AI wiring test')
  let folder = created.folder
  const schematicId = created.schematic.id
  folders = persist(folders, folder)

  // 2. schematic_place_component (one call per part, persist after each)
  const { x: ox, y: oy } = SCHEMATIC_LAYOUT_GUIDELINES.placementOrigin
  let nextX = ox
  const errors: string[] = []
  for (const part of CHAIN) {
    const sch = getSchematic(folder, schematicId)
    if (!sch) return { ok: false, detail: 'schematic missing during placement' }
    const result = placeComponent(sch, part.moduleName, nextX, oy, part.properties ?? {}, part.componentId)
    if ('error' in result) {
      errors.push(`place ${part.moduleName}: ${result.error}`)
      break
    }
    const updated = updateSchematicInFolder(folder, schematicId, () => result.schematic)
    if (!updated) return { ok: false, detail: `failed to save placement ${part.moduleName}` }
    folder = updated
    folders = persist(folders, folder)
    nextX = nextHorizontalOrigin(nextX, part.gridX)
  }

  // 3. schematic_connect_pins (one call per wire, persist after each)
  for (const conn of CONNECTIONS) {
    const sch = getSchematic(folder, schematicId)
    if (!sch) return { ok: false, detail: 'schematic missing during wiring' }
    const result = connectPins(sch, conn.fromComponentId, conn.fromPin, conn.toComponentId, conn.toPin)
    if ('error' in result) {
      errors.push(`wire ${conn.fromComponentId}.${conn.fromPin}->${conn.toComponentId}.${conn.toPin}: ${result.error}`)
      continue
    }
    const updated = updateSchematicInFolder(folder, schematicId, () => result.schematic)
    if (!updated) return { ok: false, detail: 'failed to save wire' }
    folder = updated
    folders = persist(folders, folder)
  }

  if (errors.length) return { ok: false, detail: errors.join('; ') }

  // Snapshot the in-memory (pre-reload) wires — this is what the user "sees".
  const preSchematic = getSchematic(folder, schematicId)!
  const preWires = preSchematic.wires
  const preFingerprint = wireFingerprint(preWires)

  if (preWires.length !== CONNECTIONS.length) {
    return { ok: false, detail: `expected ${CONNECTIONS.length} wires before reload, got ${preWires.length}` }
  }

  // 4. Reload (compact -> JSON -> hydrate).
  const reloaded = loadLocalSession()
  const postFolder = reloaded?.projectFolders.find((f) => f.id === base.id)
  const postSchematic = postFolder?.schematics.find((s) => s.id === schematicId)
  if (!postSchematic) return { ok: false, detail: 'schematic missing after reload' }

  const postWires = postSchematic.wires
  const postFingerprint = wireFingerprint(postWires)

  if (postWires.length !== preWires.length) {
    return { ok: false, detail: `wire count changed on reload: ${preWires.length} -> ${postWires.length}` }
  }
  if (postFingerprint !== preFingerprint) {
    return { ok: false, detail: 'wire geometry/ids changed across reload' }
  }

  // Every wire endpoint must still land on a real connectable pin cell in the
  // reconstructed gridData (guards the dangling-endpoint risk).
  for (const w of postWires) {
    for (const s of w.segments) {
      for (const p of [s.from, s.to]) {
        const onGrid =
          p.y >= 0 &&
          p.y < postSchematic.gridData.length &&
          p.x >= 0 &&
          p.x < (postSchematic.gridData[p.y]?.length ?? 0)
        if (!onGrid) {
          return { ok: false, detail: `wire ${w.id} endpoint (${p.x},${p.y}) out of grid bounds after reload` }
        }
      }
    }
  }

  // Endpoints of connectPins wires are pin coordinates — at least the four
  // wires' terminal endpoints should sit on connectable cells.
  let danglingEndpoints = 0
  for (const w of postWires) {
    const ends = [w.segments[0]?.from, w.segments[w.segments.length - 1]?.to].filter(Boolean) as Array<{
      x: number
      y: number
    }>
    for (const e of ends) {
      if (!isConnectableCell(postSchematic, e.x, e.y)) danglingEndpoints++
    }
  }
  if (danglingEndpoints > 0) {
    return { ok: false, detail: `${danglingEndpoints} wire endpoint(s) no longer on a connectable pin after reload` }
  }

  // Components must also survive so the wired pins remain real.
  const postComponentCount = listComponents(postSchematic).length
  const preComponentCount = listComponents(preSchematic).length
  if (postComponentCount !== preComponentCount) {
    return { ok: false, detail: `component count changed on reload: ${preComponentCount} -> ${postComponentCount}` }
  }

  // 5. Double reload: re-save the hydrated folder and reload again — wires must
  // remain stable (hydrate rebuilds gridData; re-compact must not drift wires).
  let folders2 = persist([postFolder!], postFolder!)
  void folders2
  const reloaded2 = loadLocalSession()
  const post2 = reloaded2?.projectFolders
    .find((f) => f.id === base.id)
    ?.schematics.find((s) => s.id === schematicId)
  if (!post2) return { ok: false, detail: 'schematic missing after second reload' }
  if (wireFingerprint(post2.wires) !== preFingerprint) {
    return { ok: false, detail: 'wire geometry/ids drifted after a second reload' }
  }

  return { ok: true, detail: `${postWires.length} wires, ${postComponentCount} components stable` }
}

// ---------------------------------------------------------------------------
// Sanity: show a single detailed run first.
// ---------------------------------------------------------------------------
console.log('\nSingle detailed run (AI places 4 parts + 4 wires, reload):')
{
  const r = runOnce(1)
  check('wires + components persist byte-for-byte across reload', r.ok)
  console.log(`    -> ${r.detail}`)
  check('wires survive a second save/reload round-trip (no drift)', r.ok)
}

// ---------------------------------------------------------------------------
// Prove it works EVERY TIME across many runs.
// ---------------------------------------------------------------------------
console.log('\nRepeated runs (prove AI-placed wires persist every time):')
const ITERATIONS = 250
let allGood = true
for (let i = 0; i < ITERATIONS; i++) {
  const r = runOnce(1000 + i)
  if (!r.ok) {
    allGood = false
    console.error(`  \u2717 iteration ${i} FAILED: ${r.detail}`)
  }
}
check(`AI-placed wires persist across reload for all ${ITERATIONS} runs`, allGood)

// ---------------------------------------------------------------------------
console.log('')
if (failures > 0) {
  console.error(`\u2717 ${failures} check(s) failed.`)
  process.exit(1)
} else {
  console.log('\u2713 All checks passed. AI-placed wires persist every time.')
  process.exit(0)
}
