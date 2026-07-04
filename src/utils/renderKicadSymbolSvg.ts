type Point = { x: number; y: number }

interface SchematicLine {
  type: 'schematic_line'
  x1: number
  y1: number
  x2: number
  y2: number
  stroke_width?: number
  is_dashed?: boolean
}

interface SchematicRect {
  type: 'schematic_rect'
  center: Point
  width: number
  height: number
  rotation?: number
  stroke_width?: number
  is_filled?: boolean
}

interface SchematicCircle {
  type: 'schematic_circle'
  center: Point
  radius: number
  stroke_width?: number
  is_filled?: boolean
}

interface SchematicArc {
  type: 'schematic_arc'
  start: Point
  mid: Point
  end: Point
  stroke_width?: number
  is_filled?: boolean
}

type GraphicElement = SchematicLine | SchematicRect | SchematicCircle | SchematicArc

const GRAPHIC_TYPES = new Set([
  'schematic_line',
  'schematic_rect',
  'schematic_circle',
  'schematic_arc',
])

function collectPoints(element: GraphicElement, points: Point[]): void {
  switch (element.type) {
    case 'schematic_line':
      points.push({ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 })
      break
    case 'schematic_rect': {
      const halfW = element.width / 2
      const halfH = element.height / 2
      points.push(
        { x: element.center.x - halfW, y: element.center.y - halfH },
        { x: element.center.x + halfW, y: element.center.y + halfH }
      )
      break
    }
    case 'schematic_circle': {
      points.push(
        { x: element.center.x - element.radius, y: element.center.y - element.radius },
        { x: element.center.x + element.radius, y: element.center.y + element.radius }
      )
      break
    }
    case 'schematic_arc':
      points.push(element.start, element.mid, element.end)
      break
  }
}

function computeBounds(elements: GraphicElement[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  const points: Point[] = []
  for (const element of elements) collectPoints(element, points)

  if (points.length === 0) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  }

  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y

  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, maxX, minY, maxY }
}

function mapPoint(point: Point, bounds: ReturnType<typeof computeBounds>, padding: number): Point {
  return {
    x: point.x - bounds.minX + padding,
    y: bounds.maxY - point.y + padding,
  }
}

const STROKE_SCALE = 0.5
const MIN_STROKE_WIDTH = 0.35

function strokeWidth(value: number | undefined, scale: number): number {
  const width = value ?? 0.15
  return Math.max(MIN_STROKE_WIDTH, width * scale * STROKE_SCALE)
}

function renderLine(
  element: SchematicLine,
  bounds: ReturnType<typeof computeBounds>,
  padding: number,
  scale: number
): string {
  const start = mapPoint({ x: element.x1, y: element.y1 }, bounds, padding)
  const end = mapPoint({ x: element.x2, y: element.y2 }, bounds, padding)
  const dash = element.is_dashed ? ' stroke-dasharray="4 2"' : ''
  return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="currentColor" stroke-width="${strokeWidth(element.stroke_width, scale)}" stroke-linecap="round"${dash} />`
}

function renderRect(
  element: SchematicRect,
  bounds: ReturnType<typeof computeBounds>,
  padding: number,
  scale: number
): string {
  const topLeft = mapPoint(
    { x: element.center.x - element.width / 2, y: element.center.y + element.height / 2 },
    bounds,
    padding
  )
  const bottomRight = mapPoint(
    { x: element.center.x + element.width / 2, y: element.center.y - element.height / 2 },
    bounds,
    padding
  )
  const width = bottomRight.x - topLeft.x
  const height = bottomRight.y - topLeft.y
  const fill = element.is_filled ? 'currentColor' : 'none'
  return `<rect x="${topLeft.x}" y="${topLeft.y}" width="${width}" height="${height}" fill="${fill}" stroke="currentColor" stroke-width="${strokeWidth(element.stroke_width, scale)}" />`
}

function renderCircle(
  element: SchematicCircle,
  bounds: ReturnType<typeof computeBounds>,
  padding: number,
  scale: number
): string {
  const center = mapPoint(element.center, bounds, padding)
  const edge = mapPoint(
    { x: element.center.x + element.radius, y: element.center.y },
    bounds,
    padding
  )
  const radius = Math.abs(edge.x - center.x)
  const fill = element.is_filled ? 'currentColor' : 'none'
  return `<circle cx="${center.x}" cy="${center.y}" r="${radius}" fill="${fill}" stroke="currentColor" stroke-width="${strokeWidth(element.stroke_width, scale)}" />`
}

function renderArc(
  element: SchematicArc,
  bounds: ReturnType<typeof computeBounds>,
  padding: number,
  scale: number
): string {
  const start = mapPoint(element.start, bounds, padding)
  const mid = mapPoint(element.mid, bounds, padding)
  const end = mapPoint(element.end, bounds, padding)
  return `<path d="M ${start.x} ${start.y} Q ${mid.x} ${mid.y} ${end.x} ${end.y}" fill="none" stroke="currentColor" stroke-width="${strokeWidth(element.stroke_width, scale)}" stroke-linecap="round" />`
}

export function renderKicadSymbolSvg(
  circuitJson: unknown[],
  options: { width?: number; height?: number } = {}
): string | null {
  const elements = circuitJson.filter(
    (entry): entry is GraphicElement =>
      typeof entry === 'object' &&
      entry !== null &&
      'type' in entry &&
      GRAPHIC_TYPES.has(String((entry as { type: string }).type))
  )

  if (elements.length === 0) return null

  const bounds = computeBounds(elements)
  const padding = 0.8
  const contentWidth = bounds.maxX - bounds.minX + padding * 2
  const contentHeight = bounds.maxY - bounds.minY + padding * 2
  const scale = Math.min((options.width ?? 48) / contentWidth, (options.height ?? 40) / contentHeight)
  const width = options.width ?? 48
  const height = options.height ?? 40

  const parts = elements.map((element) => {
    switch (element.type) {
      case 'schematic_line':
        return renderLine(element, bounds, padding, scale)
      case 'schematic_rect':
        return renderRect(element, bounds, padding, scale)
      case 'schematic_circle':
        return renderCircle(element, bounds, padding, scale)
      case 'schematic_arc':
        return renderArc(element, bounds, padding, scale)
      default:
        return ''
    }
  })

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${contentWidth} ${contentHeight}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`
}
