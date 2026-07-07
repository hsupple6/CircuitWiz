import type { WireConnection } from '../../modules/types'
import { getComponentChainUnit } from './components/registry'
import { buildCircuitGraph, canTraverse } from './graph'
import type { GridCellLike, SystemChain } from './types'
import { posKey } from './utils'

function wireLinks(wires: WireConnection[]): Array<{ wireId: string; a: string; b: string }> {
  const links: Array<{ wireId: string; a: string; b: string }> = []
  wires.forEach((wire) => {
    wire.segments.forEach((segment) => {
      links.push({
        wireId: wire.id,
        a: posKey(segment.from.x, segment.from.y),
        b: posKey(segment.to.x, segment.to.y),
      })
    })
  })
  return links
}

function mergeOpenEnds(chains: SystemChain[], a: string, b: string): void {
  const chainA = chains.find((c) => c.openEnds.has(a))
  const chainB = chains.find((c) => c.openEnds.has(b))
  if (!chainA || !chainB) return

  if (chainA.id === chainB.id) {
    chainA.openEnds.delete(a)
    chainA.openEnds.delete(b)
    return
  }

  const merged: SystemChain = {
    id: chainA.id,
    links: [...chainA.links, ...chainB.links],
    openEnds: new Set([...chainA.openEnds, ...chainB.openEnds]),
    sourceId: chainA.sourceId ?? chainB.sourceId,
    complete: false,
  }
  merged.openEnds.delete(a)
  merged.openEnds.delete(b)

  const ai = chains.indexOf(chainA)
  const bi = chains.indexOf(chainB)
  chains.splice(Math.max(ai, bi), 1)
  chains.splice(Math.min(ai, bi), 1)
  chains.push(merged)
}

/**
 * Build system chains from the schematic.
 * Each placed component starts its own chain unit; wires append/merge chains.
 */
export function buildSystemChains(
  gridData: GridCellLike[][],
  wires: WireConnection[]
): SystemChain[] {
  const graph = buildCircuitGraph(gridData, wires)
  const chains: SystemChain[] = []
  const processed = new Set<string>()

  graph.terminals.forEach((terminal) => {
    if (processed.has(terminal.componentId)) return
    processed.add(terminal.componentId)

    const unit = getComponentChainUnit(terminal.moduleType, terminal.componentId, gridData)
    if (!unit) return

    const powerModules = ['Battery', 'PowerSupply', 'ACSource', 'LiIonPack']
    const isSource = powerModules.includes(terminal.moduleType)

    chains.push({
      id: `chain-${terminal.componentId}`,
      links: [{ kind: 'component', unit }],
      openEnds: new Set(unit.pinKeys),
      sourceId: isSource ? terminal.componentId : undefined,
      complete: false,
    })
  })

  wireLinks(wires).forEach(({ wireId, a, b }) => {
    const owningA = chains.find((c) => c.openEnds.has(a))
    const owningB = chains.find((c) => c.openEnds.has(b))

    if (owningA) {
      owningA.links.push({ kind: 'wire', link: { wireId, fromKey: a, toKey: b } })
      owningA.openEnds.delete(a)
      owningA.openEnds.add(b)
    }

    if (owningB && owningB !== owningA) {
      mergeOpenEnds(chains, a, b)
    }
  })

  const circuitGraph = buildCircuitGraph(gridData, wires)
  for (const chain of chains) {
    if (!chain.sourceId) continue
    const pos = [...circuitGraph.terminals.values()].find(
      (t) => t.componentId === chain.sourceId && t.polarity === 'positive'
    )
    const neg = [...circuitGraph.terminals.values()].find(
      (t) => t.componentId === chain.sourceId && t.polarity === 'negative'
    )
    if (pos && neg) {
      chain.complete = canTraverse(circuitGraph, pos.key, neg.key)
    }
  }

  return chains
}
