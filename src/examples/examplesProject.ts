import { createProjectFolder, type ProjectFolder } from '../types/workspace'
import {
  allSimulationTestSchematics,
  simulationTestReferenceDoc,
} from './simulationTestCircuits'

export const EXAMPLES_FOLDER_ID = 'folder-examples-default'

export function createExamplesProjectFolder(): ProjectFolder {
  const schematics = allSimulationTestSchematics()
  return createProjectFolder(
    'Examples',
    'Preset simulation correctness test circuits — voltage dividers, RC, LED, and more.',
    {
      id: EXAMPLES_FOLDER_ID,
      schematics,
      documents: [simulationTestReferenceDoc()],
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
