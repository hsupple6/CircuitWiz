/** @deprecated Import from `src/systems/chain` instead. */
export {
  solveCircuit,
  checkContinuity,
  validateSourceChains,
  buildCircuitGraph,
  isPositiveTerminal,
  isGroundReference,
  isGroundTerminal,
  classifyTerminalPolarity,
} from '../systems/chain'

export type { CircuitSolveResult, SolvedComponentState, GridCellLike } from '../systems/chain'
