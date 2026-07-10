import type { CSSProperties } from 'react'
import type { ModuleDefinition } from '../modules/types'
import {
  getExteriorBorderStyle,
  getSchematicPinLayout,
  type PinEdge,
} from '../utils/schematicPinLayout'
import {
  buildSchematicModuleLabel,
  formatSchematicModuleSpecLine,
  type PlacedModuleValues,
} from '../utils/schematicModuleLabel'
import { SchematicBodyOverlay } from './SchematicBodyOverlay'
import type { ComponentState } from '../systems/ElectricalSystem'

interface SchematicStyleCellProps {
  definition: ModuleDefinition
  relativeX: number
  relativeY: number
  isPowered?: boolean
  isHighlighted?: boolean
  isHoveredForDeletion?: boolean
  borderColor?: string
  placedValues?: PlacedModuleValues
  componentId?: string
  cellIndex?: number
  cellProperties?: Record<string, unknown>
  componentStates?: Map<string, ComponentState>
}

function pinLabelPosition(edge: PinEdge): CSSProperties {
  switch (edge) {
    case 'left':
      return {
        right: '108%',
        top: '38%',
        transform: 'translateY(calc(-50% - 2px))',
        textAlign: 'right',
      }
    case 'right':
      return {
        left: '108%',
        top: '38%',
        transform: 'translateY(calc(-50% - 2px))',
        textAlign: 'left',
      }
    case 'top':
      return {
        bottom: '118%',
        left: '50%',
        transform: 'translate(calc(-50% + 0px), -2px)',
        textAlign: 'center',
      }
    case 'bottom':
      return {
        top: '100%',
        left: '50%',
        transform: 'translate(calc(-50% + 0px), -2px)',
        textAlign: 'center',
      }
  }
}

function PinDot() {
  return (
    <div
      className="schematic-pin-dot pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      aria-hidden
    />
  )
}

function SchematicModuleHeader({
  definition,
  placedValues,
}: {
  definition: ModuleDefinition
  placedValues?: PlacedModuleValues
}) {
  const { name, specs } = buildSchematicModuleLabel(definition, placedValues)
  const specLine = formatSchematicModuleSpecLine(specs)

  return (
    <div
      className="schematic-module-label pointer-events-none absolute bottom-full right-0 z-[2] mb-0.5 text-right leading-tight"
      style={{ width: `${definition.gridX * 100}%` }}
    >
      <div className="schematic-module-label-name truncate">{name}</div>
      {specLine ? <div className="schematic-module-label-specs truncate">{specLine}</div> : null}
    </div>
  )
}

export function SchematicStyleCell({
  definition,
  relativeX,
  relativeY,
  isPowered = false,
  isHighlighted = false,
  isHoveredForDeletion = false,
  borderColor = 'var(--schematic-outline-border, #334155)',
  placedValues,
  componentId,
  cellIndex,
  cellProperties,
  componentStates,
}: SchematicStyleCellProps) {
  const pin = getSchematicPinLayout(definition, relativeX, relativeY)
  const borders = getExteriorBorderStyle(definition, relativeX, relativeY, borderColor)
  const isModuleOrigin = relativeX === 0 && relativeY === 0

  return (
    <div
      className="schematic-style-cell absolute inset-0"
      style={{
        background: 'var(--schematic-cell-fill, #e8dcc8)',
        ...borders,
        ...(isHighlighted && {
          boxShadow: 'inset 0 0 0 2px rgb(59 130 246 / 0.45)',
        }),
        ...(isHoveredForDeletion && {
          boxShadow: 'inset 0 0 0 2px rgb(239 68 68 / 0.55)',
        }),
      }}
    >
      {isModuleOrigin ? (
        <SchematicModuleHeader definition={definition} placedValues={placedValues} />
      ) : null}
      {componentId && componentStates ? (
        <SchematicBodyOverlay
          definition={definition}
          relativeX={relativeX}
          relativeY={relativeY}
          componentId={componentId}
          placedCell={{
            resistance: placedValues?.resistance,
            capacitance: placedValues?.capacitance,
            inductance: placedValues?.inductance,
            properties: cellProperties,
            cellIndex,
          }}
          componentStates={componentStates}
        />
      ) : null}
      {pin ? (
        <>
          <PinDot />
          <span
            className="schematic-pin-label pointer-events-none absolute whitespace-nowrap"
            style={pinLabelPosition(pin.edge)}
          >
            {pin.label}
          </span>
        </>
      ) : null}

      {isPowered ? (
        <div className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
      ) : null}
    </div>
  )
}
