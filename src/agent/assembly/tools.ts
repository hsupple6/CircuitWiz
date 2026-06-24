import { AgentTool } from '../types'
import { fail, makeTool, ok, okRead } from '../helpers'
import { ensureAssembly } from '../project/operations'
import * as ops from './operations'

export const assemblyAgentTools: AgentTool[] = [
  makeTool(
    'assembly_get',
    'Get assembly guide with wiring notes, soldering notes, flash guide, and bring-up checklist.',
    'assembly',
    [],
    (ctx) => {
      if (!ctx.folder.assembly) return okRead(ctx, 'No assembly guide yet.', { assembly: null })
      return okRead(ctx, 'Assembly guide retrieved.', {
        assembly: ops.getAssemblySummary(ctx.folder.assembly),
      })
    }
  ),

  makeTool(
    'assembly_ensure',
    'Create an assembly guide if one does not exist.',
    'assembly',
    [{ name: 'name', type: 'string', description: 'Guide name', required: false }],
    (ctx, args) => {
      const { folder, assembly } = ensureAssembly(ctx.folder)
      const updated = args.name ? ops.touchAssembly({ ...assembly, name: args.name as string }) : assembly
      const next = args.name ? { ...folder, assembly: updated } : folder
      return ok(ctx, next, 'Assembly guide ready.', { assembly: ops.getAssemblySummary(updated) })
    }
  ),

  makeTool(
    'assembly_set_notes',
    'Set wiring, soldering, or firmware flash notes on the assembly guide.',
    'assembly',
    [
      { name: 'wiringNotes', type: 'string', description: 'Wiring / soldering guide', required: false },
      { name: 'solderingNotes', type: 'string', description: 'Soldering-specific notes', required: false },
      { name: 'flashGuide', type: 'string', description: 'Firmware flash instructions', required: false },
      { name: 'name', type: 'string', description: 'Guide name', required: false },
    ],
    (ctx, args) => {
      if (!ctx.folder.assembly) {
        const { folder } = ensureAssembly(ctx.folder)
        ctx = { ...ctx, folder }
      }
      const folder = ops.setAssemblyNotes(ctx.folder, {
        wiringNotes: args.wiringNotes as string | undefined,
        solderingNotes: args.solderingNotes as string | undefined,
        flashGuide: args.flashGuide as string | undefined,
        name: args.name as string | undefined,
      })
      return ok(ctx, folder, 'Assembly notes updated.')
    }
  ),

  makeTool(
    'assembly_add_checklist_item',
    'Add a step to the bring-up and test checklist.',
    'assembly',
    [
      { name: 'title', type: 'string', description: 'Step title', required: true },
      { name: 'description', type: 'string', description: 'Step details', required: false },
    ],
    (ctx, args) => {
      let folder = ctx.folder
      if (!folder.assembly) {
        folder = ensureAssembly(folder).folder
      }
      const result = ops.addChecklistItem(folder, args.title as string, (args.description as string) ?? '')
      if ('error' in result) return fail(result.error)
      return ok(ctx, result.folder, 'Checklist item added.', { item: result.item })
    }
  ),

  makeTool(
    'assembly_update_checklist_item',
    'Update or mark complete a checklist step. All steps are revisable.',
    'assembly',
    [
      { name: 'itemId', type: 'string', description: 'Checklist item id', required: true },
      { name: 'title', type: 'string', description: 'New title', required: false },
      { name: 'description', type: 'string', description: 'New description', required: false },
      { name: 'completed', type: 'boolean', description: 'Mark complete/incomplete', required: false },
    ],
    (ctx, args) => {
      if (!ctx.folder.assembly) return fail('No assembly guide.')
      const { itemId, ...patch } = args as Record<string, unknown>
      const result = ops.updateChecklistItem(ctx.folder, itemId as string, patch)
      if (!result.item) return fail(`Checklist item not found: ${itemId}`)
      return ok(ctx, result.folder, 'Checklist item updated.', { item: result.item })
    }
  ),

  makeTool(
    'assembly_remove_checklist_item',
    'Remove a checklist step.',
    'assembly',
    [{ name: 'itemId', type: 'string', description: 'Item id', required: true }],
    (ctx, args) => {
      if (!ctx.folder.assembly) return fail('No assembly guide.')
      return ok(ctx, ops.removeChecklistItem(ctx.folder, args.itemId as string), 'Checklist item removed.')
    }
  ),
]
