import type { AliasSpec } from './aliasTypes'
import { passiveAliases } from '../passives/aliases'
import { powerAliases } from '../power/aliases'
import { semiconductorAliases } from '../semiconductors/aliases'
import { switchAliases } from '../switches/aliases'
import { outputAliases } from '../output/aliases'
import { driverAliases } from '../drivers/aliases'
import { sensorAliases } from '../sensors/index'
import { microcontrollerAliases } from '../microcontrollers/index'
import { organizationAliases } from '../organization/index'
import { connectorAliases } from '../connectors/aliases'

/** Every palette alias in one array — domain files own their slice. */
export const ALL_ALIASES: AliasSpec[] = [
  ...passiveAliases,
  ...powerAliases,
  ...semiconductorAliases,
  ...switchAliases,
  ...outputAliases,
  ...driverAliases,
  ...sensorAliases,
  ...microcontrollerAliases,
  ...organizationAliases,
  ...connectorAliases,
]

export {
  passiveAliases,
  powerAliases,
  semiconductorAliases,
  switchAliases,
  outputAliases,
  driverAliases,
  connectorAliases,
}
