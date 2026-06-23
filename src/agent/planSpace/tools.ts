import {
  AgentTool,
  AgentToolParameter,
  AgentToolResult,
} from '../types'
import {
  PLAN_SPACE_COORDINATE_SYSTEM,
  getViewport,
  getBubbleCenter,
  getBubbleRect,
  getBubbleBounds,
  getPlanSpaceContentBounds,
  findBubbleAtPoint,
  worldToScreen,
  screenToWorld,
  viewportToFitBounds,
  getArrowPoints,
} from './coordinates'
import * as ops from './operations'
import { PlanBubbleShape, PlanSpace } from '../../types/workspace'

const BUBBLE_SHAPES: PlanBubbleShape[] = [
  'rounded', 'rectangle', 'ellipse', 'diamond', 'pill', 'card', 'phase',
]

const CURVE_TYPES = ['straight', 'arc', 'elbow'] as const

function ok(message: string, planSpace: PlanSpace, data?: unknown): AgentToolResult {
  return { success: true, message, planSpace, data }
}

function fail(message: string, data?: unknown): AgentToolResult {
  return { success: false, message, data }
}

function pointParam(name: string, description: string): AgentToolParameter {
  return {
    name,
    type: 'object',
    description,
    required: true,
    properties: {
      x: { name: 'x', type: 'number', description: 'World X in pixels', required: true },
      y: { name: 'y', type: 'number', description: 'World Y in pixels', required: true },
    },
  }
}

function tool(
  name: string,
  description: string,
  parameters: AgentToolParameter[],
  execute: AgentTool['execute']
): AgentTool {
  return { name, description, category: 'plan_space', parameters, execute }
}

export const planSpaceAgentTools: AgentTool[] = [
  // ── Coordinate system & viewport ──────────────────────────────────────────
  tool(
    'plan_space_get_coordinate_system',
    'Returns the Plan Space world coordinate system specification (origin, axes, units, zoom limits).',
    [],
    (ctx) =>
      ok('Coordinate system retrieved.', ctx.planSpace, {
        coordinateSystem: PLAN_SPACE_COORDINATE_SYSTEM,
      })
  ),

  tool(
    'plan_space_get_viewport',
    'Get the current viewport (zoom and pan offset) for the plan space.',
    [],
    (ctx) => ok('Viewport retrieved.', ctx.planSpace, { viewport: getViewport(ctx.planSpace) })
  ),

  tool(
    'plan_space_set_viewport',
    'Set viewport zoom and/or pan offset. Zoom is clamped to 0.25–3.',
    [
      { name: 'zoom', type: 'number', description: 'Zoom level (optional)', required: false },
      {
        name: 'offset',
        type: 'object',
        description: 'Pan offset in screen pixels (optional)',
        required: false,
        properties: {
          x: { name: 'x', type: 'number', description: 'Offset X', required: true },
          y: { name: 'y', type: 'number', description: 'Offset Y', required: true },
        },
      },
    ],
    (ctx, args) => {
      const offset = args.offset as { x: number; y: number } | undefined
      const zoom = args.zoom as number | undefined
      const next = ops.setViewport(ctx.planSpace, zoom, offset)
      return ok('Viewport updated.', next, { viewport: getViewport(next) })
    }
  ),

  tool(
    'plan_space_pan_viewport',
    'Pan the viewport by a delta in screen pixels.',
    [
      { name: 'deltaX', type: 'number', description: 'Horizontal pan delta (screen px)', required: true },
      { name: 'deltaY', type: 'number', description: 'Vertical pan delta (screen px)', required: true },
    ],
    (ctx, args) => {
      const next = ops.panViewport(ctx.planSpace, args.deltaX as number, args.deltaY as number)
      return ok('Viewport panned.', next, { viewport: getViewport(next) })
    }
  ),

  tool(
    'plan_space_zoom_to_fit',
    'Adjust viewport zoom and offset to fit all content within the given screen size.',
    [
      { name: 'screenWidth', type: 'number', description: 'Viewport width in screen px', required: true },
      { name: 'screenHeight', type: 'number', description: 'Viewport height in screen px', required: true },
      { name: 'padding', type: 'number', description: 'Padding around content (default 48)', required: false },
    ],
    (ctx, args) => {
      const bounds = getPlanSpaceContentBounds(ctx.planSpace)
      if (!bounds) return fail('No content to fit.')
      const vp = viewportToFitBounds(
        bounds,
        args.screenWidth as number,
        args.screenHeight as number,
        (args.padding as number) ?? 48
      )
      const next = ops.setViewport(ctx.planSpace, vp.zoom, vp.offset)
      return ok('Viewport fitted to content.', next, { viewport: vp, bounds })
    }
  ),

  tool(
    'plan_space_world_to_screen',
    'Convert a world coordinate point to screen coordinates using the current viewport.',
    [pointParam('world', 'World-space point')],
    (ctx, args) => {
      const world = args.world as { x: number; y: number }
      const screen = worldToScreen(world, getViewport(ctx.planSpace))
      return ok('Converted world to screen.', ctx.planSpace, { world, screen })
    }
  ),

  tool(
    'plan_space_screen_to_world',
    'Convert a screen coordinate point to world coordinates using the current viewport.',
    [pointParam('screen', 'Screen-space point relative to viewport element')],
    (ctx, args) => {
      const screen = args.screen as { x: number; y: number }
      const world = screenToWorld(screen, getViewport(ctx.planSpace))
      return ok('Converted screen to world.', ctx.planSpace, { screen, world })
    }
  ),

  tool(
    'plan_space_get_content_bounds',
    'Get the axis-aligned bounding box of all bubbles and arrow points in world coordinates.',
    [],
    (ctx) => {
      const bounds = getPlanSpaceContentBounds(ctx.planSpace)
      return ok(bounds ? 'Bounds calculated.' : 'Plan space is empty.', ctx.planSpace, { bounds })
    }
  ),

  // ── Query / read ───────────────────────────────────────────────────────────
  tool(
    'plan_space_get_state',
    'Get a full summary of the plan space including all bubbles, connections, arrows, and viewport.',
    [],
    (ctx) => ok('Plan space state retrieved.', ctx.planSpace, ops.getPlanSpaceState(ctx.planSpace))
  ),

  tool(
    'plan_space_list_bubbles',
    'List all bubbles with id, text, shape, position, and size.',
    [],
    (ctx) =>
      ok('Bubbles listed.', ctx.planSpace, {
        bubbles: ctx.planSpace.bubbles.map((b) => ({
          id: b.id,
          text: b.text,
          subtitle: b.subtitle,
          shape: b.shape,
          ...getBubbleRect(b),
          center: getBubbleCenter(b),
          color: b.color,
        })),
      })
  ),

  tool(
    'plan_space_get_bubble',
    'Get a single bubble by id.',
    [{ name: 'bubbleId', type: 'string', description: 'Bubble id', required: true }],
    (ctx, args) => {
      const bubble = ctx.planSpace.bubbles.find((b) => b.id === args.bubbleId)
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return ok('Bubble retrieved.', ctx.planSpace, {
        bubble: { ...bubble, center: getBubbleCenter(bubble) },
      })
    }
  ),

  tool(
    'plan_space_find_bubble_at',
    'Find the topmost bubble at a world coordinate point.',
    [
      { name: 'x', type: 'number', description: 'World X', required: true },
      { name: 'y', type: 'number', description: 'World Y', required: true },
    ],
    (ctx, args) => {
      const hit = findBubbleAtPoint(ctx.planSpace.bubbles, {
        x: args.x as number,
        y: args.y as number,
      })
      return ok(hit ? 'Bubble found.' : 'No bubble at point.', ctx.planSpace, { bubble: hit })
    }
  ),

  tool(
    'plan_space_list_connections',
    'List all connections between bubbles.',
    [],
    (ctx) => ok('Connections listed.', ctx.planSpace, { connections: ctx.planSpace.connections })
  ),

  tool(
    'plan_space_get_connection',
    'Get a connection by id.',
    [{ name: 'connectionId', type: 'string', description: 'Connection id', required: true }],
    (ctx, args) => {
      const conn = ctx.planSpace.connections.find((c) => c.id === args.connectionId)
      if (!conn) return fail(`Connection not found: ${args.connectionId}`)
      return ok('Connection retrieved.', ctx.planSpace, { connection: conn })
    }
  ),

  tool(
    'plan_space_list_arrows',
    'List all freeform arrow paths.',
    [],
    (ctx) =>
      ok('Arrows listed.', ctx.planSpace, {
        arrows: ctx.planSpace.arrows.map((a) => ({
          id: a.id,
          points: getArrowPoints(a),
          color: a.color,
          dashed: a.dashed,
        })),
      })
  ),

  tool(
    'plan_space_get_arrow',
    'Get an arrow by id.',
    [{ name: 'arrowId', type: 'string', description: 'Arrow id', required: true }],
    (ctx, args) => {
      const arrow = ctx.planSpace.arrows.find((a) => a.id === args.arrowId)
      if (!arrow) return fail(`Arrow not found: ${args.arrowId}`)
      return ok('Arrow retrieved.', ctx.planSpace, {
        arrow: { ...arrow, points: getArrowPoints(arrow) },
      })
    }
  ),

  // ── Bubbles ──────────────────────────────────────────────────────────────
  tool(
    'plan_space_add_bubble',
    'Add a new text bubble/node at a world position.',
    [
      { name: 'text', type: 'string', description: 'Main label text', required: true },
      { name: 'x', type: 'number', description: 'World X (top-left)', required: true },
      { name: 'y', type: 'number', description: 'World Y (top-left)', required: true },
      { name: 'width', type: 'number', description: 'Width in world px', required: false },
      { name: 'height', type: 'number', description: 'Height in world px', required: false },
      { name: 'shape', type: 'string', description: 'Bubble shape', required: false, enum: [...BUBBLE_SHAPES] },
      { name: 'color', type: 'string', description: 'Background color hex', required: false },
      { name: 'subtitle', type: 'string', description: 'Subtitle text', required: false },
      { name: 'textColor', type: 'string', description: 'Text color hex', required: false },
      { name: 'borderColor', type: 'string', description: 'Border color hex', required: false },
      { name: 'shadow', type: 'boolean', description: 'Drop shadow', required: false },
    ],
    (ctx, args) => {
      const { planSpace, bubble } = ops.addBubble(ctx.planSpace, {
        text: args.text as string,
        x: args.x as number,
        y: args.y as number,
        width: args.width as number | undefined,
        height: args.height as number | undefined,
        shape: args.shape as PlanBubbleShape | undefined,
        color: args.color as string | undefined,
        subtitle: args.subtitle as string | undefined,
        textColor: args.textColor as string | undefined,
        borderColor: args.borderColor as string | undefined,
        shadow: args.shadow as boolean | undefined,
      })
      return ok(`Bubble "${bubble.text}" created.`, planSpace, { bubble })
    }
  ),

  tool(
    'plan_space_update_bubble',
    'Update any properties of an existing bubble.',
    [
      { name: 'bubbleId', type: 'string', description: 'Bubble id', required: true },
      { name: 'text', type: 'string', description: 'Main label', required: false },
      { name: 'subtitle', type: 'string', description: 'Subtitle', required: false },
      { name: 'x', type: 'number', description: 'World X', required: false },
      { name: 'y', type: 'number', description: 'World Y', required: false },
      { name: 'width', type: 'number', description: 'Width', required: false },
      { name: 'height', type: 'number', description: 'Height', required: false },
      { name: 'shape', type: 'string', description: 'Shape', required: false, enum: [...BUBBLE_SHAPES] },
      { name: 'color', type: 'string', description: 'Background color', required: false },
      { name: 'textColor', type: 'string', description: 'Text color', required: false },
      { name: 'borderColor', type: 'string', description: 'Border color', required: false },
      { name: 'shadow', type: 'boolean', description: 'Shadow', required: false },
    ],
    (ctx, args) => {
      const { bubbleId, ...patch } = args as Record<string, unknown>
      const { planSpace, bubble } = ops.updateBubble(ctx.planSpace, bubbleId as string, patch)
      if (!bubble) return fail(`Bubble not found: ${bubbleId}`)
      return ok('Bubble updated.', planSpace, { bubble })
    }
  ),

  tool(
    'plan_space_move_bubble',
    'Move a bubble to a new world position (top-left corner).',
    [
      { name: 'bubbleId', type: 'string', description: 'Bubble id', required: true },
      { name: 'x', type: 'number', description: 'New world X', required: true },
      { name: 'y', type: 'number', description: 'New world Y', required: true },
    ],
    (ctx, args) => {
      const { planSpace, bubble } = ops.moveBubble(
        ctx.planSpace,
        args.bubbleId as string,
        args.x as number,
        args.y as number
      )
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return ok('Bubble moved.', planSpace, { bubble })
    }
  ),

  tool(
    'plan_space_resize_bubble',
    'Resize a bubble.',
    [
      { name: 'bubbleId', type: 'string', description: 'Bubble id', required: true },
      { name: 'width', type: 'number', description: 'New width', required: true },
      { name: 'height', type: 'number', description: 'New height', required: true },
    ],
    (ctx, args) => {
      const { planSpace, bubble } = ops.resizeBubble(
        ctx.planSpace,
        args.bubbleId as string,
        args.width as number,
        args.height as number
      )
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return ok('Bubble resized.', planSpace, { bubble })
    }
  ),

  tool(
    'plan_space_set_bubble_text',
    'Set the main text and optional subtitle of a bubble.',
    [
      { name: 'bubbleId', type: 'string', description: 'Bubble id', required: true },
      { name: 'text', type: 'string', description: 'Main text', required: true },
      { name: 'subtitle', type: 'string', description: 'Subtitle (optional)', required: false },
    ],
    (ctx, args) => {
      const { planSpace, bubble } = ops.updateBubble(ctx.planSpace, args.bubbleId as string, {
        text: args.text as string,
        subtitle: args.subtitle as string | undefined,
      })
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return ok('Bubble text updated.', planSpace, { bubble })
    }
  ),

  tool(
    'plan_space_delete_bubble',
    'Delete a bubble and any connections attached to it.',
    [{ name: 'bubbleId', type: 'string', description: 'Bubble id', required: true }],
    (ctx, args) => {
      const exists = ctx.planSpace.bubbles.some((b) => b.id === args.bubbleId)
      if (!exists) return fail(`Bubble not found: ${args.bubbleId}`)
      const next = ops.deleteBubble(ctx.planSpace, args.bubbleId as string)
      return ok('Bubble deleted.', next)
    }
  ),

  tool(
    'plan_space_duplicate_bubble',
    'Duplicate a bubble with a positional offset.',
    [
      { name: 'bubbleId', type: 'string', description: 'Source bubble id', required: true },
      { name: 'offsetX', type: 'number', description: 'X offset (default 24)', required: false },
      { name: 'offsetY', type: 'number', description: 'Y offset (default 24)', required: false },
    ],
    (ctx, args) => {
      const { planSpace, bubble } = ops.duplicateBubble(
        ctx.planSpace,
        args.bubbleId as string,
        (args.offsetX as number) ?? 24,
        (args.offsetY as number) ?? 24
      )
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return ok('Bubble duplicated.', planSpace, { bubble })
    }
  ),

  // ── Connections ──────────────────────────────────────────────────────────
  tool(
    'plan_space_connect_bubbles',
    'Create a directed connection arrow between two bubbles.',
    [
      { name: 'fromBubbleId', type: 'string', description: 'Source bubble id', required: true },
      { name: 'toBubbleId', type: 'string', description: 'Target bubble id', required: true },
      { name: 'color', type: 'string', description: 'Stroke color hex', required: false },
      { name: 'curve', type: 'string', description: 'Path curve style', required: false, enum: [...CURVE_TYPES] },
      { name: 'dashed', type: 'boolean', description: 'Dashed line', required: false },
    ],
    (ctx, args) => {
      const { planSpace, connection } = ops.connectBubbles(
        ctx.planSpace,
        args.fromBubbleId as string,
        args.toBubbleId as string,
        {
          color: args.color as string | undefined,
          curve: args.curve as 'straight' | 'arc' | 'elbow' | undefined,
          dashed: args.dashed as boolean | undefined,
        }
      )
      if (!connection) return fail('Could not create connection (bubbles missing or duplicate).')
      return ok('Bubbles connected.', planSpace, { connection })
    }
  ),

  tool(
    'plan_space_update_connection',
    'Update connection style (color, curve, dashed).',
    [
      { name: 'connectionId', type: 'string', description: 'Connection id', required: true },
      { name: 'color', type: 'string', description: 'Stroke color', required: false },
      { name: 'curve', type: 'string', description: 'Curve style', required: false, enum: [...CURVE_TYPES] },
      { name: 'dashed', type: 'boolean', description: 'Dashed', required: false },
    ],
    (ctx, args) => {
      const { connectionId, ...patch } = args as Record<string, unknown>
      const { planSpace, connection } = ops.updateConnection(
        ctx.planSpace,
        connectionId as string,
        patch
      )
      if (!connection) return fail(`Connection not found: ${connectionId}`)
      return ok('Connection updated.', planSpace, { connection })
    }
  ),

  tool(
    'plan_space_delete_connection',
    'Delete a bubble-to-bubble connection.',
    [{ name: 'connectionId', type: 'string', description: 'Connection id', required: true }],
    (ctx, args) => {
      const exists = ctx.planSpace.connections.some((c) => c.id === args.connectionId)
      if (!exists) return fail(`Connection not found: ${args.connectionId}`)
      return ok('Connection deleted.', ops.deleteConnection(ctx.planSpace, args.connectionId as string))
    }
  ),

  // ── Arrows ─────────────────────────────────────────────────────────────────
  tool(
    'plan_space_add_arrow',
    'Add a freeform arrow path from an array of world-coordinate points (minimum 2).',
    [
      {
        name: 'points',
        type: 'array',
        description: 'Polyline vertices in world coordinates; arrowhead at last point',
        required: true,
        items: {
          name: 'point',
          type: 'object',
          description: 'A world point',
          properties: {
            x: { name: 'x', type: 'number', description: 'World X', required: true },
            y: { name: 'y', type: 'number', description: 'World Y', required: true },
          },
        },
      },
      { name: 'color', type: 'string', description: 'Stroke color hex', required: false },
      { name: 'dashed', type: 'boolean', description: 'Dashed stroke', required: false },
    ],
    (ctx, args) => {
      const points = args.points as { x: number; y: number }[]
      const { planSpace, arrow } = ops.addArrow(ctx.planSpace, points, {
        color: args.color as string | undefined,
        dashed: args.dashed as boolean | undefined,
      })
      if (!arrow) return fail('Arrow requires at least 2 points.')
      return ok('Arrow added.', planSpace, { arrow })
    }
  ),

  tool(
    'plan_space_update_arrow',
    'Update an arrow path, color, or dashed style.',
    [
      { name: 'arrowId', type: 'string', description: 'Arrow id', required: true },
      {
        name: 'points',
        type: 'array',
        description: 'New polyline points (optional)',
        required: false,
        items: {
          name: 'point',
          type: 'object',
          description: 'World point',
          properties: {
            x: { name: 'x', type: 'number', description: 'World X', required: true },
            y: { name: 'y', type: 'number', description: 'World Y', required: true },
          },
        },
      },
      { name: 'color', type: 'string', description: 'Stroke color', required: false },
      { name: 'dashed', type: 'boolean', description: 'Dashed', required: false },
    ],
    (ctx, args) => {
      const { arrowId, points, color, dashed } = args as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      if (points !== undefined) patch.points = points
      if (color !== undefined) patch.color = color
      if (dashed !== undefined) patch.dashed = dashed
      const { planSpace, arrow } = ops.updateArrow(ctx.planSpace, arrowId as string, patch)
      if (!arrow) return fail(`Arrow not found: ${arrowId}`)
      return ok('Arrow updated.', planSpace, { arrow })
    }
  ),

  tool(
    'plan_space_delete_arrow',
    'Delete a freeform arrow path.',
    [{ name: 'arrowId', type: 'string', description: 'Arrow id', required: true }],
    (ctx, args) => {
      const exists = ctx.planSpace.arrows.some((a) => a.id === args.arrowId)
      if (!exists) return fail(`Arrow not found: ${args.arrowId}`)
      return ok('Arrow deleted.', ops.deleteArrow(ctx.planSpace, args.arrowId as string))
    }
  ),

  // ── Bulk / workspace ───────────────────────────────────────────────────────
  tool(
    'plan_space_delete_items',
    'Delete multiple bubbles, connections, and/or arrows by id in one call.',
    [
      {
        name: 'bubbleIds',
        type: 'array',
        description: 'Bubble ids to delete',
        required: false,
        items: { name: 'id', type: 'string', description: 'Bubble id' },
      },
      {
        name: 'connectionIds',
        type: 'array',
        description: 'Connection ids to delete',
        required: false,
        items: { name: 'id', type: 'string', description: 'Connection id' },
      },
      {
        name: 'arrowIds',
        type: 'array',
        description: 'Arrow ids to delete',
        required: false,
        items: { name: 'id', type: 'string', description: 'Arrow id' },
      },
    ],
    (ctx, args) => {
      const next = ops.deleteByIds(ctx.planSpace, {
        bubbleIds: args.bubbleIds as string[] | undefined,
        connectionIds: args.connectionIds as string[] | undefined,
        arrowIds: args.arrowIds as string[] | undefined,
      })
      return ok('Items deleted.', next)
    }
  ),

  tool(
    'plan_space_clear',
    'Remove all bubbles, connections, and arrows from the plan space.',
    [],
    (ctx) => ok('Plan space cleared.', ops.clearPlanSpace(ctx.planSpace))
  ),

  tool(
    'plan_space_apply_preset',
    'Replace plan space content with the default project roadmap preset.',
    [],
    (ctx) => ok('Preset applied.', ops.applyPlanSpacePreset(ctx.planSpace))
  ),

  tool(
    'plan_space_seed_if_empty',
    'Apply the default preset only if the plan space has no bubbles.',
    [],
    (ctx) => ok('Seed check complete.', ops.seedPlanSpace(ctx.planSpace))
  ),

  tool(
    'plan_space_get_bubble_bounds',
    'Get the combined bounding box of all bubbles in world coordinates.',
    [],
    (ctx) =>
      ok('Bubble bounds calculated.', ctx.planSpace, {
        bounds: getBubbleBounds(ctx.planSpace.bubbles),
      })
  ),
]
