import {
  PlanSpace,
  PlanBubble,
  PlanBubbleShape,
  PlanConnection,
  PlanArrow,
  PlanBubbleMetadata,
  seedPlanSpaceIfEmpty,
} from '../../types/workspace'
import {
  clearPresetContent,
  createDefaultPlanSpacePreset,
  planSpaceHasDefaultTemplate,
} from '../../modules/planSpacePreset'
import { PlanSpacePoint, clampZoom, getArrowPoints } from './coordinates'

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function updateMeta(planSpace: PlanSpace): PlanSpace {
  return {
    ...planSpace,
    metadata: { ...planSpace.metadata },
  }
}

export function getPlanSpaceState(planSpace: PlanSpace) {
  return {
    id: planSpace.id,
    bubbleCount: planSpace.bubbles.length,
    connectionCount: planSpace.connections.length,
    arrowCount: planSpace.arrows.length,
    hasDefaultTemplate: planSpaceHasDefaultTemplate(planSpace),
    viewport: planSpace.metadata,
    bubbles: planSpace.bubbles.map((b) => ({
      id: b.id,
      text: b.text,
      subtitle: b.subtitle,
      shape: b.shape,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      color: b.color,
      metadata: b.metadata,
    })),
    connections: planSpace.connections,
    arrows: planSpace.arrows.map((a) => ({
      id: a.id,
      points: getArrowPoints(a),
      color: a.color,
      dashed: a.dashed,
    })),
  }
}

export function addBubble(
  planSpace: PlanSpace,
  input: {
    text: string
    x: number
    y: number
    width?: number
    height?: number
    shape?: PlanBubbleShape
    color?: string
    subtitle?: string
    textColor?: string
    borderColor?: string
    shadow?: boolean
    id?: string
  }
): { planSpace: PlanSpace; bubble: PlanBubble } {
  const base = clearPresetContent(planSpace)
  const bubble: PlanBubble = {
    id: input.id ?? newId('bubble'),
    x: input.x,
    y: input.y,
    width: input.width ?? 200,
    height: input.height ?? 88,
    text: input.text,
    shape: input.shape ?? 'card',
    color: input.color ?? '#ffffff',
    subtitle: input.subtitle,
    textColor: input.textColor,
    borderColor: input.borderColor ?? '#e2e8f0',
    shadow: input.shadow ?? input.shape === 'card',
  }
  return {
    planSpace: updateMeta({
      ...base,
      bubbles: [...base.bubbles, bubble],
    }),
    bubble,
  }
}

export function updateBubble(
  planSpace: PlanSpace,
  bubbleId: string,
  patch: Partial<Omit<PlanBubble, 'id'>>
): { planSpace: PlanSpace; bubble: PlanBubble | null } {
  let updated: PlanBubble | null = null
  const bubbles = planSpace.bubbles.map((b) => {
    if (b.id !== bubbleId) return b
    updated = { ...b, ...patch }
    return updated
  })
  if (!updated) return { planSpace, bubble: null }
  return {
    planSpace: updateMeta({ ...planSpace, bubbles }),
    bubble: updated,
  }
}

export function moveBubble(planSpace: PlanSpace, bubbleId: string, x: number, y: number) {
  return updateBubble(planSpace, bubbleId, { x, y })
}

export function resizeBubble(
  planSpace: PlanSpace,
  bubbleId: string,
  width: number,
  height: number
) {
  return updateBubble(planSpace, bubbleId, { width, height })
}

export function deleteBubble(planSpace: PlanSpace, bubbleId: string): PlanSpace {
  return updateMeta({
    ...planSpace,
    bubbles: planSpace.bubbles.filter((b) => b.id !== bubbleId),
    connections: planSpace.connections.filter(
      (c) => c.fromBubbleId !== bubbleId && c.toBubbleId !== bubbleId
    ),
  })
}

export function duplicateBubble(planSpace: PlanSpace, bubbleId: string, offsetX = 24, offsetY = 24) {
  const source = planSpace.bubbles.find((b) => b.id === bubbleId)
  if (!source) return { planSpace, bubble: null as PlanBubble | null }
  const { id: _id, ...rest } = source
  return addBubble(planSpace, {
    ...rest,
    x: source.x + offsetX,
    y: source.y + offsetY,
    text: source.text,
  })
}

export function connectBubbles(
  planSpace: PlanSpace,
  fromBubbleId: string,
  toBubbleId: string,
  options: Partial<Pick<PlanConnection, 'color' | 'curve' | 'dashed' | 'id'>> = {}
): { planSpace: PlanSpace; connection: PlanConnection | null } {
  const from = planSpace.bubbles.find((b) => b.id === fromBubbleId)
  const to = planSpace.bubbles.find((b) => b.id === toBubbleId)
  if (!from || !to) return { planSpace, connection: null }
  if (fromBubbleId === toBubbleId) return { planSpace, connection: null }

  const exists = planSpace.connections.some(
    (c) => c.fromBubbleId === fromBubbleId && c.toBubbleId === toBubbleId
  )
  if (exists) return { planSpace, connection: null }

  const connection: PlanConnection = {
    id: options.id ?? newId('conn'),
    fromBubbleId,
    toBubbleId,
    color: options.color ?? '#94a3b8',
    curve: options.curve ?? 'arc',
    dashed: options.dashed,
  }
  return {
    planSpace: updateMeta({
      ...planSpace,
      connections: [...planSpace.connections, connection],
    }),
    connection,
  }
}

export function updateConnection(
  planSpace: PlanSpace,
  connectionId: string,
  patch: Partial<Omit<PlanConnection, 'id'>>
): { planSpace: PlanSpace; connection: PlanConnection | null } {
  let updated: PlanConnection | null = null
  const connections = planSpace.connections.map((c) => {
    if (c.id !== connectionId) return c
    updated = { ...c, ...patch }
    return updated
  })
  if (!updated) return { planSpace, connection: null }
  return { planSpace: updateMeta({ ...planSpace, connections }), connection: updated }
}

export function deleteConnection(planSpace: PlanSpace, connectionId: string): PlanSpace {
  return updateMeta({
    ...planSpace,
    connections: planSpace.connections.filter((c) => c.id !== connectionId),
  })
}

export function addArrow(
  planSpace: PlanSpace,
  points: PlanSpacePoint[],
  options: Partial<Pick<PlanArrow, 'color' | 'dashed' | 'id'>> = {}
): { planSpace: PlanSpace; arrow: PlanArrow | null } {
  if (points.length < 2) return { planSpace, arrow: null }
  const arrow: PlanArrow = {
    id: options.id ?? newId('arrow'),
    points,
    color: options.color ?? '#64748b',
    dashed: options.dashed,
  }
  return {
    planSpace: updateMeta({
      ...planSpace,
      arrows: [...planSpace.arrows, arrow],
    }),
    arrow,
  }
}

export function updateArrow(
  planSpace: PlanSpace,
  arrowId: string,
  patch: Partial<Pick<PlanArrow, 'points' | 'color' | 'dashed'>>
): { planSpace: PlanSpace; arrow: PlanArrow | null } {
  let updated: PlanArrow | null = null
  const arrows = planSpace.arrows.map((a) => {
    if (a.id !== arrowId) return a
    updated = { ...a, ...patch }
    return updated
  })
  if (!updated) return { planSpace, arrow: null }
  return { planSpace: updateMeta({ ...planSpace, arrows }), arrow: updated }
}

export function deleteArrow(planSpace: PlanSpace, arrowId: string): PlanSpace {
  return updateMeta({
    ...planSpace,
    arrows: planSpace.arrows.filter((a) => a.id !== arrowId),
  })
}

export function setViewport(
  planSpace: PlanSpace,
  zoom?: number,
  offset?: PlanSpacePoint
): PlanSpace {
  return updateMeta({
    ...planSpace,
    metadata: {
      zoom: zoom != null ? clampZoom(zoom) : planSpace.metadata.zoom,
      offset: offset ?? planSpace.metadata.offset,
    },
  })
}

export function panViewport(planSpace: PlanSpace, deltaX: number, deltaY: number): PlanSpace {
  return setViewport(planSpace, undefined, {
    x: planSpace.metadata.offset.x + deltaX,
    y: planSpace.metadata.offset.y + deltaY,
  })
}

export function clearPlanSpace(planSpace: PlanSpace): PlanSpace {
  return updateMeta({
    ...planSpace,
    bubbles: [],
    connections: [],
    arrows: [],
  })
}

export function applyPlanSpacePreset(planSpace: PlanSpace): PlanSpace {
  const preset = createDefaultPlanSpacePreset()
  return updateMeta({
    ...planSpace,
    bubbles: preset.bubbles,
    connections: preset.connections,
    arrows: preset.arrows,
    metadata: preset.metadata,
  })
}

export function seedPlanSpace(planSpace: PlanSpace): PlanSpace {
  return seedPlanSpaceIfEmpty(planSpace)
}

export function updateBubbleMetadata(
  planSpace: PlanSpace,
  bubbleId: string,
  metadata: Partial<PlanBubbleMetadata>
): { planSpace: PlanSpace; bubble: PlanBubble | null } {
  const bubble = planSpace.bubbles.find((b) => b.id === bubbleId)
  if (!bubble) return { planSpace, bubble: null }
  return updateBubble(planSpace, bubbleId, {
    metadata: { ...bubble.metadata, ...metadata },
  })
}

export function linkBubbleArtifact(
  planSpace: PlanSpace,
  bubbleId: string,
  link: { schematicId?: string; documentId?: string }
): { planSpace: PlanSpace; bubble: PlanBubble | null } {
  const patch: Partial<PlanBubbleMetadata> = {}
  if (link.schematicId !== undefined) patch.linkedSchematicId = link.schematicId
  if (link.documentId !== undefined) patch.linkedDocumentId = link.documentId
  return updateBubbleMetadata(planSpace, bubbleId, patch)
}

export function setBubbleStageStatus(
  planSpace: PlanSpace,
  bubbleId: string,
  status: PlanBubbleMetadata['status'],
  stage?: PlanBubbleMetadata['stage']
): { planSpace: PlanSpace; bubble: PlanBubble | null } {
  const patch: Partial<PlanBubbleMetadata> = { status }
  if (stage) patch.stage = stage
  return updateBubbleMetadata(planSpace, bubbleId, patch)
}

export function deleteByIds(
  planSpace: PlanSpace,
  ids: { bubbleIds?: string[]; connectionIds?: string[]; arrowIds?: string[] }
): PlanSpace {
  const bubbleSet = new Set(ids.bubbleIds ?? [])
  const connSet = new Set(ids.connectionIds ?? [])
  const arrowSet = new Set(ids.arrowIds ?? [])

  return updateMeta({
    ...planSpace,
    bubbles: planSpace.bubbles.filter((b) => !bubbleSet.has(b.id)),
    connections: planSpace.connections.filter(
      (c) =>
        !connSet.has(c.id) &&
        !bubbleSet.has(c.fromBubbleId) &&
        !bubbleSet.has(c.toBubbleId)
    ),
    arrows: planSpace.arrows.filter((a) => !arrowSet.has(a.id)),
  })
}
