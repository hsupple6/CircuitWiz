import { anchorLogicById } from './anchorLogic'
import { PASSIVE_ANCHOR_LOGIC } from '../passives/logic'
import { POWER_ANCHOR_LOGIC } from '../power/logic'
import { SEMICONDUCTOR_ANCHOR_LOGIC } from '../semiconductors/logic'
import { SWITCH_ANCHOR_LOGIC } from '../switches/logic'
import { OUTPUT_ANCHOR_LOGIC } from '../output/logic'
import { DRIVER_ANCHOR_LOGIC } from '../drivers/logic'
import { SENSOR_ANCHOR_LOGIC } from '../sensors/logic'
import { MICROCONTROLLER_ANCHOR_LOGIC } from '../microcontrollers/logic'
import { ORGANIZATION_ANCHOR_LOGIC } from '../organization/logic'
import { CONNECTOR_ANCHOR_LOGIC } from '../connectors/logic'

export const ALL_ANCHOR_LOGIC = [
  ...PASSIVE_ANCHOR_LOGIC,
  ...POWER_ANCHOR_LOGIC,
  ...SEMICONDUCTOR_ANCHOR_LOGIC,
  ...SWITCH_ANCHOR_LOGIC,
  ...OUTPUT_ANCHOR_LOGIC,
  ...DRIVER_ANCHOR_LOGIC,
  ...SENSOR_ANCHOR_LOGIC,
  ...MICROCONTROLLER_ANCHOR_LOGIC,
  ...ORGANIZATION_ANCHOR_LOGIC,
  ...CONNECTOR_ANCHOR_LOGIC,
]

/** Lookup logic profile by anchor id (e.g. "Resistor", "PowerSupply"). */
export const ANCHOR_LOGIC_INDEX = anchorLogicById(ALL_ANCHOR_LOGIC)
