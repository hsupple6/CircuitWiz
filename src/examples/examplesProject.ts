import { createProjectFolder, createProgram, type ProjectFolder, type Schematic } from '../types/workspace'
import {
  allSimulationTestSchematics,
  simulationTestReferenceDoc,
} from './simulationTestCircuits'
import {
  bldcMotorEscSchematic,
  bldcMotorExampleDoc,
  bldcMotorExampleProgram,
} from './bldcMotorExample'
import {
  mosfetBoostExampleDoc,
  mosfetBoostExampleProgram,
  mosfetBoostSchematic,
} from './mosfetBoostExample'
import { lm317PotSchematic } from './lm317PotExample'
import { npnSwitchLedSchematic } from './npnSwitchLedExample'
import {
  applyExamplesPresetIds,
  dedupeWorkspaceItemsByName,
  EXAMPLE_DOCUMENT_IDS,
  EXAMPLE_PROGRAM_IDS,
  EXAMPLE_SCHEMATIC_IDS,
} from './examplesPresetIds'

export const EXAMPLES_FOLDER_ID = 'folder-examples-default'

export function createExamplesProjectFolder(): ProjectFolder {
  const schematics = applyExamplesPresetIds(
    [
      ...allSimulationTestSchematics(),
      bldcMotorEscSchematic(),
      mosfetBoostSchematic(),
      lm317PotSchematic(),
      npnSwitchLedSchematic(),
    ],
    EXAMPLE_SCHEMATIC_IDS
  )
  const documents = applyExamplesPresetIds(
    [simulationTestReferenceDoc(), bldcMotorExampleDoc(), mosfetBoostExampleDoc()],
    EXAMPLE_DOCUMENT_IDS
  )
  const programs = applyExamplesPresetIds(
    [
      createProgram(
        'LED Blink',
        `void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}`,
        'arduino:avr:uno'
      ),
      bldcMotorExampleProgram(),
      mosfetBoostExampleProgram(),
    ],
    EXAMPLE_PROGRAM_IDS
  )

  return createProjectFolder(
    'Examples',
    'Preset simulation test circuits — voltage dividers, RC, LED, NPN switch + LED, LM317 regulator, BLDC motor, MOSFET boost, and more.',
    {
      id: EXAMPLES_FOLDER_ID,
      schematics,
      documents,
      programs,
    }
  )
}

function mergePresetItems<T extends { id: string; name: string }>(
  existing: T[],
  fresh: T[],
  stableIds: Record<string, string>
): T[] {
  const deduped = dedupeWorkspaceItemsByName(existing)
  const names = new Set(deduped.map((item) => item.name))
  const merged = [...deduped]

  for (const item of fresh) {
    if (names.has(item.name)) continue
    merged.push(applyExamplesPresetIds([item], stableIds)[0])
    names.add(item.name)
  }

  return applyExamplesPresetIds(merged, stableIds)
}

const PRESET_SCHEMATIC_IDS = new Set(Object.values(EXAMPLE_SCHEMATIC_IDS))

/** Refresh auto-fit group regions on preset example schematics. */
function refreshPresetSchematicLayouts(existing: Schematic[], fresh: Schematic[]): Schematic[] {
  const freshByName = new Map(fresh.map((schematic) => [schematic.name, schematic]))
  return existing.map((schematic) => {
    if (!PRESET_SCHEMATIC_IDS.has(schematic.id)) return schematic
    const updated = freshByName.get(schematic.name)
    if (!updated?.groupBoxes?.length) return schematic
    return { ...schematic, groupBoxes: updated.groupBoxes }
  })
}

/** Merge any missing preset schematics/docs/programs into an existing Examples folder. */
function mergeExamplesFolder(existing: ProjectFolder): ProjectFolder {
  const fresh = createExamplesProjectFolder()
  const mergedSchematics = mergePresetItems(
    existing.schematics,
    fresh.schematics,
    EXAMPLE_SCHEMATIC_IDS
  )

  return {
    ...existing,
    description: fresh.description,
    schematics: refreshPresetSchematicLayouts(mergedSchematics, fresh.schematics),
    documents: mergePresetItems(existing.documents, fresh.documents, EXAMPLE_DOCUMENT_IDS),
    programs: mergePresetItems(existing.programs, fresh.programs, EXAMPLE_PROGRAM_IDS),
  }
}

/** Ensure the default Examples folder exists at the front of the project list. */
export function ensureExamplesProject(folders: ProjectFolder[]): ProjectFolder[] {
  const existing = folders.find((f) => f.id === EXAMPLES_FOLDER_ID)
  const rest = folders.filter((f) => f.id !== EXAMPLES_FOLDER_ID)
  if (existing) return [mergeExamplesFolder(existing), ...rest]
  return [createExamplesProjectFolder(), ...rest]
}

export function hasExamplesProject(folders: ProjectFolder[]): boolean {
  return folders.some((f) => f.id === EXAMPLES_FOLDER_ID)
}
