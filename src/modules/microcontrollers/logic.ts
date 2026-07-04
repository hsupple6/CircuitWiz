import type { AnchorLogicProfile } from '../core/anchorLogic'

export const MICROCONTROLLER_ANCHOR_LOGIC: AnchorLogicProfile[] = [
  {
    anchorId: 'Arduino Uno R3',
    domain: 'microcontrollers',
    category: 'microcontrollers',
    kicadSymbol: 'MCU_Module/Arduino_UNO_R3.kicad_sym',
    chain: 'systems/chain/components/registry.ts → mcuInternalEdges',
    sim: 'systems/chain/solver/engine.ts → MCU GPIO bleed',
    voltageFlow: 'microcontrollers/voltageFlow/Microcontroller.tsx',
  },
  {
    anchorId: 'ESP32',
    domain: 'microcontrollers',
    category: 'microcontrollers',
    kicadSymbol: 'MCU_Module/Adafruit_Feather_HUZZAH32_ESP32.kicad_sym',
    chain: 'same as Arduino',
    sim: 'same as Arduino (3.3 V GPIO)',
    voltageFlow: 'microcontrollers/voltageFlow/Microcontroller.tsx',
  },
]
