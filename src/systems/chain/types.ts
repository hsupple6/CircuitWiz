import type { WireConnection } from '../../modules/types'

export type TerminalPolarity = 'positive' | 'negative' | 'bidirectional'

export interface GridCellLike {
  occupied?: boolean
  componentId?: string
  componentType?: string
  moduleDefinition?: any
  cellIndex?: number
  resistance?: number
  capacitance?: number
  capacitorVoltage?: number
  isOn?: boolean
  wiperPosition?: number
  x?: number
  y?: number
}

export interface GraphTerminal {
  key: string
  x: number
  y: number
  componentId: string
  cellIndex: number
  moduleType: string
  moduleCell: any
  polarity: TerminalPolarity
}

export interface InternalEdge {
  from: string
  to: string
  bidirectional: boolean
}

export interface CircuitGraph {
  terminals: Map<string, GraphTerminal>
  wireAdj: Map<string, Set<string>>
  internalEdges: InternalEdge[]
}

export interface SourceChain {
  sourceId: string
  moduleType: string
  positiveKey: string
  negativeKey: string
  voltage: number
}

/** One placed component — continuity runs from entry pin to exit pin(s). */
export interface ComponentChainUnit {
  componentId: string
  moduleType: string
  /** Ordered pin keys: current flows from first toward last for directional parts. */
  pinKeys: string[]
  bidirectional: boolean
}

/** A wire hop between two grid positions. */
export interface WireChainLink {
  wireId: string
  fromKey: string
  toKey: string
}

export type ChainLink =
  | { kind: 'component'; unit: ComponentChainUnit }
  | { kind: 'wire'; link: WireChainLink }

/**
 * An electrical system chain. Incomplete chains have open ends;
 * a power chain is complete when it closes from sourceId + back to sourceId -.
 */
export interface SystemChain {
  id: string
  links: ChainLink[]
  /** Open terminal keys not yet connected to another chain. */
  openEnds: Set<string>
  sourceId?: string
  complete: boolean
}

export interface PlacedComponent {
  componentId: string
  baseX: number
  baseY: number
  moduleDefinition: any
  resistance?: number
  capacitance?: number
}

export interface TerminalInfo {
  x: number
  y: number
  cellIndex: number
  moduleCell: any
}

export interface SolvedComponentState {
  componentId: string
  componentType: string
  position: { x: number; y: number }
  outputVoltage: number
  outputCurrent: number
  power: number
  status: string
  isPowered: boolean
  isGrounded: boolean
  pwm?: number
  [key: string]: unknown
}

export interface ChainSolveResult {
  works: boolean
  reason?: string
  errors: string[]
  netVoltages: Map<number, number>
  nodeVoltages: Map<string, number>
  componentStates: Map<string, SolvedComponentState>
  updatedWires: WireConnection[]
  chains: SystemChain[]
  totalVoltage: number
  totalCurrent: number
  totalResistance: number
  totalPower: number
}
