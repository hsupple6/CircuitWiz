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
import { SCHEMATIC_LAYOUT_GUIDELINES } from './layoutGuidelines'
import { AGENT_WIRE_COLOR_IDS } from '../../utils/pickWireColor'
import { isWireColorId } from '../../theme/colors'

const COMPONENT_PROPERTIES_PARAM = {
  name: 'properties',
  type: 'object' as const,
  description:
    'Module-specific properties. Examples: MOSFET { vth: 2.5, rdsOn: 0.05 }, Resistor { resistance: 1000 }, Capacitor { capacitance: 0.0001 }, Inductor { inductance: 0.001 }, ZenerDiode { zenerVoltage: 5.1 }, ACSource { vrms: 12, frequency: 60, waveform: "sine" }, PowerSupply { voltage: 5, current: 1 }',
  required: false,
}

const WIRE_COLOR_PARAM = {
  name: 'colorId',
  type: 'string' as const,
  description: `Wire palette color. Options: ${AGENT_WIRE_COLOR_IDS.join(', ')}. Auto-assigned from pin type if omitted (red=power, black=ground, distinct colors for signals).`,
  required: false,
}

function parseWireColorArgs(args: Record<string, unknown>) {
  const colorIdRaw = args.colorId as string | undefined
  const colorId = colorIdRaw && isWireColorId(colorIdRaw) ? colorIdRaw : undefined
  return {
    colorId,
    color: args.color as string | undefined,
  }
}

function parseComponentProperties(args: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  if (args.properties && typeof args.properties === 'object' && !Array.isArray(args.properties)) {
    Object.assign(props, args.properties as Record<string, unknown>)
  }
  if (args.resistance != null) props.resistance = args.resistance
  if (args.capacitance != null) props.capacitance = args.capacitance
  return props
}

export const schematicAgentTools: AgentTool[] = [
  makeTool(
    'schematic_get_state',
    'Get schematic summary plus layoutGuidelines. Use list_components / catalog_get_module for exact connectable pin names (e.g. Diode pins A and K).',
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
    'Place a component from the module catalog onto the schematic grid. Supports all modules including MOSFET (pins G/D/S), transistors, semiconductors, passives, and power sources. Use catalog_lookup_components to resolve names, then catalog_get_module for pin names and property keys.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'moduleName', type: 'string', description: 'Module name from catalog (e.g. "MOSFET", "Arduino Uno R3", "LED")', required: true },
      {
        name: 'x',
        type: 'number',
        description: `Grid origin X (start near ${SCHEMATIC_LAYOUT_GUIDELINES.placementOrigin.x}; canvas cannot extend left of 0)`,
        required: true,
      },
      {
        name: 'y',
        type: 'number',
        description: `Grid origin Y (start near ${SCHEMATIC_LAYOUT_GUIDELINES.placementOrigin.y}; canvas cannot extend above 0)`,
        required: true,
      },
      { name: 'componentId', type: 'string', description: 'Optional custom component id', required: false },
      { name: 'resistance', type: 'number', description: 'Resistance in ohms (for Resistor)', required: false },
      { name: 'capacitance', type: 'number', description: 'Capacitance in farads (for Capacitor)', required: false },
      COMPONENT_PROPERTIES_PARAM,
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const props = parseComponentProperties(args)
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
    'Update component properties. Pass a properties object for any module (e.g. MOSFET vth/rdsOn, ACSource vrms/frequency).',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'componentId', type: 'string', description: 'Component id', required: true },
      { name: 'resistance', type: 'number', description: 'Resistance in ohms', required: false },
      { name: 'capacitance', type: 'number', description: 'Capacitance in farads', required: false },
      COMPONENT_PROPERTIES_PARAM,
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const props = parseComponentProperties(args)
      if (Object.keys(props).length === 0) return fail('No properties provided.')
      const result = ops.setComponentProperty(schematic, args.componentId as string, props)
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Component properties updated.')
    }
  ),

  makeTool(
    'schematic_replace_component',
    'Replace an existing component with a different module type at the same position.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'componentId', type: 'string', description: 'Component id to replace', required: true },
      { name: 'moduleName', type: 'string', description: 'New module name', required: true },
      { name: 'resistance', type: 'number', description: 'Resistance (if applicable)', required: false },
      { name: 'capacitance', type: 'number', description: 'Capacitance (if applicable)', required: false },
      COMPONENT_PROPERTIES_PARAM,
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const props = parseComponentProperties(args)
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
    'Wire two component pins by name. Resolves exact terminal grid positions automatically. Use pin names from catalog_get_module or schematic_list_components (Resistor: 1 and 2, not LEAD).',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'fromComponentId', type: 'string', description: 'Source component id', required: true },
      { name: 'fromPin', type: 'string', description: 'Source pin name', required: true },
      { name: 'toComponentId', type: 'string', description: 'Target component id', required: true },
      { name: 'toPin', type: 'string', description: 'Target pin name', required: true },
      WIRE_COLOR_PARAM,
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const wireColor = parseWireColorArgs(args)
      const result = ops.connectPins(
        schematic,
        args.fromComponentId as string,
        args.fromPin as string,
        args.toComponentId as string,
        args.toPin as string,
        wireColor
      )
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      const warning = 'warning' in result ? result.warning : undefined
      return ok(ctx, folder, 'Pins connected.', {
        wireId: result.wire.id,
        colorId: result.wire.colorId,
        warning,
      })
    }
  ),

  makeTool(
    'schematic_add_wire',
    'Add a wire along grid points (Manhattan only). Prefer schematic_connect_pins. Endpoints on components must be connectable pin cells — use absolute x,y from schematic_list_components, never the body/center (e.g. 3-wide passives: origin+0 and origin+2, not origin+1).',
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
      WIRE_COLOR_PARAM,
      { name: 'color', type: 'string', description: 'Legacy wire color hex override', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const result = ops.addWirePath(schematic, args.points as Array<{ x: number; y: number }>, {
        ...parseWireColorArgs(args),
      })
      if ('error' in result) return fail(result.error)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Wire added.', { wireId: result.wire.id, colorId: result.wire.colorId })
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
      { name: 'colorPreset', type: 'string', description: 'Color preset name: Indigo, Blue, Green, Amber, Pink, Purple, Slate', required: false },
      { name: 'color', type: 'string', description: 'Custom fill color (rgba/css)', required: false },
      { name: 'borderColor', type: 'string', description: 'Custom border color', required: false },
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
        args.title as string,
        {
          colorPreset: args.colorPreset as string | undefined,
          color: args.color as string | undefined,
          borderColor: args.borderColor as string | undefined,
        }
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
    'schematic_list_group_boxes',
    'List all group box regions on the schematic with ids, positions, and titles.',
    'schematic',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Group boxes listed.', { groupBoxes: ops.listGroupBoxes(schematic) })
    }
  ),

  makeTool(
    'schematic_update_group_box',
    'Update a group box region title, position, size, or colors.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'groupBoxId', type: 'string', description: 'Group box id', required: true },
      { name: 'x', type: 'number', description: 'New top-left X', required: false },
      { name: 'y', type: 'number', description: 'New top-left Y', required: false },
      { name: 'width', type: 'number', description: 'New width', required: false },
      { name: 'height', type: 'number', description: 'New height', required: false },
      { name: 'title', type: 'string', description: 'New title', required: false },
      { name: 'color', type: 'string', description: 'Fill color', required: false },
      { name: 'borderColor', type: 'string', description: 'Border color', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const patch: Record<string, unknown> = {}
      if (args.x != null) patch.x = args.x
      if (args.y != null) patch.y = args.y
      if (args.width != null) patch.width = args.width
      if (args.height != null) patch.height = args.height
      if (args.title != null) patch.title = args.title
      if (args.color != null) patch.color = args.color
      if (args.borderColor != null) patch.borderColor = args.borderColor
      const result = ops.updateGroupBox(schematic, args.groupBoxId as string, patch)
      if (!result.groupBox) return fail(`Group box not found: ${args.groupBoxId}`)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Group box updated.', { groupBoxId: result.groupBox.id })
    }
  ),

  makeTool(
    'schematic_list_labels',
    'List all cell labels on the schematic grid.',
    'schematic',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false }],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      return okRead(ctx, 'Labels listed.', { labels: ops.listLabels(schematic) })
    }
  ),

  makeTool(
    'schematic_add_label',
    'Add a text label to a grid cell. Use for net names, node annotations, or subsystem markers.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'x', type: 'number', description: 'Grid cell X', required: true },
      { name: 'y', type: 'number', description: 'Grid cell Y', required: true },
      { name: 'text', type: 'string', description: 'Label text', required: true },
      { name: 'labelId', type: 'string', description: 'Optional custom label id', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const result = ops.addLabel(
        schematic,
        args.x as number,
        args.y as number,
        args.text as string,
        args.labelId as string | undefined
      )
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Label added.', { labelId: result.label.id })
    }
  ),

  makeTool(
    'schematic_update_label',
    'Update label text or move it to a different grid cell.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'labelId', type: 'string', description: 'Label id', required: true },
      { name: 'text', type: 'string', description: 'New label text', required: false },
      { name: 'x', type: 'number', description: 'New grid cell X', required: false },
      { name: 'y', type: 'number', description: 'New grid cell Y', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      const patch: Record<string, unknown> = {}
      if (args.text != null) patch.text = args.text
      if (args.x != null) patch.x = args.x
      if (args.y != null) patch.y = args.y
      const result = ops.updateLabel(schematic, args.labelId as string, patch)
      if (!result.label) return fail(`Label not found: ${args.labelId}`)
      const folder = updateSchematicInFolder(ctx.folder, id, () => result.schematic)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Label updated.', { labelId: result.label.id })
    }
  ),

  makeTool(
    'schematic_remove_label',
    'Remove a cell label by id, or by grid position if labelId is omitted.',
    'schematic',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id (optional)', required: false },
      { name: 'labelId', type: 'string', description: 'Label id', required: false },
      { name: 'x', type: 'number', description: 'Grid cell X (used when labelId omitted)', required: false },
      { name: 'y', type: 'number', description: 'Grid cell Y (used when labelId omitted)', required: false },
    ],
    (ctx, args) => {
      const id = resolveSchematicId(ctx, args.schematicId as string)
      if (!id) return fail('No schematic specified.')
      const schematic = getSchematic(ctx.folder, id)
      if (!schematic) return fail(`Schematic not found: ${id}`)
      let updated: ReturnType<typeof ops.removeLabel>
      if (args.labelId) {
        updated = ops.removeLabel(schematic, args.labelId as string)
      } else if (args.x != null && args.y != null) {
        updated = ops.removeLabelAt(schematic, args.x as number, args.y as number)
      } else {
        return fail('Provide labelId or both x and y.')
      }
      const folder = updateSchematicInFolder(ctx.folder, id, () => updated)
      if (!folder) return fail('Failed to save schematic.')
      return ok(ctx, folder, 'Label removed.')
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
