import type { Schematic } from '../types/workspace'
import { buildSchematic } from './schematicBuilder'

const VIN = 15
const POT_R = 10_000
const DEFAULT_WIPER = 0.5

/**
 * LM317M with potentiometer feedback — A→VOUT, W→ADJ, B→GND.
 * Vout = Vref × (1 + R2/R1) where R1/R2 come from the pot divider.
 */
export function lm317PotSchematic(): Schematic {
  return buildSchematic(
    'LM317 + Potentiometer',
    '15 V → LM317M adjustable regulator. 10 kΩ pot sets Vout via ADJ divider; 1 kΩ load on output. Sweep the pot in Interactive Controls.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10, { voltage: VIN })
      const reg = place('LM317M', 8, 8)
      const pot = place('Potentiometer', 14, 12, {
        resistance: POT_R,
        wiperPosition: DEFAULT_WIPER,
      })
      const rLoad = place('Resistor', 20, 8, { resistance: 1_000 })

      wire([ps.pin('5V'), { x: 6, y: 8 }, reg.pin('VIN')], { powered: true, color: '#22c55e' })
      wire([ps.pin('GND'), reg.pin('GND')], { grounded: true, color: '#ef4444' })
      wire([reg.pin('GND'), pot.pin('B')], { grounded: true, color: '#ef4444' })
      wire([reg.pin('VOUT'), pot.pin('A')], { color: '#a855f7' })
      wire([reg.pin('ADJ'), pot.pin('W')], { color: '#f59e0b' })
      wire([reg.pin('VOUT'), rLoad.at(0, 0)], { powered: true, color: '#22c55e' })
      wire(
        [rLoad.at(2, 0), { x: 22, y: 8 }, { x: 22, y: 16 }, { x: 3, y: 16 }, ps.pin('GND')],
        { grounded: true, color: '#ef4444' }
      )
    },
    { region: { title: 'Vout = Vref × (1 + R2/R1)', color: 'Slate', padding: 2 } }
  )
}
