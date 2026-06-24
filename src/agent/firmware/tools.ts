import { AgentTool } from '../types'
import {
  fail,
  makeTool,
  ok,
  okRead,
  resolveSchematicId,
  getSchematic,
  updateSchematicInFolder,
} from '../helpers'
import * as ops from './operations'

export const firmwareAgentTools: AgentTool[] = [
  makeTool(
    'firmware_get_state',
    'Get firmware project state: files, board, libraries.',
    'firmware',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Firmware state retrieved.', ops.getFirmwareState(schematic))
    }
  ),

  makeTool(
    'firmware_ensure',
    'Create a firmware project on a schematic if one does not exist.',
    'firmware',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'name', type: 'string', description: 'Project name', required: false },
      { name: 'board', type: 'string', description: 'Arduino board FQBN (default arduino:avr:uno)', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const updated = ops.ensureFirmwareProject(
        schematic,
        args.name as string | undefined,
        (args.board as string) ?? 'arduino:avr:uno'
      )
      const folder = updateSchematicInFolder(ctx.folder, id, () => updated)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Firmware project ready.', ops.getFirmwareState(updated))
    }
  ),

  makeTool(
    'firmware_set_file',
    'Create or replace a firmware source file. Fully revisable — overwrite any file content.',
    'firmware',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'fileName', type: 'string', description: 'File name (e.g. main.ino)', required: true },
      { name: 'content', type: 'string', description: 'Full file content', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const withProject = ops.ensureFirmwareProject(schematic)
      const result = ops.setFirmwareFile(withProject, args.fileName as string, args.content as string)
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, `File "${args.fileName}" saved.`)
    }
  ),

  makeTool(
    'firmware_get_file',
    'Get full content of a firmware source file.',
    'firmware',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'fileName', type: 'string', description: 'File name', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const file = schematic.arduinoProject?.files.find((f) => f.name === args.fileName)
      if (!file) return fail(`File not found: ${args.fileName}`)
      return okRead(ctx, 'File retrieved.', { file })
    }
  ),

  makeTool(
    'firmware_delete_file',
    'Delete a firmware source file (cannot delete the only main .ino).',
    'firmware',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'fileName', type: 'string', description: 'File name', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const result = ops.deleteFirmwareFile(schematic, args.fileName as string)
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, `File "${args.fileName}" deleted.`)
    }
  ),

  makeTool(
    'firmware_set_board',
    'Set the target board FQBN for compilation.',
    'firmware',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'board', type: 'string', description: 'Board FQBN', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const updated = ops.setFirmwareBoard(
        ops.ensureFirmwareProject(schematic),
        args.board as string
      )
      const folder = updateSchematicInFolder(ctx.folder, id, () => updated)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Board set.', { board: args.board })
    }
  ),

  makeTool(
    'firmware_set_libraries',
    'Set the list of Arduino libraries required by the firmware.',
    'firmware',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      {
        name: 'libraries',
        type: 'array',
        description: 'Library names',
        required: true,
        items: { name: 'lib', type: 'string', description: 'Library name' },
      },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const updated = ops.setFirmwareLibraries(
        ops.ensureFirmwareProject(schematic),
        args.libraries as string[]
      )
      const folder = updateSchematicInFolder(ctx.folder, id, () => updated)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Libraries updated.', { libraries: args.libraries })
    }
  ),

  makeTool(
    'firmware_suggest_pin_map',
    'Suggest GPIO pin assignments based on schematic MCU and peripheral placement.',
    'firmware',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Pin map suggested.', ops.suggestPinMap(schematic))
    }
  ),
]
