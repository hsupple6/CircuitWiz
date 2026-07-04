import { AgentTool } from '../types'
import {
  fail,
  makeTool,
  ok,
  okRead,
  resolveProgramId,
  resolveSchematicId,
  touchFolder,
} from '../helpers'
import { updateProgramInFolder as updateProgramInFolderWithTouch } from '../project/operations'
import * as ops from './operations'

export const programAgentTools: AgentTool[] = [
  makeTool(
    'program_get',
    'Get full content of a program artifact by id or the active program.',
    'program',
    [{ name: 'programId', type: 'string', description: 'Program id (optional — uses active)', required: false }],
    (ctx, args) => {
      const id = resolveProgramId(ctx, args.programId as string)
      if (!id) return fail('No program specified.')
      const program = ops.getProgram(ctx.folder, id)
      if (!program) return fail(`Program not found: ${id}`)
      return okRead(ctx, 'Program retrieved.', { program })
    }
  ),

  makeTool(
    'program_set_code',
    'Replace the entire sketch source for a program. Fully overwrites existing code and clears any prior compilation.',
    'program',
    [
      { name: 'programId', type: 'string', description: 'Program id (optional)', required: false },
      { name: 'code', type: 'string', description: 'Full Arduino sketch source', required: true },
      { name: 'name', type: 'string', description: 'Rename program (optional)', required: false },
    ],
    (ctx, args) => {
      const id = resolveProgramId(ctx, args.programId as string)
      if (!id) return fail('No program specified.')
      const { folder, program } = updateProgramInFolderWithTouch(ctx.folder, id, {
        code: args.code as string,
        name: args.name as string | undefined,
      })
      if (!program) return fail(`Program not found: ${id}`)
      return ok(ctx, folder, 'Program code updated.', {
        program: { id: program.id, name: program.name, codeLength: program.code.length },
      })
    }
  ),

  makeTool(
    'program_set_board',
    'Set the target board FQBN for compilation (e.g. arduino:avr:uno, esp32:esp32:esp32). Clears prior compilation.',
    'program',
    [
      { name: 'programId', type: 'string', description: 'Program id (optional)', required: false },
      { name: 'board', type: 'string', description: 'Board FQBN', required: true },
    ],
    (ctx, args) => {
      const id = resolveProgramId(ctx, args.programId as string)
      if (!id) return fail('No program specified.')
      const { folder, program } = updateProgramInFolderWithTouch(ctx.folder, id, {
        board: args.board as string,
      })
      if (!program) return fail(`Program not found: ${id}`)
      return ok(ctx, folder, 'Board updated.', { program: { id: program.id, board: program.board } })
    }
  ),

  makeTool(
    'program_compile',
    'Compile a program via Arduino CLI. Waits for the result — do not call program_flash until this succeeds.',
    'program',
    [{ name: 'programId', type: 'string', description: 'Program id (optional)', required: false }],
    async (ctx, args) => {
      const id = resolveProgramId(ctx, args.programId as string)
      if (!id) return fail('No program specified.')

      const result = await ops.compileProgram(ctx.folder, id)
      if ('error' in result) return fail(result.error)

      const folder = touchFolder(result.folder)
      if (!result.compilation.success) {
        return {
          success: false,
          message: 'Compilation failed. Fix errors and call program_compile again.',
          folder,
          planSpace: folder.planSpace,
          data: {
            programId: id,
            compilation: result.compilation,
            errors: result.compilation.errors ?? [],
          },
        }
      }

      return ok(ctx, folder, 'Compilation succeeded.', {
        programId: id,
        compilation: {
          success: true,
          compiledAt: result.compilation.compiledAt,
          output: result.compilation.output,
          size: result.compilation.size,
        },
      })
    }
  ),

  makeTool(
    'program_flash',
    'Flash a compiled program onto a digital microcontroller on the schematic and start GPIO simulation. Requires a successful program_compile first.',
    'program',
    [
      { name: 'programId', type: 'string', description: 'Program id (optional)', required: false },
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      {
        name: 'componentId',
        type: 'string',
        description: 'Microcontroller component id from schematic_list_components',
        required: true,
      },
    ],
    (ctx, args) => {
      const programId = resolveProgramId(ctx, args.programId as string)
      if (!programId) return fail('No program specified.')
      const schematicId = resolveSchematicId(ctx, args.schematicId as string)
      if (!schematicId) return fail('No schematic specified.')
      const componentId = args.componentId as string

      const result = ops.flashProgramToMicrocontroller(
        ctx.folder,
        schematicId,
        componentId,
        programId
      )
      if ('error' in result) return fail(result.error)

      const folder = touchFolder(result.folder)
      const component = result.schematic.programFlashes?.[componentId]
      return ok(
        ctx,
        folder,
        `Program "${result.program.name}" flashed to ${componentId}. Simulation started.`,
        {
          programId,
          schematicId,
          componentId,
          flashedAt: component?.flashedAt,
        },
        {
          activeSchematicId: schematicId,
          uiAction: {
            type: 'flash_program',
            schematicId,
            componentId,
            code: result.code,
          },
        }
      )
    }
  ),
]
