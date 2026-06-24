import { AgentTool } from '../types'
import { fail, makeTool, ok, okRead } from '../helpers'
import { setRequirements } from '../project/operations'
import { ProjectRequirements } from '../../types/workspace'

const ELICITATION_FIELDS: Array<keyof ProjectRequirements> = [
  'useCase',
  'environment',
  'powerRequirements',
  'commsProtocol',
  'displaySize',
  'unitCount',
  'budgetRange',
  'enclosurePreference',
  'notes',
]

export const requirementsAgentTools: AgentTool[] = [
  makeTool(
    'requirements_get',
    'Get structured project requirements captured during elicitation (use case, power, comms, display, budget, etc.).',
    'requirements',
    [],
    (ctx) =>
      okRead(ctx, 'Requirements retrieved.', {
        requirements: ctx.folder.requirements ?? {},
        fields: ELICITATION_FIELDS,
      })
  ),

  makeTool(
    'requirements_set',
    'Set or update structured requirements from elicitation. All fields are optional and fully revisable.',
    'requirements',
    [
      { name: 'useCase', type: 'string', description: 'Use case description', required: false },
      { name: 'environment', type: 'string', description: 'Deployment environment', required: false },
      { name: 'powerRequirements', type: 'string', description: 'Power and battery requirements', required: false },
      { name: 'commsProtocol', type: 'string', description: 'Communications protocol (WiFi, BLE, LoRa, etc.)', required: false },
      { name: 'displaySize', type: 'string', description: 'Display size / type', required: false },
      { name: 'unitCount', type: 'number', description: 'Number of units to build', required: false },
      { name: 'budgetRange', type: 'string', description: 'Budget range per unit or total', required: false },
      { name: 'enclosurePreference', type: 'string', description: 'Enclosure preference', required: false },
      { name: 'notes', type: 'string', description: 'Additional notes', required: false },
    ],
    (ctx, args) => {
      const patch: Partial<ProjectRequirements> = {}
      for (const field of ELICITATION_FIELDS) {
        if (args[field] !== undefined) {
          ;(patch as Record<string, unknown>)[field] = args[field]
        }
      }
      const folder = setRequirements(ctx.folder, patch)
      return ok(ctx, folder, 'Requirements updated.', { requirements: folder.requirements })
    }
  ),

  makeTool(
    'requirements_capture_elicitation',
    'Bulk-capture elicitation quiz answers as structured requirements. Pass all known answers at once.',
    'requirements',
    [
      {
        name: 'answers',
        type: 'object',
        description: 'Key-value map of requirement fields',
        required: true,
        properties: {
          useCase: { name: 'useCase', type: 'string', description: 'Use case', required: false },
          environment: { name: 'environment', type: 'string', description: 'Environment', required: false },
          powerRequirements: { name: 'powerRequirements', type: 'string', description: 'Power reqs', required: false },
          commsProtocol: { name: 'commsProtocol', type: 'string', description: 'Comms', required: false },
          displaySize: { name: 'displaySize', type: 'string', description: 'Display', required: false },
          unitCount: { name: 'unitCount', type: 'number', description: 'Unit count', required: false },
          budgetRange: { name: 'budgetRange', type: 'string', description: 'Budget', required: false },
          enclosurePreference: { name: 'enclosurePreference', type: 'string', description: 'Enclosure', required: false },
          notes: { name: 'notes', type: 'string', description: 'Notes', required: false },
        },
      },
    ],
    (ctx, args) => {
      const answers = args.answers as Partial<ProjectRequirements>
      if (!answers || typeof answers !== 'object') return fail('answers object is required')
      const folder = setRequirements(ctx.folder, answers)
      return ok(ctx, folder, 'Elicitation captured.', { requirements: folder.requirements })
    }
  ),

  makeTool(
    'requirements_clear',
    'Clear all structured requirements.',
    'requirements',
    [],
    (ctx) => ok(ctx, { ...ctx.folder, requirements: undefined }, 'Requirements cleared.')
  ),
]
