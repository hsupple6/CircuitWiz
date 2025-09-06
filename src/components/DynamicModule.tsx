import React from 'react'
import { ModuleDefinition } from '../modules/types'

interface DynamicModuleProps {
  definition: ModuleDefinition
  className?: string
  style?: React.CSSProperties
}

export function DynamicModule({ definition, className = '', style = {} }: DynamicModuleProps) {
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
            {cell.pin && (
              <span className="text-white font-bold text-xs leading-none">
                {cell.pin}
              </span>
            )}
            
            {/* Connection Indicator */}
            {cell.isConnectable && (
              <div className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full opacity-60" />
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
    const [property, value] = decl.split(':').map(s => s.trim())
    if (property && value) {
      const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      
      // Handle specific CSS properties
      switch (camelProperty) {
        case 'borderRadius':
          styles.borderRadius = value
          break
        case 'background':
          if (value.includes('gradient')) {
            // For gradients, we'll use a fallback color
            const colorMatch = value.match(/#[0-9A-Fa-f]{6}/)
            if (colorMatch) {
              styles.background = colorMatch[0]
            }
          } else {
            styles.background = value
          }
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
