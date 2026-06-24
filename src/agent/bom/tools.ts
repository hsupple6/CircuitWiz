import { AgentTool } from '../types'
import { fail, makeTool, ok, okRead, resolveSchematicId } from '../helpers'
import * as ops from './operations'
import { ensureBom } from '../project/operations'

export const bomAgentTools: AgentTool[] = [
  makeTool(
    'bom_get',
    'Get the full bill of materials with line items, quantities, and estimated total cost.',
    'bom',
    [],
    (ctx) => {
      if (!ctx.folder.bom) return okRead(ctx, 'No BOM exists yet.', { bom: null })
      return okRead(ctx, 'BOM retrieved.', { bom: ops.getBomSummary(ctx.folder.bom) })
    }
  ),

  makeTool(
    'bom_ensure',
    'Create an empty BOM if one does not exist.',
    'bom',
    [{ name: 'name', type: 'string', description: 'BOM name', required: false }],
    (ctx, args) => {
      const { folder, bom } = ensureBom(ctx.folder)
      if (args.name) {
        const updated = ops.touchBom({ ...bom, name: args.name as string })
        return ok(ctx, { ...folder, bom: updated }, 'BOM ready.', { bom: ops.getBomSummary(updated) })
      }
      return ok(ctx, folder, 'BOM ready.', { bom: ops.getBomSummary(bom) })
    }
  ),

  makeTool(
    'bom_generate_from_schematic',
    'Auto-generate BOM line items from components placed on a schematic.',
    'bom',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'quantityPerLine', type: 'number', description: 'Quantity multiplier per component instance', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const result = ops.generateBomFromSchematic(
        ctx.folder,
        id,
        (args.quantityPerLine as number) ?? 1
      )
      if ('error' in result) return fail(result.error)
      return ok(ctx, result.folder, `BOM updated with ${result.added} line items.`, {
        bom: ops.getBomSummary(result.bom),
      })
    }
  ),

  makeTool(
    'bom_add_line',
    'Add a BOM line item with part number, quantity, price, and purchase link.',
    'bom',
    [
      { name: 'description', type: 'string', description: 'Part description', required: true },
      { name: 'quantity', type: 'number', description: 'Quantity', required: true },
      { name: 'partNumber', type: 'string', description: 'DigiKey or manufacturer PN', required: false },
      { name: 'manufacturer', type: 'string', description: 'Manufacturer name', required: false },
      { name: 'unitPrice', type: 'number', description: 'Unit price in USD', required: false },
      { name: 'purchaseUrl', type: 'string', description: 'Direct purchase link', required: false },
      { name: 'substitutes', type: 'array', description: 'Alternative part numbers', required: false, items: { name: 'pn', type: 'string', description: 'Part number' } },
      { name: 'notes', type: 'string', description: 'Notes', required: false },
    ],
    (ctx, args) => {
      const result = ops.addBomLine(ctx.folder, {
        description: args.description as string,
        quantity: args.quantity as number,
        partNumber: args.partNumber as string | undefined,
        manufacturer: args.manufacturer as string | undefined,
        unitPrice: args.unitPrice as number | undefined,
        purchaseUrl: args.purchaseUrl as string | undefined,
        substitutes: args.substitutes as string[] | undefined,
        notes: args.notes as string | undefined,
      })
      if ('error' in result) return fail(result.error)
      return ok(ctx, result.folder, 'BOM line added.', { lineItem: result.lineItem })
    }
  ),

  makeTool(
    'bom_update_line',
    'Update any field on an existing BOM line item.',
    'bom',
    [
      { name: 'lineId', type: 'string', description: 'Line item id', required: true },
      { name: 'description', type: 'string', description: 'Description', required: false },
      { name: 'quantity', type: 'number', description: 'Quantity', required: false },
      { name: 'partNumber', type: 'string', description: 'Part number', required: false },
      { name: 'unitPrice', type: 'number', description: 'Unit price', required: false },
      { name: 'purchaseUrl', type: 'string', description: 'Purchase URL', required: false },
      { name: 'substitutes', type: 'array', description: 'Substitutes', required: false, items: { name: 'pn', type: 'string', description: 'Part number' } },
      { name: 'notes', type: 'string', description: 'Notes', required: false },
    ],
    (ctx, args) => {
      const { lineId, ...patch } = args as Record<string, unknown>
      const result = ops.updateBomLine(ctx.folder, lineId as string, patch)
      if (!result.lineItem) return fail(`Line item not found: ${lineId}`)
      return ok(ctx, result.folder, 'BOM line updated.', { lineItem: result.lineItem })
    }
  ),

  makeTool(
    'bom_remove_line',
    'Remove a line item from the BOM.',
    'bom',
    [{ name: 'lineId', type: 'string', description: 'Line item id', required: true }],
    (ctx, args) => {
      if (!ctx.folder.bom?.lineItems.some((l) => l.id === args.lineId)) {
        return fail(`Line item not found: ${args.lineId}`)
      }
      return ok(ctx, ops.removeBomLine(ctx.folder, args.lineId as string), 'BOM line removed.')
    }
  ),

  makeTool(
    'bom_export_csv',
    'Export BOM as CSV text for purchasing.',
    'bom',
    [],
    (ctx) => {
      if (!ctx.folder.bom) return fail('No BOM exists.')
      return okRead(ctx, 'BOM exported.', { csv: ops.exportBomCsv(ctx.folder.bom) })
    }
  ),
]
