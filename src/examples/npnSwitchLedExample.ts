import type { Schematic } from '../types/workspace'
import { buildSchematic } from './schematicBuilder'

/**
 * SPST switch → NPN base bias → low-side switch → LED + series resistor.
 * Close the switch in Circuit Controls to saturate the transistor and light the LED.
 */
export function npnSwitchLedSchematic(): Schematic {
  return buildSchematic(
    'NPN Switch + LED',
    '5 V → 220 Ω → LED → NPN collector. SPST switch feeds the base through 10 kΩ. Toggle the switch in Circuit Controls — LED on when switch is closed.',
    ({ place, wire }) => {
      const ps = place('PowerSupply', 2, 10, { voltage: 5 })
      const sw = place('Switch', 6, 16)
      const rBase = place('Resistor', 10, 16, { resistance: 10_000 })
      const rPull = place('Resistor', 14, 20, { resistance: 100_000 })
      const q = place('NPNTransistor', 18, 8)
      const rLed = place('Resistor', 6, 10, { resistance: 220 })
      const led = place('LED', 10, 10)
      const gndY = 18

      wire([ps.pin('5V'), { x: 2, y: 9 }, { x: 6, y: 9 }, rLed.at(0, 0)], { powered: true, color: '#22c55e' })
      wire([rLed.at(2, 0), led.pin('+')], { color: '#a855f7' })
      wire([led.pin('-'), { x: 12, y: 10 }, { x: 12, y: 9 }, { x: 19, y: 9 }, q.pin('C')], {
        color: '#a855f7',
      })
      wire([q.pin('E'), { x: 19, y: 11 }, { x: 19, y: gndY }, { x: 3, y: gndY }, ps.pin('GND')], {
        grounded: true,
        color: '#ef4444',
      })

      wire([ps.pin('5V'), { x: 2, y: 15 }, { x: 4, y: 15 }, sw.pin('IN')], { powered: true, color: '#22c55e' })
      wire([sw.pin('OUT'), rBase.at(0, 0)], { color: '#f59e0b' })
      wire([rBase.at(2, 0), { x: 16, y: 16 }, { x: 16, y: 9 }, q.pin('B')], { color: '#f59e0b' })
      wire([q.pin('B'), { x: 16, y: 9 }, { x: 14, y: 9 }, { x: 14, y: 20 }, rPull.at(0, 0)], {
        color: '#64748b',
      })
      wire([rPull.at(2, 0), { x: 3, y: 20 }, { x: 3, y: gndY }], { grounded: true, color: '#ef4444' })
    },
    { region: { title: 'Switch closed → Ib → NPN on → LED', color: 'Amber', padding: 2 } }
  )
}
