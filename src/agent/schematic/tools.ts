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

export const schematicAgentTools: AgentTool[] = [
  makeTool(
    'schematic_get_state',
    'Get schematic summary: components, wires, group boxes, firmware status.',
    'schematic',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Schematic state retrieved.', ops.getSchematicState(schematic))
    }
  ),

  makeTool(
    'schematic_list_components',
    'List all placed components with ids, module names, origins, and pin positions.',
    'schematic',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Components listed.', { components: ops.listComponents(schematic) })
    }
  ),

  makeTool(
    'schematic_get_component',
    'Get details for a single component by id.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'componentId', type: 'string', description: 'Component id', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const component = ops.getComponent(schematic, args.componentId as string)
      if (!component) return fail(`Component not found: ${args.componentId}`)
      return okRead(ctx, 'Component retrieved.', { component })
    }
  ),

  makeTool(
    'schematic_place_component',
    'Place a component from the module catalog onto the schematic grid. Nothing is locked — components can always be added or replaced.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'moduleName', type: 'string', description: 'Module name from catalog (e.g. "Arduino Uno R3", "LED")', required: true },
      { name: 'x', type: 'number', description: 'Grid origin X', required: true },
      { name: 'y', type: 'number', description: 'Grid origin Y', required: true },
      { name: 'componentId', type: 'string', description: 'Optional custom component id', required: false },
      { name: 'resistance', type: 'number', description: 'Resistance in ohms (for Resistor)', required: false },
      { name: 'capacitance', type: 'number', description: 'Capacitance in µF (for Capacitor)', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const props: Record<string, unknown> = {}
      if (args.resistance != null) props.resistance = args.resistance
      if (args.capacitance != null) props.capacitance = args.capacitance
      const result = ops.placeComponent(
        schematic,
        args.moduleName as string,
        args.x as number,
        args.y as number,
        props,
        args.componentId as string | undefined
      )
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, `Placed ${args.moduleName}.`, { componentId: result.componentId })
    }
  ),

  makeTool(
    'schematic_remove_component',
    'Remove a component and its attached wires from the schematic.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'componentId', type: 'string', description: 'Component id to remove', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      if (!ops.getComponent(schematic, args.componentId as string)) {
        return fail(`Component not found: ${args.componentId}`)
      }
      const updated = ops.removeComponent(schematic, args.componentId as string)
      const folder = updateSchematicInFolder(ctx.folder, id, () => updated)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Component removed.')
    }
  ),

  makeTool(
    'schematic_move_component',
    'Move a component to a new grid origin. Connected wires move with it.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'componentId', type: 'string', description: 'Component id', required: true },
      { name: 'x', type: 'number', description: 'New origin X', required: true },
      { name: 'y', type: 'number', description: 'New origin Y', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const result = ops.moveComponent(schematic, args.componentId as string, args.x as number, args.y as number)
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Component moved.')
    }
  ),

  makeTool(
    'schematic_set_component_property',
    'Update component properties (resistance, capacitance, or module-specific params).',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'componentId', type: 'string', description: 'Component id', required: true },
      { name: 'resistance', type: 'number', description: 'Resistance in ohms', required: false },
      { name: 'capacitance', type: 'number', description: 'Capacitance in µF', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const props: Record<string, unknown> = {}
      if (args.resistance != null) props.resistance = args.resistance
      if (args.capacitance != null) props.capacitance = args.capacitance
      const result = ops.setComponentProperty(schematic, args.componentId as string, props)
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Component properties updated.')
    }
  ),

  makeTool(
    'schematic_replace_component',
    'Replace an existing component with a different module type at the same position. Fully revisable — swap any component.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'componentId', type: 'string', description: 'Component id to replace', required: true },
      { name: 'moduleName', type: 'string', description: 'New module name', required: true },
      { name: 'resistance', type: 'number', description: 'Resistance (if applicable)', required: false },
      { name: 'capacitance', type: 'number', description: 'Capacitance (if applicable)', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const props: Record<string, unknown> = {}
      if (args.resistance != null) props.resistance = args.resistance
      if (args.capacitance != null) props.capacitance = args.capacitance
      const result = ops.replaceComponent(
        schematic,
        args.componentId as string,
        args.moduleName as string,
        props
      )
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, `Component replaced with ${args.moduleName}.`, { componentId: result.componentId })
    }
  ),

  makeTool(
    'schematic_list_wires',
    'List all wires on the schematic.',
    'schematic',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Wires listed.', { wires: ops.listWires(schematic) })
    }
  ),

  makeTool(
    'schematic_connect_pins',
    'Wire two component pins together with validation.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'fromComponentId', type: 'string', description: 'Source component id', required: true },
      { name: 'fromPin', type: 'string', description: 'Source pin name', required: true },
      { name: 'toComponentId', type: 'string', description: 'Target component id', required: true },
      { name: 'toPin', type: 'string', description: 'Target pin name', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const result = ops.connectPins(
        schematic,
        args.fromComponentId as string,
        args.fromPin as string,
        args.toComponentId as string,
        args.toPin as string
      )
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      const warning = 'warning' in result ? result.warning : undefined
      return ok(ctx, folder, 'Pins connected.', { wireId: result.wire.id, warning })
    }
  ),

  makeTool(
    'schematic_add_wire',
    'Add a wire along a path of grid points.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      {
        name: 'points',
        type: 'array',
        description: 'Grid points along the wire path',
        required: true,
        items: {
          name: 'point',
          type: 'object',
          description: 'Grid point',
          properties: {
            x: { name: 'x', type: 'number', description: 'Grid X', required: true },
            y: { name: 'y', type: 'number', description: 'Grid Y', required: true },
          },
        },
      },
      { name: 'color', type: 'string', description: 'Wire color hex', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const result = ops.addWirePath(schematic, args.points as Array<{ x: number; y: number }>, {
        color: args.color as string | undefined,
      })
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Wire added.', { wireId: result.wire.id })
    }
  ),

  makeTool(
    'schematic_remove_wire',
    'Remove a wire by id.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'wireId', type: 'string', description: 'Wire id', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const updated = ops.removeWire(schematic, args.wireId as string)
      const folder = updateSchematicInFolder(ctx.folder, id, () => updated)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Wire removed.')
    }
  ),

  makeTool(
    'schematic_add_group_box',
    'Add a labeled region box to organize subsystems on the schematic canvas.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'x', type: 'number', description: 'Top-left X', required: true },
      { name: 'y', type: 'number', description: 'Top-left Y', required: true },
      { name: 'width', type: 'number', description: 'Width', required: true },
      { name: 'height', type: 'number', description: 'Height', required: true },
      { name: 'title', type: 'string', description: 'Region title', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const result = ops.addGroupBox(
        schematic,
        args.x as number,
        args.y as number,
        args.width as number,
        args.height as number,
        args.title as string
      )
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Group box added.', { groupBoxId: result.groupBox.id })
    }
  ),

  makeTool(
    'schematic_remove_group_box',
    'Remove a group box region from the schematic.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'groupBoxId', type: 'string', description: 'Group box id', required: true },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const updated = ops.removeGroupBox(schematic, args.groupBoxId as string)
      const folder = updateSchematicInFolder(ctx.folder, id, () => updated)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Group box removed.')
    }
  ),

  makeTool(
    'schematic_validate',
    'Validate all wire connections for electrical compatibility and short circuits.',
    'schematic',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Validation complete.', ops.validateSchematicConnections(schematic))
    }
  ),

  makeTool(
    'schematic_simulate',
    'Run DC circuit simulation (MNA solver) on the schematic.',
    'schematic',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Simulation complete.', ops.simulateSchematic(schematic))
    }
  ),
]
