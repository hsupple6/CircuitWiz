import { parseNumericProperty, posKey } from '../../systems/chain/utils'
import { getTerminals } from '../../systems/chain/components/registry'
import type { PlacedComponent } from '../../systems/chain/types'
import { resolveLogicModule } from '../logicModule'

/** Average rectified DC from a sine full-wave bridge: (2√2/π) × Vrms ≈ 0.9 × Vrms. */
export const BRIDGE_DC_VRMS_FACTOR = (2 * Math.SQRT2) / Math.PI

/** Unfiltered full-wave bridge output minus two series diode drops. */
export function bridgeRectifierOutputVdc(vrms: number, forwardVoltagePerDiode = 0.7): number {
  if (vrms <= 0) return 0
  const raw = BRIDGE_DC_VRMS_FACTOR * vrms - 2 * forwardVoltagePerDiode
  return Math.max(0, raw)
}

/** Find Vrms from an AC source wired to both bridge AC terminals. */
export function findAcVrmsForBridge(
  netAc1: number,
  netAc2: number,
  components: PlacedComponent[],
  posToNet: Map<string, number>
): number | null {
  const bridgeNets = new Set([netAc1, netAc2])

  for (const component of components) {
    if (resolveLogicModule(component.moduleDefinition) !== 'ACSource') continue

    const terminals = getTerminals(component)
    const ac1 = terminals.find((t) => t.moduleCell.pin === 'AC1')
    const ac2 = terminals.find((t) => t.moduleCell.pin === 'AC2')
    if (!ac1 || !ac2) continue

    const n1 = posToNet.get(posKey(ac1.x, ac1.y))
    const n2 = posToNet.get(posKey(ac2.x, ac2.y))
    if (n1 === undefined || n2 === undefined) continue
    if (bridgeNets.has(n1) && bridgeNets.has(n2)) {
      return parseNumericProperty(component.moduleDefinition.properties?.vrms, 12)
    }
  }

  return null
}
