import type { WireConnection } from '../../modules/types'
import { resolveLogicModule } from '../../modules/logicModule'
import { isGroundReference } from './terminals'
import type { GridCellLike, SolvedComponentState } from './types'
import { omitPwm, posKey } from './utils'
import { isNetGrounded } from './nets'
import { isMicrocontrollerModule } from './components/registry'

interface PropagateContext {
  gridData: GridCellLike[][]
  wires: WireConnection[]
  posToNet: Map<string, number>
  netVoltages: number[]
  groundNet: number
  activeNets: Set<number>
  componentStates: Map<string, SolvedComponentState>
  totalCurrent: number
}

/** Map every grid position to its solved electrical net voltage. */
export function buildNodeVoltages(
  posToNet: Map<string, number>,
  netVoltages: number[],
  activeNets: Set<number>
): Map<string, number> {
  const nodeVoltages = new Map<string, number>()
  posToNet.forEach((net, key) => {
    if (!activeNets.has(net)) {
      nodeVoltages.set(key, 0)
      return
    }
    nodeVoltages.set(key, netVoltages[net] ?? 0)
  })
  return nodeVoltages
}

function voltageAt(ctx: PropagateContext, x: number, y: number): number {
  const net = ctx.posToNet.get(posKey(x, y))
  if (net === undefined || !ctx.activeNets.has(net)) return 0
  return ctx.netVoltages[net] ?? 0
}

function pointGrounded(ctx: PropagateContext, x: number, y: number): boolean {
  const net = ctx.posToNet.get(posKey(x, y))
  return isNetGrounded(net, ctx.groundNet, ctx.gridData, ctx.posToNet)
}

/**
 * Assign voltage to every wire segment endpoint and every component pin.
 * Each segment gets the voltage of its electrical node — not a wire-level max.
 */
export function propagateVoltages(ctx: PropagateContext): {
  nodeVoltages: Map<string, number>
  updatedWires: WireConnection[]
} {
  const nodeVoltages = buildNodeVoltages(ctx.posToNet, ctx.netVoltages, ctx.activeNets)

  const updatedWires = ctx.wires.map((wire) => {
    let wirePWM: number | undefined
    let isPowered = false
    let isGrounded = false
    let maxVoltage = 0
    let minVoltage = Infinity

    const segments = wire.segments.map((segment) => {
      const fromV = voltageAt(ctx, segment.from.x, segment.from.y)
      const toV = voltageAt(ctx, segment.to.x, segment.to.y)
      const segmentVoltage = fromV

      maxVoltage = Math.max(maxVoltage, fromV, toV)
      minVoltage = Math.min(minVoltage, fromV, toV)

      if (fromV > 0.1 || toV > 0.1) isPowered = true
      if (pointGrounded(ctx, segment.from.x, segment.from.y)) isGrounded = true
      if (pointGrounded(ctx, segment.to.x, segment.to.y)) isGrounded = true

      for (const point of [segment.from, segment.to]) {
        const cell = ctx.gridData[point.y]?.[point.x]
        if (cell?.occupied && cell.componentId) {
          const state = ctx.componentStates.get(`${cell.componentId}-${cell.cellIndex ?? 0}`)
          if (state?.pwm !== undefined) wirePWM = state.pwm
        }
      }

      return {
        ...omitPwm(segment),
        voltage: segmentVoltage,
        current: isPowered ? ctx.totalCurrent : 0,
        power: segmentVoltage * (isPowered ? ctx.totalCurrent : 0),
        isPowered: fromV > 0.1 || toV > 0.1,
        isGrounded: pointGrounded(ctx, segment.from.x, segment.from.y) || pointGrounded(ctx, segment.to.x, segment.to.y),
        ...(wirePWM !== undefined ? { pwm: wirePWM } : {}),
      }
    })

    const wireVoltage = isPowered ? maxVoltage : 0

    return {
      ...omitPwm(wire),
      voltage: wireVoltage,
      current: isPowered ? ctx.totalCurrent : 0,
      power: wireVoltage * (isPowered ? ctx.totalCurrent : 0),
      isPowered,
      isGrounded,
      isPowerable: isPowered,
      isGroundable: isGrounded,
      segments,
      ...(wirePWM !== undefined ? { pwm: wirePWM } : {}),
    }
  })

  ctx.posToNet.forEach((net, key) => {
    if (!ctx.activeNets.has(net)) return
    const [x, y] = key.split(',').map(Number)
    const cell = ctx.gridData[y]?.[x]
    if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) return

    const cellComponentId = `${cell.componentId}-${cell.cellIndex ?? 0}`
    const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
    const moduleType = resolveLogicModule(cell.moduleDefinition)
    const v = ctx.netVoltages[net] ?? 0
    const grounded = isGroundReference(moduleCell) || isNetGrounded(net, ctx.groundNet, ctx.gridData, ctx.posToNet)

    const existing = ctx.componentStates.get(cellComponentId)
    // GPIO outputs are authored by the MCU stamp — do not overwrite pwm/status here.
    if (
      isMicrocontrollerModule(cell.moduleDefinition) &&
      (moduleCell.type === 'GPIO' || moduleCell.type === 'ANALOG')
    ) {
      return
    }
    // Semiconductors and loads get full state from the solver — only fill in if missing.
    const specialized = new Set([
      'Resistor',
      'LED',
      'Diode',
      'ZenerDiode',
      'NPNTransistor',
      'MOSFET',
      'OpAmp',
      'BridgeRectifier',
      'Capacitor',
    ])
    if (existing && specialized.has(moduleType)) return

    if (existing) {
      ctx.componentStates.set(cellComponentId, {
        ...existing,
        outputVoltage: grounded && isGroundReference(moduleCell) ? 0 : v,
        isPowered: !grounded && v > 0.1,
        isGrounded: grounded,
        status: grounded ? 'grounded' : v > 0.1 ? 'active' : 'unpowered',
      })
    } else {
      ctx.componentStates.set(cellComponentId, {
        componentId: cellComponentId,
        componentType: cell.moduleDefinition.module,
        position: { x, y },
        outputVoltage: grounded ? 0 : v,
        outputCurrent: 0,
        power: 0,
        status: grounded ? 'grounded' : v > 0.1 ? 'active' : 'unpowered',
        isPowered: !grounded && v > 0.1,
        isGrounded: grounded,
      })
    }
  })

  return { nodeVoltages, updatedWires }
}
