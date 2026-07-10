import type { ModuleDefinition } from '../modules/types'
import { resolveLogicModule } from '../modules/logicModule'
import type { ComponentState } from '../systems/ElectricalSystem'
import { resolveLedColor, resolveLedModuleState } from './LedBodyIndicator'
import { MotorBodyLabel } from './MotorBodyLabel'
import {
  CapacitorSchematicSymbol,
  InductorSchematicSymbol,
  LedSchematicSymbol,
  ResistorSchematicSymbol,
  SchematicSymbolSpan,
} from './schematic/SchematicElectricalSymbols'

export interface SchematicPlacedCell {
  resistance?: number
  capacitance?: number
  inductance?: number
  properties?: Record<string, unknown>
  cellIndex?: number
}

export function schematicBodyCell(
  definition: ModuleDefinition,
  relativeX: number,
  relativeY: number
): boolean {
  const logic = resolveLogicModule(definition)
  const { gridX, gridY } = definition

  if (logic === 'Motor' || logic === 'StepperMotor' || logic === 'Servo') {
    return relativeX === 1 && relativeY === 1
  }

  if (gridY === 1) {
    return relativeX === Math.floor(gridX / 2) && relativeY === 0
  }

  return relativeX === Math.floor(gridX / 2) && relativeY === Math.floor(gridY / 2)
}

interface SchematicBodyOverlayProps {
  definition: ModuleDefinition
  relativeX: number
  relativeY: number
  componentId: string
  placedCell: SchematicPlacedCell
  componentStates: Map<string, ComponentState>
}

export function SchematicBodyOverlay({
  definition,
  relativeX,
  relativeY,
  componentId,
  placedCell,
  componentStates,
}: SchematicBodyOverlayProps) {
  if (!schematicBodyCell(definition, relativeX, relativeY)) return null

  const logic = resolveLogicModule(definition)
  const props = (definition as ModuleDefinition & { properties?: Record<string, unknown> }).properties
  const { gridX } = definition

  switch (logic) {
    case 'Resistor':
      return (
        <SchematicSymbolSpan gridX={gridX} relativeX={relativeX}>
          <ResistorSchematicSymbol className="h-full w-full" />
        </SchematicSymbolSpan>
      )
    case 'Capacitor':
      return (
        <SchematicSymbolSpan gridX={gridX} relativeX={relativeX}>
          <CapacitorSchematicSymbol className="h-full w-full" />
        </SchematicSymbolSpan>
      )
    case 'Inductor':
      return (
        <SchematicSymbolSpan gridX={gridX} relativeX={relativeX}>
          <InductorSchematicSymbol className="h-full w-full" />
        </SchematicSymbolSpan>
      )
    case 'LED': {
      const ledState =
        resolveLedModuleState(componentId, componentStates) ??
        componentStates.get(`${componentId}-${placedCell.cellIndex ?? 0}`)
      const isOn = ledState?.isOn || false
      const isPWM = ledState?.status === 'pwm'
      const ledColor = resolveLedColor(props, placedCell.properties)

      return (
        <SchematicSymbolSpan gridX={gridX} relativeX={relativeX}>
          <LedSchematicSymbol
            className="h-full w-full"
            color={ledColor}
            isOn={isOn}
            isPWM={isPWM}
            state={ledState ?? null}
          />
        </SchematicSymbolSpan>
      )
    }
    case 'Motor':
      return (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <MotorBodyLabel state={findMotorComponentState(componentId, componentStates)} />
        </div>
      )
    default:
      return null
  }
}

function findMotorComponentState(
  componentId: string,
  componentStates: Map<string, ComponentState>
): ComponentState | null {
  for (const [key, state] of componentStates) {
    if (!key.startsWith(`${componentId}-`)) continue
    if (state.motorRPM !== undefined || state.instantaneousRPM !== undefined) return state
  }
  return null
}
