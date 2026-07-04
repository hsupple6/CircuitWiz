import type { AnchorLogicProfile } from '../core/anchorLogic'

export const DRIVER_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'StepperDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Device/Q_NMOS.kicad_sym',
    chain: 'systems/chain/components/registry.ts → STEP/DIR→coil pairs when EN active',
    sim: 'systems/chain/components/driverStamps.ts → stepper coil drive',
  },
  {
    anchorId: 'BrushedDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Device/Q_NMOS.kicad_sym',
    chain: 'systems/chain/components/registry.ts → IN→OUT when active',
    sim: 'systems/chain/components/driverStamps.ts → PWM/HIGH → VM→OUT',
  },
  {
    anchorId: 'EscDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Motor/Motor_DC.kicad_sym',
    chain: 'systems/chain/components/registry.ts → PWM→U/V/W when active',
    sim: 'systems/chain/components/driverStamps.ts → throttle PWM → 3-phase outputs',
  },
  {
    anchorId: 'LEDDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Device/LED.kicad_sym',
    chain: 'systems/chain/components/registry.ts → DRIVER_CTRL→DRIVER_OUT when active',
    sim: 'systems/chain/components/driverStamps.ts → PWM → VIN→OUT',
  },
  {
    anchorId: 'DisplayDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Device/C.kicad_sym',
    chain: 'systems/chain/components/registry.ts → VCC/GND only; DUMMY pins inert',
    sim: 'systems/chain/components/driverStamps.ts → idle supply load only',
  },
  {
    anchorId: 'RelayDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Device/Q_NPN.kicad_sym',
    chain: 'systems/chain/components/registry.ts → IN→coil +/− when active',
    sim: 'systems/chain/components/driverStamps.ts → HIGH → coil drive',
  },
  {
    anchorId: 'AudioDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Amplifier_Operational/LM358.kicad_sym',
    chain: 'systems/chain/components/registry.ts → VCC/GND only; SPK pins dummy',
    sim: 'systems/chain/components/driverStamps.ts → idle supply load only',
  },
  {
    anchorId: 'PowerDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Device/R_US.kicad_sym',
    chain: 'systems/chain/components/registry.ts → VIN→VOUT pass-through',
    sim: 'systems/chain/components/driverStamps.ts → regulated VIN→VOUT',
  },
  {
    anchorId: 'SerialDriver',
    domain: 'drivers',
    category: 'drivers',
    kicadSymbol: 'Device/Q_NPN.kicad_sym',
    chain: 'systems/chain/components/registry.ts → TX/RX in; USB pins dummy',
    sim: 'systems/chain/components/driverStamps.ts → TX/RX signal pass-through',
  },
]

export const DRIVER_MODULE_TYPES = new Set(DRIVER_ANCHOR_LOGIC.map((p) => p.anchorId))

export function isDriverModule(moduleType: string): boolean {
  return DRIVER_MODULE_TYPES.has(moduleType)
}
