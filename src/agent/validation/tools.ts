import { AgentTool } from '../types'
import { fail, makeTool, okRead, resolveSchematicId, getSchematic } from '../helpers'
import * as schematicOps from '../schematic/operations'

export const validationAgentTools: AgentTool[] = [
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
        hasProgramFlashes: !!s.programFlashes && Object.keys(s.programFlashes).length > 0,
        simulation: schematicOps.simulateSchematic(s).works,
        validation: schematicOps.validateSchematicConnections(s).valid,
      }))

      return okRead(ctx, 'Project health check complete.', {
        requirements: !!folder.requirements && Object.keys(folder.requirements).length > 0,
        planSpaceBubbles: folder.planSpace.bubbles.length,
        schematics: schematicSummaries,
        documents: folder.documents.length,
        programs: folder.programs.length,
        bom: folder.bom ? folder.bom.lineItems.length : 0,
        assembly: folder.assembly ? folder.assembly.checklist.length : 0,
      })
    }
  ),
]
