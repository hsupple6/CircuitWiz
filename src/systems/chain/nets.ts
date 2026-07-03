import type { WireConnection } from '../../modules/types'
import { canTraverse, validateSourceChains } from './graph'
import { getPlacedComponents, getTerminals, isGroundReference, isPositiveTerminal } from './components/registry'
import type { GridCellLike, PlacedComponent } from './types'
import { UnionFind, posKey } from './utils'

export interface Netlist {
  nodeCount: number
  groundNet: number
  posToNet: Map<string, number>
  components: PlacedComponent[]
  errors: string[]
}

export function buildNets(
  gridData: GridCellLike[][],
  wires: WireConnection[]
): Netlist {
  const components = getPlacedComponents(gridData)
  const posIndex = new Map<string, number>()
  const positions: Array<{ x: number; y: number }> = []

  const ensurePos = (x: number, y: number): number => {
    const key = posKey(x, y)
    let idx = posIndex.get(key)
    if (idx === undefined) {
      idx = positions.length
      posIndex.set(key, idx)
      positions.push({ x, y })
    }
    return idx
  }

  wires.forEach((wire) => {
    wire.segments.forEach((segment) => {
      ensurePos(segment.from.x, segment.from.y)
      ensurePos(segment.to.x, segment.to.y)
    })
  })

  components.forEach((component) => {
    getTerminals(component).forEach((terminal) => {
      ensurePos(terminal.x, terminal.y)
    })
  })

  const uf = new UnionFind(positions.length)

  wires.forEach((wire) => {
    wire.segments.forEach((segment) => {
      const a = ensurePos(segment.from.x, segment.from.y)
      const b = ensurePos(segment.to.x, segment.to.y)
      uf.union(a, b)
    })
  })

  const groundIndices: number[] = []
  components.forEach((component) => {
    getTerminals(component).forEach((terminal) => {
      const idx = ensurePos(terminal.x, terminal.y)
      if (isGroundReference(terminal.moduleCell)) {
        groundIndices.push(idx)
      }
    })
  })

  groundIndices.forEach((gnd) => {
    groundIndices.forEach((other) => uf.union(gnd, other))
  })

  const rootToNet = new Map<number, number>()
  const posToNet = new Map<string, number>()
  let nodeCount = 0
  positions.forEach((pos, idx) => {
    const root = uf.find(idx)
    let net = rootToNet.get(root)
    if (net === undefined) {
      net = nodeCount++
      rootToNet.set(root, net)
    }
    posToNet.set(posKey(pos.x, pos.y), net)
  })

  let groundNet = 0
  if (groundIndices.length > 0) {
    groundNet = posToNet.get(posKey(positions[groundIndices[0]].x, positions[groundIndices[0]].y)) ?? 0
  }

  return { nodeCount, groundNet, posToNet, components, errors: [] }
}

export function isNetGrounded(
  net: number | undefined,
  groundNet: number,
  gridData: GridCellLike[][],
  posToNet: Map<string, number>
): boolean {
  if (net === undefined) return false
  if (net === groundNet) return true

  for (let y = 0; y < gridData.length; y++) {
    const row = gridData[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (!cell?.occupied || !cell.moduleDefinition) continue
      const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
      if (!isGroundReference(moduleCell)) continue
      if (posToNet.get(posKey(x, y)) === net) return true
    }
  }
  return false
}

export { validateSourceChains, canTraverse, isPositiveTerminal }
