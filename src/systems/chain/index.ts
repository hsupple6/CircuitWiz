/**
 * Chain-based electrical system.
 *
 * Topology (chains, continuity, per-node voltages) lives here.
 * Mathematics (MNA) lives in ./solver/.
 */

export { solveCircuit } from './solver/engine'
export type { CircuitSolveResult, SolvedComponentState, GridCellLike } from './solver/engine'

export {
  buildCircuitGraph,
  canTraverse,
  checkContinuity,
  findSourceChains,
  validateSourceChains,
} from './graph'

export { buildSystemChains } from './chains'
export { buildNodeVoltages, propagateVoltages } from './propagate'
export { buildNets, isNetGrounded } from './nets'

export {
  classifyTerminalPolarity,
  isPositiveTerminal,
  isGroundReference,
  isGroundTerminal,
} from './terminals'

export type {
  TerminalPolarity,
  GraphTerminal,
  InternalEdge,
  CircuitGraph,
  SourceChain,
  ComponentChainUnit,
  WireChainLink,
  ChainLink,
  SystemChain,
  ChainSolveResult,
} from './types'

export { getComponentConductivity, getComponentChainUnit, getPlacedComponents } from './components/registry'
