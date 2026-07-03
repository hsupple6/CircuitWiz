import type { WireConnection } from '../../modules/types'
import { getComponentConductivity } from './components/registry'
import type { CircuitGraph, GraphTerminal, GridCellLike, InternalEdge, SourceChain } from './types'
import { classifyTerminalPolarity, isConnectable, isGroundReference } from './terminals'
import { parseNumericProperty, posKey } from './utils'

function collectComponentTerminals(
  gridData: GridCellLike[][],
  componentId: string
): GraphTerminal[] {
  const terminals: GraphTerminal[] = []
  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (cell?.componentId !== componentId || !cell.moduleDefinition) return
      const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
      if (!isConnectable(moduleCell)) return
      const moduleType = cell.moduleDefinition.module
      terminals.push({
        key: posKey(x, y),
        x,
        y,
        componentId,
        cellIndex: cell.cellIndex ?? 0,
        moduleType,
        moduleCell,
        polarity: classifyTerminalPolarity(moduleCell, moduleType),
      })
    })
  })
  return terminals
}

export function buildCircuitGraph(
  gridData: GridCellLike[][],
  wires: WireConnection[]
): CircuitGraph {
  const terminals = new Map<string, GraphTerminal>()
  const wireAdj = new Map<string, Set<string>>()
  const processedComponents = new Set<string>()
  const internalEdges: InternalEdge[] = []

  const linkWire = (ax: number, ay: number, bx: number, by: number) => {
    const a = posKey(ax, ay)
    const b = posKey(bx, by)
    if (!wireAdj.has(a)) wireAdj.set(a, new Set())
    if (!wireAdj.has(b)) wireAdj.set(b, new Set())
    wireAdj.get(a)!.add(b)
    wireAdj.get(b)!.add(a)
  }

  wires.forEach((wire) => {
    wire.segments.forEach((segment) => {
      linkWire(segment.from.x, segment.from.y, segment.to.x, segment.to.y)
    })
  })

  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) return
      const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
      if (!isConnectable(moduleCell)) return

      const key = posKey(x, y)
      const moduleType = cell.moduleDefinition.module
      terminals.set(key, {
        key,
        x,
        y,
        componentId: cell.componentId,
        cellIndex: cell.cellIndex ?? 0,
        moduleType,
        moduleCell,
        polarity: classifyTerminalPolarity(moduleCell, moduleType),
      })

      if (!processedComponents.has(cell.componentId)) {
        processedComponents.add(cell.componentId)
        const compTerminals = collectComponentTerminals(gridData, cell.componentId)
        internalEdges.push(
          ...getComponentConductivity(moduleType, compTerminals, gridData, cell.moduleDefinition.category)
        )
      }
    })
  })

  return { terminals, wireAdj, internalEdges }
}

export function canTraverse(graph: CircuitGraph, startKey: string, endKey: string): boolean {
  if (startKey === endKey) return true

  const adjacency = new Map<string, Set<string>>()
  const addEdge = (from: string, to: string) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set())
    adjacency.get(from)!.add(to)
  }

  graph.wireAdj.forEach((neighbors, node) => {
    neighbors.forEach((neighbor) => addEdge(node, neighbor))
  })

  for (const edge of graph.internalEdges) {
    if (edge.bidirectional) {
      addEdge(edge.from, edge.to)
      addEdge(edge.to, edge.from)
    } else {
      addEdge(edge.from, edge.to)
    }
  }

  const visited = new Set<string>()
  const queue = [startKey]

  while (queue.length > 0) {
    const node = queue.shift()!
    if (node === endKey) return true
    if (visited.has(node)) continue
    visited.add(node)
    for (const neighbor of adjacency.get(node) ?? []) {
      if (!visited.has(neighbor)) queue.push(neighbor)
    }
  }

  return false
}

export function findSourceChains(gridData: GridCellLike[][]): SourceChain[] {
  const chains: SourceChain[] = []
  const processed = new Set<string>()

  gridData.forEach((row) => {
    if (!row) return
    row.forEach((cell) => {
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) return
      if (processed.has(cell.componentId)) return

      const moduleType = cell.moduleDefinition.module
      const powerModules = ['Battery', 'PowerSupply', 'ACSource']
      if (!powerModules.includes(moduleType)) return

      processed.add(cell.componentId)
      const terminals = collectComponentTerminals(gridData, cell.componentId)
      const positive = terminals.find((t) => t.polarity === 'positive')
      const negative = terminals.find((t) => t.polarity === 'negative')
      if (!positive || !negative) return

      const voltage = parseNumericProperty(
        positive.moduleCell.voltage ?? cell.moduleDefinition.properties?.voltage,
        moduleType === 'ACSource'
          ? parseNumericProperty(cell.moduleDefinition.properties?.vrms, 12)
          : 5
      )

      chains.push({
        sourceId: cell.componentId,
        moduleType,
        positiveKey: positive.key,
        negativeKey: negative.key,
        voltage,
      })
    })
  })

  return chains
}

export function validateSourceChains(
  gridData: GridCellLike[][],
  wires: WireConnection[]
): { valid: boolean; errors: string[] } {
  const graph = buildCircuitGraph(gridData, wires)
  const chains = findSourceChains(gridData)
  const errors: string[] = []

  if (chains.length === 0) {
    return { valid: false, errors: ['No voltage source found in circuit'] }
  }

  const hasGround = [...graph.terminals.values()].some((t) => isGroundReference(t.moduleCell))
  if (!hasGround) {
    return { valid: false, errors: ['No ground reference found in circuit'] }
  }

  for (const chain of chains) {
    if (!canTraverse(graph, chain.positiveKey, chain.negativeKey)) {
      errors.push(
        `${chain.moduleType} (${chain.sourceId}): no closed path from + to - through conductive components`
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

export function checkContinuity(gridData: GridCellLike[][], wires: WireConnection[]): boolean {
  return validateSourceChains(gridData, wires).valid
}
