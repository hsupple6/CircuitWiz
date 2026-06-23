import { PlanArrow, PlanBubble, PlanSpace } from '../../types/workspace'

/**
 * Plan Space coordinate system
 * ----------------------------
 * - **World space** (`PlanSpacePoint`): CSS pixels on the infinite canvas at zoom = 1.
 *   Origin (0, 0) is the top-left of world space. +X is right, +Y is down.
 * - **Screen space** (`ScreenPoint`): Pixels relative to the plan-space viewport element.
 * - **Viewport** (`PlanSpaceViewport`): `offset` (screen px) + `zoom` scale applied to world.
 *
 * Transform: `screen = world * zoom + offset`
 * Inverse:   `world = (screen - offset) / zoom`
 */
export interface PlanSpacePoint {
  x: number
  y: number
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface PlanSpaceViewport {
  zoom: number
  offset: PlanSpacePoint
}

export interface PlanSpaceRect {
  x: number
  y: number
  width: number
  height: number
}

export const PLAN_SPACE_COORDINATE_SYSTEM = {
  id: 'circuitwiz-plan-space-v1',
  name: 'Plan Space World Coordinates',
  unit: 'px',
  origin: 'top-left' as const,
  xAxis: 'right' as const,
  yAxis: 'down' as const,
  defaultZoom: 1,
  minZoom: 0.25,
  maxZoom: 3,
  description:
    'All bubble positions, sizes, and arrow polyline points are stored in world pixels. ' +
    'Use world coordinates for agent mutations; convert via viewport when reasoning about on-screen layout.',
}

export function getViewport(planSpace: PlanSpace): PlanSpaceViewport {
  return {
    zoom: planSpace.metadata.zoom,
    offset: { ...planSpace.metadata.offset },
  }
}

export function worldToScreen(
  world: PlanSpacePoint,
  viewport: PlanSpaceViewport
): ScreenPoint {
  return {
    x: world.x * viewport.zoom + viewport.offset.x,
    y: world.y * viewport.zoom + viewport.offset.y,
  }
}

export function screenToWorld(
  screen: ScreenPoint,
  viewport: PlanSpaceViewport
): PlanSpacePoint {
  return {
    x: (screen.x - viewport.offset.x) / viewport.zoom,
    y: (screen.y - viewport.offset.y) / viewport.zoom,
  }
}

export function getBubbleCenter(bubble: PlanBubble): PlanSpacePoint {
  return {
    x: bubble.x + bubble.width / 2,
    y: bubble.y + bubble.height / 2,
  }
}

export function getBubbleRect(bubble: PlanBubble): PlanSpaceRect {
  return {
    x: bubble.x,
    y: bubble.y,
    width: bubble.width,
    height: bubble.height,
  }
}

export function getBubbleBounds(bubbles: PlanBubble[]): PlanSpaceRect | null {
  if (bubbles.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of bubbles) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function getArrowPoints(arrow: PlanArrow & { x1?: number; y1?: number; x2?: number; y2?: number }): PlanSpacePoint[] {
  if (arrow.points?.length >= 2) return arrow.points
  if (arrow.x1 != null && arrow.x2 != null && arrow.y1 != null && arrow.y2 != null) {
    return [{ x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }]
  }
  return arrow.points ?? []
}

export function getPlanSpaceContentBounds(planSpace: PlanSpace): PlanSpaceRect | null {
  const points: PlanSpacePoint[] = []

  for (const b of planSpace.bubbles) {
    points.push({ x: b.x, y: b.y })
    points.push({ x: b.x + b.width, y: b.y + b.height })
  }
  for (const a of planSpace.arrows) {
    points.push(...getArrowPoints(a))
  }

  if (points.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function pointInBubble(bubble: PlanBubble, point: PlanSpacePoint): boolean {
  return (
    point.x >= bubble.x &&
    point.x <= bubble.x + bubble.width &&
    point.y >= bubble.y &&
    point.y <= bubble.y + bubble.height
  )
}

export function findBubbleAtPoint(bubbles: PlanBubble[], point: PlanSpacePoint): PlanBubble | null {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    if (pointInBubble(bubbles[i], point)) return bubbles[i]
  }
  return null
}

export function clampZoom(zoom: number): number {
  return Math.max(PLAN_SPACE_COORDINATE_SYSTEM.minZoom, Math.min(PLAN_SPACE_COORDINATE_SYSTEM.maxZoom, zoom))
}

/** Offset viewport so a world rect is centered in a screen-sized viewport */
export function viewportToFitBounds(
  bounds: PlanSpaceRect,
  screenWidth: number,
  screenHeight: number,
  padding = 48
): PlanSpaceViewport {
  const zoomX = (screenWidth - padding * 2) / bounds.width
  const zoomY = (screenHeight - padding * 2) / bounds.height
  const zoom = clampZoom(Math.min(zoomX, zoomY, 1))
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return {
    zoom,
    offset: {
      x: screenWidth / 2 - cx * zoom,
      y: screenHeight / 2 - cy * zoom,
    },
  }
}
