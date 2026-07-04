import React from 'react'
import { ModuleDefinition } from '../modules/types'
import { resolveLogicModule } from '../modules/logicModule'
import { InductorBodyLabel } from './InductorBodyLabel'
import { CapacitorBodyLabel } from './CapacitorBodyLabel'
import { ResistorBodyLabel } from './ResistorBodyLabel'
import { LedBodyIndicator, resolveLedColor } from './LedBodyIndicator'
import { ACSourceBodyLabel } from './ACSourceBodyLabel'
import { DiodeBodyLabel } from './DiodeBodyLabel'
import { ZenerDiodeBodyLabel } from './ZenerDiodeBodyLabel'
import { TransistorBodyLabel } from './TransistorBodyLabel'
import { PnpTransistorBodyLabel } from './PnpTransistorBodyLabel'
import { MosfetBodyLabel } from './MosfetBodyLabel'
import { PmosfetBodyLabel } from './PmosfetBodyLabel'
import { RgbLedBodyIndicator } from './RgbLedBodyIndicator'
import { StepperCoilPad } from './StepperCoilPad'
import { StepperBodyLabel } from './StepperBodyLabel'
import { OpAmpBodyLabel } from './OpAmpBodyLabel'
import { BridgeRectifierBodyLabel } from './BridgeRectifierBodyLabel'
import { SemiconductorPinPad } from './SemiconductorPinPad'
import { getDisplayPin } from '../utils/smdVisual'
import { resolveCellResistance } from '../utils/resistorVisual'

interface DynamicModuleProps {
  definition: ModuleDefinition
  className?: string
  style?: React.CSSProperties
}

export function DynamicModule({ definition, className = '', style = {} }: DynamicModuleProps) {
  const logicName = resolveLogicModule(definition)

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: `${definition.gridX * 5}vw`,
        height: `${definition.gridY * 5}vw`,
        minWidth: `${definition.gridX * 20}px`,
        minHeight: `${definition.gridY * 20}px`,
        background: definition.background || '#6B7280',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
        ...style
      }}
    >
      {/* Module Grid */}
      <div className="absolute inset-0 grid" style={{
        gridTemplateColumns: `repeat(${definition.gridX}, 1fr)`,
        gridTemplateRows: `repeat(${definition.gridY}, 1fr)`,
        gap: '1px'
      }}>
        {definition.grid.map((cell, index) => (
          <div
            key={`${cell.x}-${cell.y}`}
            className={`
              flex items-center justify-center text-xs font-medium
              border border-gray-200 dark:border-dark-border
              ${cell.isConnectable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
              transition-all duration-200
            `}
            style={{
              background: cell.background || definition.background || '#6B7280',
              ...(cell.css ? parseInlineCSS(cell.css) : {}),
              position: 'relative'
            }}
            title={`
              ${cell.pin || 'Pin'} - ${cell.type}
              ${cell.properties?.voltage ? `\nVoltage: ${cell.properties.voltage}` : ''}
              ${cell.properties?.current ? `\nCurrent: ${cell.properties.current}` : ''}
              ${cell.properties?.function ? `\nFunction: ${cell.properties.function}` : ''}
            `}
          >
            {/* Pin Label */}
            {getDisplayPin(definition.module, cell.pin, definition.logicModule) && (
              <span className="text-white font-bold text-xs leading-none">
                {getDisplayPin(definition.module, cell.pin, definition.logicModule)}
              </span>
            )}
            
            {/* Connection Indicator */}
            {cell.isConnectable && (
              <div className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full opacity-60" />
            )}
            
            {/* Group box preview label */}
            {logicName === 'Group Box' && cell.x === 0 && cell.y === 0 && (
              <div className="absolute top-0.5 left-1 text-[8px] font-semibold text-indigo-600 bg-white/70 px-1 rounded">
                Region
              </div>
            )}
            
            {/* SMD resistor label on body */}
            {logicName === 'Resistor' && cell.type === 'BODY' && cell.x === 1 && cell.y === 0 && (
              <ResistorBodyLabel
                compact
                resistance={resolveCellResistance(
                  (cell as { resistance?: number }).resistance
                )}
              />
            )}
            
            {/* SMD capacitor label on body */}
            {logicName === 'Capacitor' && cell.type === 'BODY' && cell.x === 1 && cell.y === 0 && (
              <CapacitorBodyLabel
                compact
                capacitance={(cell as { capacitance?: number }).capacitance ?? 0.0001}
              />
            )}
            
            {/* SMD inductor label on body */}
            {logicName === 'Inductor' && cell.type === 'BODY' && cell.x === 1 && cell.y === 0 && (
              <InductorBodyLabel
                compact
                inductance={(cell as { inductance?: number }).inductance ?? 0.001}
              />
            )}
            
            {/* SMD LED indicator on body */}
            {logicName === 'LED' && cell.type === 'LED_BODY' && cell.x === 1 && cell.y === 0 && (
              <LedBodyIndicator
                compact
                color={resolveLedColor(
                  definition.properties as Record<string, unknown> | undefined,
                  cell.properties
                )}
                isOn={false}
              />
            )}

            {logicName === 'Diode' && cell.type === 'BODY' && cell.x === 1 && cell.y === 0 && (
              <DiodeBodyLabel compact forwardVoltage={0.7} />
            )}

            {logicName === 'ACSource' && cell.x === 0 && cell.y === 0 && (
              <ACSourceBodyLabel
                compact
                properties={definition.properties as Record<string, unknown> | undefined}
              />
            )}

            {logicName === 'ZenerDiode' && cell.type === 'BODY' && cell.x === 1 && cell.y === 0 && (
              <ZenerDiodeBodyLabel compact zenerVoltage={5.1} />
            )}

            {logicName === 'NPNTransistor' && cell.x === 1 && cell.y === 0 && (
              <SemiconductorPinPad label="C" edge="top" />
            )}
            {logicName === 'NPNTransistor' && cell.x === 0 && cell.y === 1 && (
              <SemiconductorPinPad label="B" edge="left" />
            )}
            {logicName === 'NPNTransistor' && cell.x === 1 && cell.y === 2 && (
              <SemiconductorPinPad label="E" edge="bottom" />
            )}
            {logicName === 'NPNTransistor' && cell.x === 1 && cell.y === 1 && (
              <TransistorBodyLabel />
            )}

            {logicName === 'MOSFET' && cell.x === 1 && cell.y === 0 && (
              <SemiconductorPinPad label="D" edge="top" />
            )}
            {logicName === 'MOSFET' && cell.x === 0 && cell.y === 1 && (
              <SemiconductorPinPad label="G" edge="left" />
            )}
            {logicName === 'MOSFET' && cell.x === 1 && cell.y === 2 && (
              <SemiconductorPinPad label="S" edge="bottom" />
            )}
            {logicName === 'MOSFET' && cell.x === 1 && cell.y === 1 && (
              <MosfetBodyLabel />
            )}

            {logicName === 'PNPTransistor' && cell.x === 1 && cell.y === 0 && (
              <SemiconductorPinPad label="C" edge="top" />
            )}
            {logicName === 'PNPTransistor' && cell.x === 0 && cell.y === 1 && (
              <SemiconductorPinPad label="B" edge="left" />
            )}
            {logicName === 'PNPTransistor' && cell.x === 1 && cell.y === 2 && (
              <SemiconductorPinPad label="E" edge="bottom" />
            )}
            {logicName === 'PNPTransistor' && cell.x === 1 && cell.y === 1 && (
              <PnpTransistorBodyLabel />
            )}

            {logicName === 'PMOSFET' && cell.x === 1 && cell.y === 0 && (
              <SemiconductorPinPad label="D" edge="top" />
            )}
            {logicName === 'PMOSFET' && cell.x === 0 && cell.y === 1 && (
              <SemiconductorPinPad label="G" edge="left" />
            )}
            {logicName === 'PMOSFET' && cell.x === 1 && cell.y === 2 && (
              <SemiconductorPinPad label="S" edge="bottom" />
            )}
            {logicName === 'PMOSFET' && cell.x === 1 && cell.y === 1 && (
              <PmosfetBodyLabel />
            )}

            {logicName === 'RGBLED' && cell.type === 'RGB_LED_BODY' && cell.x === 2 && cell.y === 0 && (
              <RgbLedBodyIndicator compact rOn gOn bOn />
            )}

            {logicName === 'OpAmp' && cell.x === 1 && cell.y === 0 && (
              <SemiconductorPinPad label="V+" edge="top" />
            )}
            {logicName === 'OpAmp' && cell.x === 0 && cell.y === 1 && (
              <SemiconductorPinPad label="−" edge="left" />
            )}
            {logicName === 'OpAmp' && cell.x === 2 && cell.y === 1 && (
              <SemiconductorPinPad label="OUT" edge="right" />
            )}
            {logicName === 'OpAmp' && cell.x === 0 && cell.y === 2 && (
              <SemiconductorPinPad label="+" edge="left" />
            )}
            {logicName === 'OpAmp' && cell.x === 1 && cell.y === 2 && (
              <SemiconductorPinPad label="V−" edge="bottom" />
            )}
            {logicName === 'OpAmp' && cell.x === 1 && cell.y === 1 && (
              <OpAmpBodyLabel />
            )}

            {logicName === 'BridgeRectifier' && cell.x === 0 && cell.y === 0 && (
              <SemiconductorPinPad label="AC1" edge="top" />
            )}
            {logicName === 'BridgeRectifier' && cell.x === 2 && cell.y === 0 && (
              <SemiconductorPinPad label="AC2" edge="top" />
            )}
            {logicName === 'BridgeRectifier' && cell.x === 0 && cell.y === 2 && (
              <SemiconductorPinPad label="−" edge="bottom" />
            )}
            {logicName === 'BridgeRectifier' && cell.x === 2 && cell.y === 2 && (
              <SemiconductorPinPad label="+" edge="bottom" />
            )}
            {logicName === 'BridgeRectifier' && cell.x === 1 && cell.y === 1 && (
              <BridgeRectifierBodyLabel />
            )}
            
            {/* Motor label (for preview) */}
            {logicName === 'Motor' && cell.type === 'BODY' && cell.x === 1 && cell.y === 1 && (
              <div className="absolute inset-0 flex items-end justify-center pb-1">
                <div className="text-white text-xs font-bold bg-black bg-opacity-70 px-1 rounded">
                  Motor
                </div>
              </div>
            )}

            {logicName === 'StepperMotor' && cell.y === 0 && ['A+', 'A-', 'B+', 'B-'].includes(cell.pin ?? '') && (
              <StepperCoilPad
                label={cell.pin as 'A+' | 'A-' | 'B+' | 'B-'}
              />
            )}
            {logicName === 'StepperMotor' && cell.x === 1 && cell.y === 1 && (
              <StepperBodyLabel coilAActive={false} coilBActive={false} />
            )}
          </div>
        ))}
      </div>
      
      {/* Module Label */}
      <div className="absolute -bottom-6 left-0 right-0 text-center">
        <span className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary bg-white dark:bg-dark-surface px-2 py-1 rounded shadow-sm">
          {definition.module}
        </span>
      </div>
    </div>
  )
}

// Helper function to parse inline CSS strings into React styles
function parseInlineCSS(cssString: string): React.CSSProperties {
  const styles: React.CSSProperties = {}
  
  // Simple CSS parser - handles basic properties
  const declarations = cssString.split(';').filter(decl => decl.trim())
  
  declarations.forEach(decl => {
    const colonIndex = decl.indexOf(':')
    if (colonIndex === -1) return
    const property = decl.slice(0, colonIndex).trim()
    const value = decl.slice(colonIndex + 1).trim()
    if (property && value) {
      const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      
      // Handle specific CSS properties
      switch (camelProperty) {
        case 'borderRadius':
          styles.borderRadius = value
          break
        case 'background':
          styles.background = value
          break
        case 'color':
          styles.color = value
          break
        case 'fontWeight':
          styles.fontWeight = value as any
          break
        case 'textAlign':
          styles.textAlign = value as any
          break
        case 'display':
          styles.display = value as any
          break
        case 'alignItems':
          styles.alignItems = value as any
          break
        case 'justifyContent':
          styles.justifyContent = value as any
          break
        case 'boxShadow':
          styles.boxShadow = value
          break
        case 'borderTopLeftRadius':
          styles.borderTopLeftRadius = value
          break
        case 'borderTopRightRadius':
          styles.borderTopRightRadius = value
          break
        case 'borderBottomLeftRadius':
          styles.borderBottomLeftRadius = value
          break
        case 'borderBottomRightRadius':
          styles.borderBottomRightRadius = value
          break
        default:
          // For unknown properties, try to set them directly
          try {
            (styles as any)[camelProperty] = value
          } catch (e) {
            // Ignore invalid properties
          }
      }
    }
  })
  
  return styles
}
