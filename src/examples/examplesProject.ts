import { createProjectFolder, createProgram, type ProjectFolder } from '../types/workspace'
import {
  allSimulationTestSchematics,
  simulationTestReferenceDoc,
} from './simulationTestCircuits'
import {
  bldcMotorEscSchematic,
  bldcMotorExampleDoc,
  bldcMotorExampleProgram,
} from './bldcMotorExample'

export const EXAMPLES_FOLDER_ID = 'folder-examples-default'

export function createExamplesProjectFolder(): ProjectFolder {
  const schematics = [...allSimulationTestSchematics(), bldcMotorEscSchematic()]
  return createProjectFolder(
    'Examples',
    'Preset simulation correctness test circuits — voltage dividers, RC, LED, BLDC motor, and more.',
    {
      id: EXAMPLES_FOLDER_ID,
      schematics,
      documents: [simulationTestReferenceDoc(), bldcMotorExampleDoc()],
      programs: [
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
      ],
    }
  )
}

/** Ensure the default Examples folder exists at the front of the project list. */
export function ensureExamplesProject(folders: ProjectFolder[]): ProjectFolder[] {
  const existing = folders.find((f) => f.id === EXAMPLES_FOLDER_ID)
  const rest = folders.filter((f) => f.id !== EXAMPLES_FOLDER_ID)
  if (existing) return [existing, ...rest]
  return [createExamplesProjectFolder(), ...rest]
}

export function hasExamplesProject(folders: ProjectFolder[]): boolean {
  return folders.some((f) => f.id === EXAMPLES_FOLDER_ID)
}
