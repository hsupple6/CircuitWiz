import { parseNumericProperty, posKey } from './utils'
import type { PlacedComponent } from './types'

type ResistorStamp = {
  netA: number
  netB: number
  resistance: number
  componentId: string
}

type VoltageSourceStamp = {
  netPos: number
  netNeg: number
  voltage: number
  componentId: string
}

type TerminalLike = {
  x: number
  y: number
  moduleCell: {
    type?: string
    pin?: string
    isPowerable?: boolean
    isGroundable?: boolean
    voltage?: number
  }
}

function findTerminal(
  terminals: TerminalLike[],
  pred: (t: TerminalLike) => boolean
): TerminalLike | undefined {
  return terminals.find(pred)
}

function stampResistor(
  resistors: ResistorStamp[],
  netA: number,
  netB: number,
  resistance: number,
  componentId: string
): void {
  if (netA === netB) return
  resistors.push({ netA, netB, resistance, componentId })
}

export function collectLiIonPackStamps(
  component: PlacedComponent,
  terminals: TerminalLike[],
  posToNet: Map<string, number>
): { voltageSources: VoltageSourceStamp[]; resistors: ResistorStamp[]; errors: string[] } {
  const voltageSources: VoltageSourceStamp[] = []
  const resistors: ResistorStamp[] = []
  const errors: string[] = []

  const pPos = findTerminal(terminals, (t) => t.moduleCell.pin === 'P+')
  const pNeg = findTerminal(terminals, (t) => t.moduleCell.pin === 'P−' || t.moduleCell.pin === 'P-')
  const chgPos = findTerminal(terminals, (t) => t.moduleCell.pin === 'CHG+')
  const chgNeg = findTerminal(terminals, (t) => t.moduleCell.pin === 'CHG−' || t.moduleCell.pin === 'CHG-')

  if (!pPos || !pNeg) {
    errors.push(`LiIonPack ${component.componentId} is missing P+/P− terminals`)
    return { voltageSources, resistors, errors }
  }

  const netPos = posToNet.get(posKey(pPos.x, pPos.y))
  const netNeg = posToNet.get(posKey(pNeg.x, pNeg.y))
  if (netPos === undefined || netNeg === undefined) return { voltageSources, resistors, errors }

  const props = component.moduleDefinition.properties ?? {}
  const seriesCells = parseNumericProperty(
    props.seriesCells,
    parseNumericProperty(props.cellCount, 1)
  )
  const nominalPerCell = parseNumericProperty(props.nominalVoltage, 3.7)
  const voltage = seriesCells * nominalPerCell

  voltageSources.push({
    netPos,
    netNeg,
    voltage,
    componentId: component.componentId,
  })

  const tieR = 0.01
  if (chgPos) {
    const netChgPos = posToNet.get(posKey(chgPos.x, chgPos.y))
    if (netChgPos !== undefined) {
      stampResistor(resistors, netChgPos, netPos, tieR, `${component.componentId}_chg_pos`)
    }
  }
  if (chgNeg) {
    const netChgNeg = posToNet.get(posKey(chgNeg.x, chgNeg.y))
    if (netChgNeg !== undefined) {
      stampResistor(resistors, netChgNeg, netNeg, tieR, `${component.componentId}_chg_neg`)
    }
  }

  return { voltageSources, resistors, errors }
}

export function collectChargerProtectionStamps(
  component: PlacedComponent,
  terminals: TerminalLike[],
  posToNet: Map<string, number>
): { resistors: ResistorStamp[]; errors: string[] } {
  const resistors: ResistorStamp[] = []
  const errors: string[] = []

  const batPos = findTerminal(terminals, (t) => t.moduleCell.pin === 'BAT+')
  const batNeg = findTerminal(terminals, (t) => t.moduleCell.pin === 'BAT−' || t.moduleCell.pin === 'BAT-')
  const outPos = findTerminal(terminals, (t) => t.moduleCell.pin === 'OUT+')
  const outNeg = findTerminal(terminals, (t) => t.moduleCell.pin === 'OUT−' || t.moduleCell.pin === 'OUT-')

  if (!batPos || !batNeg || !outPos || !outNeg) {
    errors.push(`ChargerProtection ${component.componentId} is missing BAT± or OUT± terminals`)
    return { resistors, errors }
  }

  const netBatPos = posToNet.get(posKey(batPos.x, batPos.y))
  const netBatNeg = posToNet.get(posKey(batNeg.x, batNeg.y))
  const netOutPos = posToNet.get(posKey(outPos.x, outPos.y))
  const netOutNeg = posToNet.get(posKey(outNeg.x, outNeg.y))
  if (
    netBatPos === undefined ||
    netBatNeg === undefined ||
    netOutPos === undefined ||
    netOutNeg === undefined
  ) {
    return { resistors, errors }
  }

  const r = parseNumericProperty(component.moduleDefinition.properties?.seriesResistance, 0.02)
  stampResistor(resistors, netBatPos, netOutPos, r, `${component.componentId}_pos`)
  stampResistor(resistors, netBatNeg, netOutNeg, r, `${component.componentId}_neg`)

  return { resistors, errors }
}
