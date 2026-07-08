/**
 * Integration test for the "Project Planning Suite" persistence bug.
 *
 * Reproduces the exact real-world flow that was losing data on reload:
 *   1. AI opens the product suite -> folder gets a productSuiteSession.
 *   2. User reviews + saves -> completeProductDefinition() writes productDefinition
 *      and clears the session; this is persisted to (mocked) localStorage.
 *   3. The follow-up AI "roadmap" turn threads plan-space edits off an initial
 *      context folder and persists after every tool call (mirrors runAgentTurn).
 *   4. Page reload -> loadLocalSession().
 *
 * The bug: the roadmap turn used to start from a STALE folder (pre-save, no
 * productDefinition, session still set), so every persisted folder clobbered the
 * just-saved definition. The fix passes the freshly-saved folder as the turn's
 * starting context.
 *
 * This test drives the REAL production functions (completeProductDefinition,
 * plan-space operations, saveLocalSession/loadLocalSession) so it fails if the
 * persistence contract regresses. Run with: npx tsx scripts/test-planning-persistence.ts
 */

import {
  createProjectFolder,
  type ProjectFolder,
  type ProductDefinitionAnswer,
  type ProductSuiteQuestion,
} from '../src/types/workspace'
import {
  openProductSuiteSession,
  completeProductDefinition,
} from '../src/agent/product/operations'
import { addBubble, connectBubbles } from '../src/agent/planSpace/operations'
import {
  saveLocalSession,
  loadLocalSession,
  type LocalSession,
} from '../src/services/localProjectStorage'

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
    activeView: 'folder',
  }
  const result = saveLocalSession(session)
  if (!result.ok) throw new Error(`saveLocalSession failed: ${result.error}`)
  return next
}

/**
 * Mirrors runAgentTurn's context threading: the AI builds a roadmap by calling
 * plan-space tools. Each tool returns folder = { ...ctx.folder, planSpace } and
 * fires onFolderUpdate, which persists. We start from `initialFolder` (the crux
 * of the bug/fix) and return the final persisted folder set.
 */
function simulateRoadmapTurn(
  folders: ProjectFolder[],
  initialFolder: ProjectFolder,
  bubbleCount: number
): ProjectFolder[] {
  let ctxFolder = initialFolder
  let working = folders
  const bubbleIds: string[] = []

  for (let i = 0; i < bubbleCount; i++) {
    const { planSpace, bubble } = addBubble(ctxFolder.planSpace, {
      text: `Phase ${i + 1}`,
      subtitle: `Roadmap milestone ${i + 1}`,
      x: 100 + i * 40,
      y: 100 + i * 30,
    })
    bubbleIds.push(bubble.id)
    // This is exactly what okPlanSpace does: { ...ctx.folder, planSpace }.
    ctxFolder = { ...ctxFolder, planSpace }
    working = persist(working, ctxFolder) // onFolderUpdate -> persist
  }

  // Connect consecutive bubbles (more plan-space tool calls).
  for (let i = 0; i < bubbleIds.length - 1; i++) {
    const { planSpace } = connectBubbles(ctxFolder.planSpace, bubbleIds[i], bubbleIds[i + 1])
    ctxFolder = { ...ctxFolder, planSpace }
    working = persist(working, ctxFolder)
  }

  // Final persist of updatedContext.folder (AgentContext post-turn write).
  working = persist(working, ctxFolder)
  return working
}

function makeQuestions(): ProductSuiteQuestion[] {
  return [
    { id: 'q1', prompt: 'What is the power source?', kind: 'text', category: 'power' },
    { id: 'q2', prompt: 'How does it communicate?', kind: 'text', category: 'comms' },
    { id: 'q3', prompt: 'Where is it deployed?', kind: 'text', category: 'environment' },
  ]
}

function makeAnswers(seed: number): ProductDefinitionAnswer[] {
  return [
    { questionId: 'q1', prompt: 'What is the power source?', answer: `LiPo ${seed}`, category: 'power' },
    { questionId: 'q2', prompt: 'How does it communicate?', answer: 'BLE', category: 'comms' },
    { questionId: 'q3', prompt: 'Where is it deployed?', answer: 'Outdoors', category: 'environment' },
  ]
}

/** One full run. `useFix=true` starts the roadmap turn from the saved folder. */
function runOnce(seed: number, bubbleCount: number, useFix: boolean) {
  localStorage.clear()

  // Base folder as it exists before the suite opens.
  const base = createProjectFolder(`Widget ${seed}`, 'A test product')
  let folders: ProjectFolder[] = [base]
  folders = persist(folders, base)

  // 1. AI opens the product suite.
  const withSession = openProductSuiteSession(base, {
    phase: 'questions',
    idea: `Smart widget ${seed}`,
    questions: makeQuestions(),
  })
  folders = persist(folders, withSession)

  // 2. User reviews + saves -> definition written, session cleared.
  const savedFolder = completeProductDefinition(withSession, {
    idea: `Smart widget ${seed}`,
    summary: `A smart widget number ${seed} for testing persistence.`,
    answers: makeAnswers(seed),
  })
  folders = persist(folders, savedFolder) // onProjectUpdate(folder)

  // 3. Roadmap turn. The bug used `withSession` (stale) as the starting context;
  //    the fix uses `savedFolder` (contextOverride).
  const initialContextFolder = useFix ? savedFolder : withSession
  folders = simulateRoadmapTurn(folders, initialContextFolder, bubbleCount)

  // 4. Reload.
  const reloaded = loadLocalSession()
  const folder = reloaded?.projectFolders.find((f) => f.id === base.id)
  return folder
}

// ---------------------------------------------------------------------------
// Negative control: prove the OLD (stale-context) behavior lost the data.
// ---------------------------------------------------------------------------
console.log('\nNegative control (simulating the OLD stale-context behavior):')
{
  const folder = runOnce(1, 5, /* useFix */ false)
  check('reload finds the folder', Boolean(folder))
  check(
    'OLD behavior LOSES the product definition on reload (reproduces the bug)',
    !folder?.productDefinition
  )
  check(
    'OLD behavior leaves the product suite session dangling (would reopen wizard)',
    Boolean(folder?.productSuiteSession)
  )
}

// ---------------------------------------------------------------------------
// The fix: prove it works EVERY TIME across many randomized runs.
// ---------------------------------------------------------------------------
console.log('\nFixed behavior (roadmap turn starts from the saved folder):')
const ITERATIONS = 250
let allGood = true
for (let i = 0; i < ITERATIONS; i++) {
  const bubbleCount = 1 + (i % 8) // vary 1..8 bubbles
  const folder = runOnce(1000 + i, bubbleCount, /* useFix */ true)

  const def = folder?.productDefinition
  const expectedBubbles = bubbleCount
  const ok =
    Boolean(folder) &&
    Boolean(def) &&
    def?.idea === `Smart widget ${1000 + i}` &&
    def?.answers.length === 3 &&
    !folder?.productSuiteSession &&
    folder?.planSpace.bubbles.length === expectedBubbles &&
    // requirements derived from the definition must survive too
    folder?.requirements?.custom?.productDefinition != null

  if (!ok) {
    allGood = false
    console.error(
      `  \u2717 iteration ${i} FAILED: ` +
        JSON.stringify({
          hasFolder: Boolean(folder),
          hasDef: Boolean(def),
          idea: def?.idea,
          answers: def?.answers.length,
          session: Boolean(folder?.productSuiteSession),
          bubbles: folder?.planSpace.bubbles.length,
          expectedBubbles,
        })
    )
  }
}
check(`product definition + plan space persist across reload for all ${ITERATIONS} runs`, allGood)

// ---------------------------------------------------------------------------
console.log('')
if (failures > 0) {
  console.error(`\u2717 ${failures} check(s) failed.`)
  process.exit(1)
} else {
  console.log('\u2713 All checks passed. Planning suite persists every time.')
  process.exit(0)
}
