import { AgentTool } from '../types'
import { fail, makeTool, okRead, resolveSchematicId, getSchematic } from '../helpers'
import * as schematicOps from '../schematic/operations'
import { PIPELINE_STAGE_TOOL_CATEGORIES, PIPELINE_STAGES } from '../types'

export const validationAgentTools: AgentTool[] = [
  makeTool(
    'validation_run_simulation',
    'Run full circuit simulation on a schematic (DC analysis, power, continuity).',
    'validation',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const simulation = schematicOps.simulateSchematic(schematic)
      const validation = schematicOps.validateSchematicConnections(schematic)
      return okRead(ctx, 'Validation run complete.', { simulation, validation })
    }
  ),

  makeTool(
    'validation_check_connections',
    'Check all wire connections for electrical compatibility without running simulation.',
    'validation',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Connection check complete.', schematicOps.validateSchematicConnections(schematic))
    }
  ),

  makeTool(
    'validation_project_health',
    'Get a pipeline health summary across all project artifacts (requirements, schematics, BOM, firmware, assembly).',
    'validation',
    [],
    (ctx) => {
      const { folder } = ctx
      const schematicSummaries = folder.schematics.map((s) => ({
        id: s.id,
        name: s.name,
        components: schematicOps.listComponents(s).length,
        wires: s.wires.length,
        hasFirmware: !!s.arduinoProject,
        simulation: schematicOps.simulateSchematic(s).works,
        validation: schematicOps.validateSchematicConnections(s).valid,
      }))

      return okRead(ctx, 'Project health check complete.', {
        requirements: !!folder.requirements && Object.keys(folder.requirements).length > 0,
        planSpaceBubbles: folder.planSpace.bubbles.length,
        schematics: schematicSummaries,
        documents: folder.documents.length,
        bom: folder.bom ? folder.bom.lineItems.length : 0,
        assembly: folder.assembly ? folder.assembly.checklist.length : 0,
        pipelineStages: PIPELINE_STAGES,
      })
    }
  ),

  makeTool(
    'pipeline_list_stages',
    'List pipeline stages and recommended tool categories for each stage (elicitation → assembly).',
    'validation',
    [],
    (_ctx) =>
      okRead(_ctx, 'Pipeline stages listed.', {
        stages: PIPELINE_STAGES.map((stage) => ({
          stage,
          toolCategories: PIPELINE_STAGE_TOOL_CATEGORIES[stage],
        })),
      })
  ),

  makeTool(
    'pipeline_get_tools_for_stage',
    'Get tool category recommendations for a specific pipeline stage.',
    'validation',
    [
      {
        name: 'stage',
        type: 'string',
        description: 'Pipeline stage',
        required: true,
        enum: [...PIPELINE_STAGES],
      },
    ],
    (_ctx, args) => {
      const stage = args.stage as keyof typeof PIPELINE_STAGE_TOOL_CATEGORIES
      return okRead(_ctx, 'Stage tools listed.', {
        stage,
        categories: PIPELINE_STAGE_TOOL_CATEGORIES[stage],
      })
    }
  ),
]
