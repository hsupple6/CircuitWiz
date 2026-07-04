import type { WireConnection } from '../../modules/types'
import { resolveLogicModule } from '../../modules/logicModule'
import type { GridCellLike, SolvedComponentState } from './types'
import {
  gpioOutputVoltage,
  gpioPinNumber,
  isMicrocontrollerModule,
} from './components/registry'

/** Stamp live GPIO/PWM states onto MCU pins even when the full circuit cannot be solved. */
export function applyGpioComponentStates(
  gridData: GridCellLike[][],
  gpioStates: Map<number, unknown>,
  componentStates: Map<string, SolvedComponentState>
): void {
  if (gpioStates.size === 0) return

  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (!cell?.occupied || !cell.moduleDefinition || cell.componentId === undefined) return
      if (!isMicrocontrollerModule(cell.moduleDefinition)) return

      const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
      if (moduleCell.type !== 'GPIO' && moduleCell.type !== 'ANALOG') return

      const pin = gpioPinNumber(moduleCell)
      if (pin === null) return

      const gpioState = gpioStates.get(pin) as { state?: string; value?: number } | undefined
      if (!gpioState) return

      const moduleType = resolveLogicModule(cell.moduleDefinition)
      const output = gpioOutputVoltage(moduleType, gpioState)
      const isPwm = gpioState.state === 'PULSING'
      const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`

      componentStates.set(cellComponentId, {
        componentId: cellComponentId,
        componentType: moduleType,
        position: { x, y },
        outputVoltage: output.active ? (moduleType.includes('ESP32') ? 3.3 : 5.0) : 0,
        outputCurrent: 0,
        power: 0,
        status: isPwm && output.active ? 'pwm' : output.active ? 'active' : 'inactive',
        isPowered: output.active,
        isGrounded: false,
        ...(isPwm && output.pwm !== undefined ? { pwm: output.pwm } : {}),
      })
    })
  })
}

/** Carry PWM hints onto wires that touch an active MCU GPIO pin. */
export function applyGpioWireHints(
  gridData: GridCellLike[][],
  wires: WireConnection[],
  gpioStates: Map<number, unknown>
): WireConnection[] {
  if (gpioStates.size === 0) return wires

  return wires.map((wire) => {
    let wirePWM: number | undefined

    const segments = wire.segments.map((segment) => {
      let segPwm: number | undefined

      for (const pt of [segment.from, segment.to]) {
        const cell = gridData[pt.y]?.[pt.x]
        if (!cell?.occupied || !cell.moduleDefinition || !isMicrocontrollerModule(cell.moduleDefinition)) {
          continue
        }
        const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
        if (moduleCell.type !== 'GPIO' && moduleCell.type !== 'ANALOG') continue

        const pin = gpioPinNumber(moduleCell)
        if (pin === null) continue

        const gpioState = gpioStates.get(pin) as { state?: string; value?: number } | undefined
        if (!gpioState) continue
        if (gpioState.state !== 'PULSING' && gpioState.state !== 'HIGH') continue

        const duty = gpioState.state === 'PULSING' ? (gpioState.value ?? 0.5) * 100 : 100
        segPwm = duty
        wirePWM = duty
      }

      if (segPwm === undefined) return segment
      return {
        ...segment,
        isPowered: true,
        pwm: segPwm,
      }
    })

    if (wirePWM === undefined) return wire
    return {
      ...wire,
      isPowered: true,
      pwm: wirePWM,
      segments,
    }
  })
}
