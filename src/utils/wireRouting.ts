type Point = { x: number; y: number }

function cellKey(p: Point): string {
  return `${p.x},${p.y}`
}

function isOccupied(gridData: unknown[][], x: number, y: number): boolean {
  const cell = gridData[y]?.[x] as { occupied?: boolean } | undefined
  return Boolean(cell?.occupied)
}

function horizontalClear(
  gridData: unknown[][],
  y: number,
  x1: number,
  x2: number,
  endpoints: Set<string>
): boolean {
  const min = Math.min(x1, x2)
  const max = Math.max(x1, x2)
  for (let x = min; x <= max; x++) {
    const key = cellKey({ x, y })
    if (endpoints.has(key)) continue
    if (isOccupied(gridData, x, y)) return false
  }
  return true
}

function verticalClear(
  gridData: unknown[][],
  x: number,
  y1: number,
  y2: number,
  endpoints: Set<string>
): boolean {
  const min = Math.min(y1, y2)
  const max = Math.max(y1, y2)
  for (let y = min; y <= max; y++) {
    const key = cellKey({ x, y })
    if (endpoints.has(key)) continue
    if (isOccupied(gridData, x, y)) return false
  }
  return true
}

function pathClear(gridData: unknown[][], points: Point[], endpoints: Set<string>): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (a.x === b.x) {
      if (!verticalClear(gridData, a.x, a.y, b.y, endpoints)) return false
    } else if (a.y === b.y) {
      if (!horizontalClear(gridData, a.y, a.x, b.x, endpoints)) return false
    } else {
      return false
    }
  }
  return true
}

/** Manhattan wire path that avoids routing through occupied cells (e.g. diode bodies). */
export function buildWirePath(from: Point, to: Point, gridData: unknown[][]): Point[] {
  const endpoints = new Set([cellKey(from), cellKey(to)])

  if (from.x === to.x && from.y === to.y) return [from]

  const candidates: Point[][] = [
    [from, to],
    [from, { x: to.x, y: from.y }, to],
    [from, { x: from.x, y: to.y }, to],
  ]

  for (const offset of [1, -1, 2, -2, 3, -3]) {
    const detourY = from.y + offset
    if (detourY >= 0) {
      candidates.push([from, { x: from.x, y: detourY }, { x: to.x, y: detourY }, to])
    }
    const detourX = from.x + offset
    if (detourX >= 0) {
      candidates.push([from, { x: detourX, y: from.y }, { x: detourX, y: to.y }, to])
    }
  }

  for (const path of candidates) {
    if (pathClear(gridData, path, endpoints)) return path
  }

  return [from, { x: to.x, y: from.y }, to]
}
