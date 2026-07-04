import type { AnchorLogicProfile } from '../core/anchorLogic'

export const CONNECTOR_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'NPinConnector',
    domain: 'connectors',
    category: 'connectors',
    kicadSymbol: 'Connector/Conn_01x02.kicad_sym',
    chain: 'systems/chain/components/registry.ts → no internal edges',
    sim: 'passive junction — wire-only continuity',
  },
]

const LEGACY_CONNECTOR_TYPES = new Set(['NPinTerminal2', 'NPinTerminal4', 'NPinTerminal8', 'NPinTerminal'])

export function isConnectorModule(moduleType: string): boolean {
  return (
    moduleType === 'NPinConnector' ||
    moduleType === 'N Pin Connector' ||
    LEGACY_CONNECTOR_TYPES.has(moduleType)
  )
}
