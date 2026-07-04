import type { SolvedComponentState } from './types'

export function resolveLedModuleState(
  componentId: string,
  componentStates: Map<string, SolvedComponentState>
): SolvedComponentState | undefined {
  const anode = componentStates.get(`${componentId}-0`)
  if (anode) return anode
  for (const suffix of ['-1', '-2']) {
    const state = componentStates.get(`${componentId}${suffix}`)
    if (state) return state
  }
  return undefined
}

/** Keep anode isOn/V/I on every LED cell so the body indicator and hover stay in sync. */
export function syncLedComponentStates(
  componentStates: Map<string, SolvedComponentState>
): void {
  const ledGroups = new Map<string, SolvedComponentState[]>()

  componentStates.forEach((state, key) => {
    if (state.componentType !== 'LED') return
    const baseId = key.replace(/-\d+$/, '')
    if (!ledGroups.has(baseId)) ledGroups.set(baseId, [])
    ledGroups.get(baseId)!.push(state)
  })

  ledGroups.forEach((cells) => {
    const anode =
      cells.find((cell) => cell.componentId.endsWith('-0')) ??
      cells.find((cell) => cell.isOn) ??
      cells[0]
    if (!anode) return

    cells.forEach((cell) => {
      if (cell === anode) return
      componentStates.set(cell.componentId, {
        ...cell,
        isOn: anode.isOn,
        isPowered: anode.isPowered,
        status: anode.status,
        inputVoltage: anode.inputVoltage,
        outputCurrent: anode.outputCurrent,
        forwardVoltage: anode.forwardVoltage,
        outputVoltage: anode.isOn ? (anode.inputVoltage ?? anode.outputVoltage) : 0,
        power: anode.power,
      })
    })
  })
}
