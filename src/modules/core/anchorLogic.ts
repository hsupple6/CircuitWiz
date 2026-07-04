import type { PassiveValueKind } from '../passives/valueKind'

/** Documents where sim/chain/grid logic lives for each anchor — single source for traceability. */
export interface AnchorLogicProfile {
  anchorId: string
  domain: string
  category: string
  kicadSymbol: string
  /** R/C/L selector when placing from palette */
  passiveValue?: PassiveValueKind
  outputModule?: boolean
  /** Human-readable pointer to chain conductivity */
  chain: string
  /** Human-readable pointer to MNA solver branch */
  sim: string
  /** Relative path under src/modules/ to legacy voltage-flow helper, if any */
  voltageFlow?: string
}

export function anchorLogicById(
  profiles: AnchorLogicProfile[]
): Record<string, AnchorLogicProfile> {
  return Object.fromEntries(profiles.map((p) => [p.anchorId, p]))
}
