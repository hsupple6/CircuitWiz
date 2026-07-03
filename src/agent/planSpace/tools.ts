import {
  AgentTool,
  AgentToolParameter,
} from '../types'
import {
  getViewport,
  getBubbleCenter,
  getBubbleRect,
  getBubbleBounds,
  getPlanSpaceContentBounds,
  getArrowPoints,
  viewportToFitBounds,
} from './coordinates'
import * as ops from './operations'
import { PlanBubbleShape } from '../../types/workspace'
import { fail, getPlanSpace, makeTool, okPlanSpace, okRead } from '../helpers'

const BUBBLE_SHAPES: PlanBubbleShape[] = [
  'rounded', 'rectangle', 'ellipse', 'diamond', 'pill', 'card', 'phase',
]

const CURVE_TYPES = ['straight', 'arc', 'elbow'] as const
const STAGE_STATUSES = ['pending', 'in_progress', 'complete'] as const
const PIPELINE_STAGE_ENUM = [
  'elicitation', 'system_design', 'schematic', 'code_architecture', 'bom', 'assembly',
] as const

function tool(
  name: string,
  description: string,
  parameters: AgentToolParameter[],
  execute: AgentTool['execute']
): AgentTool {
  return makeTool(name, description, 'plan_space', parameters, execute)
}

export const planSpaceAgentTools: AgentTool[] = [
  // ── Viewport ───────────────────────────────────────────────────────────────
  tool(
    'plan_space_get_viewport',
    'Get the current viewport (zoom and pan offset) for the plan space.',
    [],
    (ctx) => okRead(ctx, 'Viewport retrieved.', { viewport: getViewport(getPlanSpace(ctx)) })
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
      const next = ops.setViewport(getPlanSpace(ctx), zoom, offset)
      return okPlanSpace(ctx, next, 'Viewport updated.', { viewport: getViewport(next) })
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
      const next = ops.panViewport(getPlanSpace(ctx), args.deltaX as number, args.deltaY as number)
      return okPlanSpace(ctx, next, 'Viewport panned.', { viewport: getViewport(next) })
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
      const bounds = getPlanSpaceContentBounds(getPlanSpace(ctx))
      if (!bounds) return fail('No content to fit.')
      const vp = viewportToFitBounds(
        bounds,
        args.screenWidth as number,
        args.screenHeight as number,
        (args.padding as number) ?? 48
      )
      const next = ops.setViewport(getPlanSpace(ctx), vp.zoom, vp.offset)
      return okPlanSpace(ctx, next, 'Viewport fitted to content.', { viewport: vp, bounds })
    }
  ),

  tool(
    'plan_space_get_content_bounds',
    'Get the axis-aligned bounding box of all bubbles and arrow points in world coordinates.',
    [],
    (ctx) => {
      const bounds = getPlanSpaceContentBounds(getPlanSpace(ctx))
      return okRead(ctx, bounds ? 'Bounds calculated.' : 'Plan space is empty.', { bounds })
    }
  ),

  // ── Query / read ───────────────────────────────────────────────────────────
  tool(
    'plan_space_get_state',
    'Get a full summary of the plan space including all bubbles, connections, arrows, and viewport.',
    [],
    (ctx) => okRead(ctx, 'Plan space state retrieved.', ops.getPlanSpaceState(getPlanSpace(ctx)))
  ),

  tool(
    'plan_space_list_bubbles',
    'List all bubbles with id, text, shape, position, and size.',
    [],
    (ctx) =>
      okRead(ctx, 'Bubbles listed.', {
        bubbles: getPlanSpace(ctx).bubbles.map((b) => ({
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
      const bubble = getPlanSpace(ctx).bubbles.find((b) => b.id === args.bubbleId)
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return okRead(ctx, 'Bubble retrieved.', {
        bubble: { ...bubble, center: getBubbleCenter(bubble) },
      })
    }
  ),

  tool(
    'plan_space_list_connections',
    'List all connections between bubbles.',
    [],
    (ctx) => okRead(ctx, 'Connections listed.', { connections: getPlanSpace(ctx).connections })
  ),

  tool(
    'plan_space_get_connection',
    'Get a connection by id.',
    [{ name: 'connectionId', type: 'string', description: 'Connection id', required: true }],
    (ctx, args) => {
      const conn = getPlanSpace(ctx).connections.find((c) => c.id === args.connectionId)
      if (!conn) return fail(`Connection not found: ${args.connectionId}`)
      return okRead(ctx, 'Connection retrieved.', { connection: conn })
    }
  ),

  tool(
    'plan_space_list_arrows',
    'List all freeform arrow paths.',
    [],
    (ctx) =>
      okRead(ctx, 'Arrows listed.', {
        arrows: getPlanSpace(ctx).arrows.map((a) => ({
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
      const arrow = getPlanSpace(ctx).arrows.find((a) => a.id === args.arrowId)
      if (!arrow) return fail(`Arrow not found: ${args.arrowId}`)
      return okRead(ctx, 'Arrow retrieved.', {
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
      const { planSpace, bubble } = ops.addBubble(getPlanSpace(ctx), {
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
      return okPlanSpace(ctx, planSpace, `Bubble "${bubble.text}" created.`, { bubble })
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
      const { planSpace, bubble } = ops.updateBubble(getPlanSpace(ctx), bubbleId as string, patch)
      if (!bubble) return fail(`Bubble not found: ${bubbleId}`)
      return okPlanSpace(ctx, planSpace, 'Bubble updated.', { bubble })
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
        getPlanSpace(ctx),
        args.bubbleId as string,
        args.x as number,
        args.y as number
      )
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return okPlanSpace(ctx, planSpace, 'Bubble moved.', { bubble })
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
        getPlanSpace(ctx),
        args.bubbleId as string,
        args.width as number,
        args.height as number
      )
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return okPlanSpace(ctx, planSpace, 'Bubble resized.', { bubble })
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
      const { planSpace, bubble } = ops.updateBubble(getPlanSpace(ctx), args.bubbleId as string, {
        text: args.text as string,
        subtitle: args.subtitle as string | undefined,
      })
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return okPlanSpace(ctx, planSpace, 'Bubble text updated.', { bubble })
    }
  ),

  tool(
    'plan_space_delete_bubble',
    'Delete a bubble and any connections attached to it.',
    [{ name: 'bubbleId', type: 'string', description: 'Bubble id', required: true }],
    (ctx, args) => {
      const exists = getPlanSpace(ctx).bubbles.some((b) => b.id === args.bubbleId)
      if (!exists) return fail(`Bubble not found: ${args.bubbleId}`)
      const next = ops.deleteBubble(getPlanSpace(ctx), args.bubbleId as string)
      return okPlanSpace(ctx, next, 'Bubble deleted.')
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
        getPlanSpace(ctx),
        args.bubbleId as string,
        (args.offsetX as number) ?? 24,
        (args.offsetY as number) ?? 24
      )
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return okPlanSpace(ctx, planSpace, 'Bubble duplicated.', { bubble })
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
        getPlanSpace(ctx),
        args.fromBubbleId as string,
        args.toBubbleId as string,
        {
          color: args.color as string | undefined,
          curve: args.curve as 'straight' | 'arc' | 'elbow' | undefined,
          dashed: args.dashed as boolean | undefined,
        }
      )
      if (!connection) return fail('Could not create connection (bubbles missing or duplicate).')
      return okPlanSpace(ctx, planSpace, 'Bubbles connected.', { connection })
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
        getPlanSpace(ctx),
        connectionId as string,
        patch
      )
      if (!connection) return fail(`Connection not found: ${connectionId}`)
      return okPlanSpace(ctx, planSpace, 'Connection updated.', { connection })
    }
  ),

  tool(
    'plan_space_delete_connection',
    'Delete a bubble-to-bubble connection.',
    [{ name: 'connectionId', type: 'string', description: 'Connection id', required: true }],
    (ctx, args) => {
      const exists = getPlanSpace(ctx).connections.some((c) => c.id === args.connectionId)
      if (!exists) return fail(`Connection not found: ${args.connectionId}`)
      return okPlanSpace(ctx, ops.deleteConnection(getPlanSpace(ctx), args.connectionId as string), 'Connection deleted.')
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
      const { planSpace, arrow } = ops.addArrow(getPlanSpace(ctx), points, {
        color: args.color as string | undefined,
        dashed: args.dashed as boolean | undefined,
      })
      if (!arrow) return fail('Arrow requires at least 2 points.')
      return okPlanSpace(ctx, planSpace, 'Arrow added.', { arrow })
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
      const { planSpace, arrow } = ops.updateArrow(getPlanSpace(ctx), arrowId as string, patch)
      if (!arrow) return fail(`Arrow not found: ${arrowId}`)
      return okPlanSpace(ctx, planSpace, 'Arrow updated.', { arrow })
    }
  ),

  tool(
    'plan_space_delete_arrow',
    'Delete a freeform arrow path.',
    [{ name: 'arrowId', type: 'string', description: 'Arrow id', required: true }],
    (ctx, args) => {
      const exists = getPlanSpace(ctx).arrows.some((a) => a.id === args.arrowId)
      if (!exists) return fail(`Arrow not found: ${args.arrowId}`)
      return okPlanSpace(ctx, ops.deleteArrow(getPlanSpace(ctx), args.arrowId as string), 'Arrow deleted.')
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
      const next = ops.deleteByIds(getPlanSpace(ctx), {
        bubbleIds: args.bubbleIds as string[] | undefined,
        connectionIds: args.connectionIds as string[] | undefined,
        arrowIds: args.arrowIds as string[] | undefined,
      })
      return okPlanSpace(ctx, next, 'Items deleted.')
    }
  ),

  tool(
    'plan_space_clear',
    'Remove all bubbles, connections, and arrows from the plan space.',
    [],
    (ctx) => okPlanSpace(ctx, ops.clearPlanSpace(getPlanSpace(ctx)), 'Plan space cleared.')
  ),

  tool(
    'plan_space_apply_preset',
    'Replace plan space content with the default project roadmap preset.',
    [],
    (ctx) => okPlanSpace(ctx, ops.applyPlanSpacePreset(getPlanSpace(ctx)), 'Preset applied.')
  ),

  tool(
    'plan_space_seed_if_empty',
    'Apply the default preset only if the plan space has no bubbles.',
    [],
    (ctx) => okPlanSpace(ctx, ops.seedPlanSpace(getPlanSpace(ctx)), 'Seed check complete.')
  ),

  tool(
    'plan_space_get_bubble_bounds',
    'Get the combined bounding box of all bubbles in world coordinates.',
    [],
    (ctx) =>
      okRead(ctx, 'Bubble bounds calculated.', {
        bounds: getBubbleBounds(getPlanSpace(ctx).bubbles),
      })
  ),

  tool(
    'plan_space_link_bubble',
    'Link a plan space bubble to a schematic or document artifact for pipeline tracking.',
    [
      { name: 'bubbleId', type: 'string', description: 'Bubble id', required: true },
      { name: 'schematicId', type: 'string', description: 'Linked schematic id', required: false },
      { name: 'documentId', type: 'string', description: 'Linked document id', required: false },
    ],
    (ctx, args) => {
      const { planSpace, bubble } = ops.linkBubbleArtifact(getPlanSpace(ctx), args.bubbleId as string, {
        schematicId: args.schematicId as string | undefined,
        documentId: args.documentId as string | undefined,
      })
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return okPlanSpace(ctx, planSpace, 'Bubble linked.', { bubble })
    }
  ),

  tool(
    'plan_space_set_bubble_stage',
    'Set pipeline stage status on a bubble (pending, in_progress, complete). Preset bubbles are fully editable.',
    [
      { name: 'bubbleId', type: 'string', description: 'Bubble id', required: true },
      {
        name: 'status',
        type: 'string',
        description: 'Stage status',
        required: true,
        enum: [...STAGE_STATUSES],
      },
      {
        name: 'stage',
        type: 'string',
        description: 'Pipeline stage',
        required: false,
        enum: [...PIPELINE_STAGE_ENUM],
      },
    ],
    (ctx, args) => {
      const { planSpace, bubble } = ops.setBubbleStageStatus(
        getPlanSpace(ctx),
        args.bubbleId as string,
        args.status as 'pending' | 'in_progress' | 'complete',
        args.stage as import('../../types/workspace').PipelineStage | undefined
      )
      if (!bubble) return fail(`Bubble not found: ${args.bubbleId}`)
      return okPlanSpace(ctx, planSpace, 'Bubble stage updated.', { bubble })
    }
  ),

  tool(
    'plan_space_update_bubble_metadata',
    'Update arbitrary metadata on a bubble (tags, notes, links). Nothing is locked.',
    [
      { name: 'bubbleId', type: 'string', description: 'Bubble id', required: true },
      { name: 'tags', type: 'array', description: 'Tags', required: false, items: { name: 'tag', type: 'string', description: 'Tag' } },
      { name: 'notes', type: 'string', description: 'Notes', required: false },
      { name: 'linkedSchematicId', type: 'string', description: 'Linked schematic', required: false },
      { name: 'linkedDocumentId', type: 'string', description: 'Linked document', required: false },
    ],
    (ctx, args) => {
      const { bubbleId, ...meta } = args as Record<string, unknown>
      const { planSpace, bubble } = ops.updateBubbleMetadata(
        getPlanSpace(ctx),
        bubbleId as string,
        meta as import('../../types/workspace').PlanBubbleMetadata
      )
      if (!bubble) return fail(`Bubble not found: ${bubbleId}`)
      return okPlanSpace(ctx, planSpace, 'Bubble metadata updated.', { bubble })
    }
  ),
]
