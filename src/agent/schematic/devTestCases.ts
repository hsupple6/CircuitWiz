import type { AgentProjectContext } from '../types'
import type { ProjectFolder } from '../../types/workspace'
import { getSchematic, updateSchematicInFolder } from '../helpers'
import * as projectOps from '../project/operations'
import * as ops from './operations'
import { SCHEMATIC_LAYOUT_GUIDELINES } from './layoutGuidelines'
import { appendAgentDevLog } from '../../services/agentDevLog'

export interface DevTestRunResult {
  success: boolean
  message: string
  folder?: ProjectFolder
  activeSchematicId?: string
  componentCount?: number
  wireCount?: number
  errors?: string[]
}

/**
 * Runs the switch-controlled LED circuit using the same path as the agent:
 * one schematic_place_component call per part, then schematic_connect_pins per wire.
 */
export function runSwitchControlledLedPlacementTest(
  ctx: AgentProjectContext
): DevTestRunResult {
  appendAgentDevLog({
    type: 'turn_start',
    payload: { devTest: 'switch_controlled_led', mode: 'schematic_place_component' },
  })

  const { folder: folderAfterCreate, schematic } = projectOps.createSchematicInFolder(
    ctx.folder,
    'Dev Test — Switch LED',
    'Automated individual placement test'
  )
  let folder = folderAfterCreate
  const schematicId = schematic.id
  const activeSchematicId = schematicId

  appendAgentDevLog({
    type: 'tool_call',
    toolName: 'project_create_schematic',
    payload: { name: schematic.name },
  })
  appendAgentDevLog({
    type: 'tool_result',
    toolName: 'project_create_schematic',
    payload: { schematicId },
  })

  const { x: ox, y: oy } = SCHEMATIC_LAYOUT_GUIDELINES.placementOrigin
  const errors: string[] = []

  const placements: Array<{
    moduleName: string
    x: number
    y: number
    componentId: string
    properties?: Record<string, unknown>
  }> = [
    {
      moduleName: 'PowerSupply',
      x: ox,
      y: oy,
      componentId: 'ps1',
      properties: { voltage: 5, current: 1 },
    },
    { moduleName: 'Push Button', x: ox + 10, y: oy, componentId: 'btn1' },
    {
      moduleName: 'Resistor',
      x: ox + 20,
      y: oy,
      componentId: 'r1',
      properties: { resistance: 330 },
    },
    { moduleName: 'LED', x: ox + 30, y: oy, componentId: 'led1' },
  ]

  for (const placement of placements) {
    const sch = getSchematic(folder, schematicId)
    if (!sch) {
      errors.push('Schematic missing during placement')
      break
    }

    const input = {
      schematicId,
      moduleName: placement.moduleName,
      x: placement.x,
      y: placement.y,
      componentId: placement.componentId,
      properties: placement.properties,
    }
    appendAgentDevLog({ type: 'tool_call', toolName: 'schematic_place_component', payload: input })

    const result = ops.placeComponent(
      sch,
      placement.moduleName,
      placement.x,
      placement.y,
      placement.properties ?? {},
      placement.componentId
    )
    if ('error' in result) {
      errors.push(`${placement.moduleName}: ${result.error}`)
      appendAgentDevLog({
        type: 'error',
        toolName: 'schematic_place_component',
        payload: result.error,
      })
      continue
    }

    const updated = updateSchematicInFolder(folder, schematicId, () => result.schematic)
    if (!updated) {
      errors.push(`Failed to save after ${placement.moduleName}`)
      continue
    }
    folder = updated
    appendAgentDevLog({
      type: 'tool_result',
      toolName: 'schematic_place_component',
      payload: { componentId: result.componentId },
    })
  }

  const connections = [
    { fromComponentId: 'ps1', fromPin: '5V', toComponentId: 'btn1', toPin: 'IN' },
    { fromComponentId: 'btn1', fromPin: 'OUT', toComponentId: 'r1', toPin: '1' },
    { fromComponentId: 'r1', fromPin: '2', toComponentId: 'led1', toPin: '+' },
    { fromComponentId: 'led1', fromPin: '-', toComponentId: 'ps1', toPin: 'GND' },
  ]

  for (const conn of connections) {
    const sch = getSchematic(folder, schematicId)
    if (!sch) {
      errors.push('Schematic missing during wiring')
      break
    }

    const input = { schematicId, ...conn }
    appendAgentDevLog({ type: 'tool_call', toolName: 'schematic_connect_pins', payload: input })

    const result = ops.connectPins(
      sch,
      conn.fromComponentId,
      conn.fromPin,
      conn.toComponentId,
      conn.toPin
    )
    if ('error' in result) {
      errors.push(
        `${conn.fromComponentId}.${conn.fromPin} → ${conn.toComponentId}.${conn.toPin}: ${result.error}`
      )
      appendAgentDevLog({ type: 'error', toolName: 'schematic_connect_pins', payload: result.error })
      continue
    }

    const updated = updateSchematicInFolder(folder, schematicId, () => result.schematic)
    if (!updated) {
      errors.push(`Failed to save wire ${conn.fromComponentId}→${conn.toComponentId}`)
      continue
    }
    folder = updated
    appendAgentDevLog({
      type: 'tool_result',
      toolName: 'schematic_connect_pins',
      payload: { wireId: result.wire.id },
    })
  }

  const finalSch = getSchematic(folder, schematicId)
  const componentCount = finalSch ? ops.listComponents(finalSch).length : 0
  const wireCount = finalSch ? ops.listWires(finalSch).length : 0
  const success = errors.length === 0 && componentCount === 4 && wireCount === 4
  const message = success
    ? `Switch LED test passed — ${componentCount} components, ${wireCount} wires`
    : `Switch LED test failed — ${componentCount} components, ${wireCount} wires${
        errors.length ? `: ${errors.join('; ')}` : ''
      }`

  appendAgentDevLog({
    type: 'turn_end',
    payload: { devTest: 'switch_controlled_led', success, componentCount, wireCount, errors },
  })

  return {
    success,
    message,
    folder,
    activeSchematicId,
    componentCount,
    wireCount,
    errors: errors.length ? errors : undefined,
  }
}
