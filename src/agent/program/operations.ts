import {
  Program,
  ProgramCompilation,
  ProjectFolder,
  Schematic,
  createProgram,
} from '../../types/workspace'
import { getComponent } from '../schematic/operations'
import { compileProgramSketch } from './compile'

export function getProgramSummary(program: Program) {
  return {
    id: program.id,
    name: program.name,
    board: program.board,
    codeLength: program.code.length,
    preview: program.code.slice(0, 500),
    isCompiled: program.compilation?.success === true,
    compiledAt: program.compilation?.compiledAt,
    metadata: program.metadata,
  }
}

export function boardFqbnForModule(moduleName: string): string {
  switch (moduleName.toLowerCase()) {
    case 'arduino uno':
    case 'arduino uno r3':
      return 'arduino:avr:uno'
    case 'esp32':
    case 'esp32-wroom-32 (38-pin)':
      return 'esp32:esp32:esp32'
    default:
      return 'arduino:avr:uno'
  }
}

export function createProgramInFolder(
  folder: ProjectFolder,
  name: string,
  code?: string,
  board?: string
): { folder: ProjectFolder; program: Program } {
  const program = createProgram(name, code, board)
  return {
    folder: {
      ...folder,
      programs: [program, ...folder.programs],
    },
    program,
  }
}

export function updateProgramInFolder(
  folder: ProjectFolder,
  programId: string,
  patch: {
    name?: string
    code?: string
    board?: string
    compilation?: ProgramCompilation | undefined
  }
): { folder: ProjectFolder; program: Program | null } {
  let updated: Program | null = null
  const programs = folder.programs.map((p) => {
    if (p.id !== programId) return p
    const codeChanged = patch.code !== undefined && patch.code !== p.code
    const boardChanged = patch.board !== undefined && patch.board !== p.board
    updated = {
      ...p,
      ...patch,
      compilation:
        patch.compilation !== undefined
          ? patch.compilation
          : codeChanged || boardChanged
            ? undefined
            : p.compilation,
      metadata: { ...p.metadata, updatedAt: new Date().toISOString() },
    }
    return updated
  })
  if (!updated) return { folder, program: null }
  return { folder: { ...folder, programs }, program: updated }
}

export function deleteProgramFromFolder(
  folder: ProjectFolder,
  programId: string
): ProjectFolder {
  return {
    ...folder,
    programs: folder.programs.filter((p) => p.id !== programId),
    schematics: folder.schematics.map((s) => {
      if (!s.programFlashes) return s
      const next = { ...s.programFlashes }
      for (const [componentId, assignment] of Object.entries(next)) {
        if (assignment.programId === programId) delete next[componentId]
      }
      return { ...s, programFlashes: next }
    }),
  }
}

export function getProgram(folder: ProjectFolder, programId: string): Program | undefined {
  return folder.programs.find((p) => p.id === programId)
}

export async function compileProgram(
  folder: ProjectFolder,
  programId: string
): Promise<{ folder: ProjectFolder; program: Program; compilation: ProgramCompilation } | { error: string }> {
  const program = getProgram(folder, programId)
  if (!program) return { error: `Program not found: ${programId}` }

  const compilation = await compileProgramSketch(program.code, program.board)
  const result = updateProgramInFolder(folder, programId, { compilation })
  if (!result.program) return { error: `Program not found: ${programId}` }

  return { folder: result.folder, program: result.program, compilation }
}

export function flashProgramToMicrocontroller(
  folder: ProjectFolder,
  schematicId: string,
  componentId: string,
  programId: string
):
  | { folder: ProjectFolder; schematic: Schematic; program: Program; code: string }
  | { error: string } {
  const program = getProgram(folder, programId)
  if (!program) return { error: `Program not found: ${programId}` }
  if (!program.compilation?.success) {
    return { error: 'Program is not compiled. Call program_compile first and fix any errors.' }
  }

  const schematic = folder.schematics.find((s) => s.id === schematicId)
  if (!schematic) return { error: `Schematic not found: ${schematicId}` }

  const component = getComponent(schematic, componentId)
  if (!component) return { error: `Component not found: ${componentId}` }
  if (component.category !== 'microcontrollers') {
    return {
      error: `"${component.moduleName}" is not a microcontroller. Use schematic_list_components to find MCU component ids.`,
    }
  }

  const now = new Date().toISOString()
  const updatedSchematic: Schematic = {
    ...schematic,
    programFlashes: {
      ...schematic.programFlashes,
      [componentId]: { programId, flashedAt: now },
    },
    metadata: { ...schematic.metadata, updatedAt: now },
  }

  const schematics = folder.schematics.map((s) => (s.id === schematicId ? updatedSchematic : s))
  return {
    folder: { ...folder, schematics },
    schematic: updatedSchematic,
    program,
    code: program.code,
  }
}
