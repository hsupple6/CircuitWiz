import { useTheme } from '../contexts/ThemeContext'
import { WireConnection } from '../modules/types'

interface ProjectPreviewProps {
  gridData?: unknown[][]
  wires?: WireConnection[]
  className?: string
}

export function ProjectPreview({ gridData, wires = [], className = '' }: ProjectPreviewProps) {
  const { isDark } = useTheme()

  const getPreviewData = () => {
    if (!gridData || gridData.length === 0) return []

    const gridWidth = gridData[0]?.length || 0
    const gridHeight = gridData.length
    if (gridWidth === 0 || gridHeight === 0) return []

    const centerX = Math.floor(gridWidth / 2)
    const centerY = Math.floor(gridHeight / 2)
    const previewSize = 8
    const startX = Math.max(0, centerX - previewSize / 2)
    const startY = Math.max(0, centerY - previewSize / 2)
    const endX = Math.min(gridWidth, startX + previewSize)
    const endY = Math.min(gridHeight, startY + previewSize)

    const previewData = []
    for (let y = startY; y < endY; y++) {
      const row = []
      for (let x = startX; x < endX; x++) {
        row.push((gridData[y] as Record<string, unknown>[])?.[x] || { occupied: false })
      }
      previewData.push(row)
    }
    return previewData
  }

  const previewData = getPreviewData()

  const getCellBackground = (cell: Record<string, unknown>) => {
    if (!cell.occupied) return 'transparent'
    const colorMap: Record<string, string> = {
      ArduinoUno: '#4F46E5',
      ESP32: '#059669',
      LED: '#141414',
      Resistor: '#141414',
      Capacitor: '#141414',
      Inductor: '#141414',
      Diode: '#141414',
      ZenerDiode: '#141414',
      NPNTransistor: '#1a1a1a',
      OpAmp: '#1a1a2a',
      BridgeRectifier: '#1a1a1a',
      ACSource: '#4a4a8a',
      Battery: '#10B981',
      PowerSupply: '#3B82F6',
      Switch: '#8B5CF6',
      TemperatureSensor: '#06B6D4',
    }
    return colorMap[cell.componentType as string] || '#6B7280'
  }

  if (previewData.length === 0) {
    return (
      <div className={`relative ${className} flex items-center justify-center`}>
        <div className="text-center opacity-50">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Empty</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${isDark ? '#d1d5db' : '#9ca3af'} 1px, transparent 1px),
            linear-gradient(to bottom, ${isDark ? '#d1d5db' : '#9ca3af'} 1px, transparent 1px)
          `,
          backgroundSize: '12.5% 12.5%',
        }}
      />
      <div className="relative grid grid-cols-8 gap-0 h-full">
        {previewData.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className="aspect-square"
              style={{
                backgroundColor: getCellBackground(cell),
                opacity: cell.occupied ? 0.8 : 0,
              }}
            />
          ))
        )}
      </div>
      {wires.length > 0 && (
        <svg className="absolute inset-0 w-full h-full">
          {wires.slice(0, 5).map((wire, wireIndex) =>
            wire.segments.slice(0, 3).map((segment, segmentIndex) => {
              const gridWidth = gridData?.[0]?.length || 0
              const gridHeight = gridData?.length || 0
              if (gridWidth === 0 || gridHeight === 0) return null

              const centerX = Math.floor(gridWidth / 2)
              const centerY = Math.floor(gridHeight / 2)
              const previewSize = 8
              const startX = Math.max(0, centerX - previewSize / 2)
              const startY = Math.max(0, centerY - previewSize / 2)

              const { from, to } = segment
              if (
                from.x < startX || from.x >= startX + previewSize ||
                from.y < startY || from.y >= startY + previewSize ||
                to.x < startX || to.x >= startX + previewSize ||
                to.y < startY || to.y >= startY + previewSize
              ) return null

              const startXPercent = ((from.x - startX) / previewSize) * 100
              const startYPercent = ((from.y - startY) / previewSize) * 100
              const endXPercent = ((to.x - startX) / previewSize) * 100
              const endYPercent = ((to.y - startY) / previewSize) * 100

              return (
                <line
                  key={`wire-${wireIndex}-${segmentIndex}`}
                  x1={`${startXPercent}%`}
                  y1={`${startYPercent}%`}
                  x2={`${endXPercent}%`}
                  y2={`${endYPercent}%`}
                  stroke={segment.color || '#666666'}
                  strokeWidth="2"
                  opacity="0.6"
                />
              )
            })
          )}
        </svg>
      )}
    </div>
  )
}
