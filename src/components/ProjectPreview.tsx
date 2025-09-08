import React from 'react'
import { UserProject } from '../hooks/useUserDatabase'
import { useTheme } from '../contexts/ThemeContext'

interface ProjectPreviewProps {
  project: UserProject
  className?: string
}

export function ProjectPreview({ project, className = '' }: ProjectPreviewProps) {
  const { isDark } = useTheme()
  
  // Get the center portion of the grid for preview
  const getPreviewData = () => {
    if (!project.gridData || project.gridData.length === 0) {
      return []
    }
    
    const gridData = project.gridData
    const gridWidth = gridData[0]?.length || 0
    const gridHeight = gridData.length
    
    if (gridWidth === 0 || gridHeight === 0) {
      return []
    }
    
    const centerX = Math.floor(gridWidth / 2)
    const centerY = Math.floor(gridHeight / 2)
    
    // Get a 8x8 area around the center
    const previewSize = 8
    const startX = Math.max(0, centerX - previewSize / 2)
    const startY = Math.max(0, centerY - previewSize / 2)
    const endX = Math.min(gridWidth, startX + previewSize)
    const endY = Math.min(gridHeight, startY + previewSize)
    
    const previewData = []
    for (let y = startY; y < endY; y++) {
      const row = []
      for (let x = startX; x < endX; x++) {
        row.push(gridData[y]?.[x] || { occupied: false })
      }
      previewData.push(row)
    }
    
    return previewData
  }
  
  const previewData = getPreviewData()
  
  // Helper function to get cell background color
  const getCellBackground = (cell: any) => {
    if (!cell.occupied) return 'transparent'
    
    // Get component type and return appropriate color
    const componentType = cell.componentType
    const colorMap: { [key: string]: string } = {
      'ArduinoUno': '#4F46E5', // Indigo
      'ESP32': '#059669', // Emerald
      'LED': '#EF4444', // Red
      'Resistor': '#F59E0B', // Amber
      'Battery': '#10B981', // Green
      'PowerSupply': '#3B82F6', // Blue
      'Switch': '#8B5CF6', // Violet
      'TemperatureSensor': '#06B6D4', // Cyan
    }
    
    return colorMap[componentType] || '#6B7280' // Gray fallback
  }
  
  // If no preview data, show empty state
  if (previewData.length === 0) {
    return (
      <div className={`relative ${className} flex items-center justify-center`}>
        <div className="text-center opacity-50">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Empty Project</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Grid Background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${isDark ? '#d1d5db' : '#9ca3af'} 1px, transparent 1px),
            linear-gradient(to bottom, ${isDark ? '#d1d5db' : '#9ca3af'} 1px, transparent 1px)
          `,
          backgroundSize: '12.5% 12.5%' // 8x8 grid
        }}
      />
      
      {/* Components */}
      <div className="relative grid grid-cols-8 gap-0 h-full">
        {previewData.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className="aspect-square"
              style={{
                backgroundColor: getCellBackground(cell),
                opacity: cell.occupied ? 0.8 : 0
              }}
            />
          ))
        )}
      </div>
      
      {/* Wires Preview */}
      {project.wires && project.wires.length > 0 && (
        <svg className="absolute inset-0 w-full h-full">
          {project.wires.slice(0, 5).map((wire, wireIndex) => // Limit to 5 wires for performance
            wire.segments.slice(0, 3).map((segment, segmentIndex) => { // Limit to 3 segments per wire
              // Calculate relative positions within the preview area
              const gridWidth = project.gridData?.[0]?.length || 0
              const gridHeight = project.gridData?.length || 0
              
              if (gridWidth === 0 || gridHeight === 0) return null
              
              const centerX = Math.floor(gridWidth / 2)
              const centerY = Math.floor(gridHeight / 2)
              const previewSize = 8
              const startX = Math.max(0, centerX - previewSize / 2)
              const startY = Math.max(0, centerY - previewSize / 2)
              
              // Check if segment is within preview area
              const fromX = segment.from.x
              const fromY = segment.from.y
              const toX = segment.to.x
              const toY = segment.to.y
              
              if (fromX < startX || fromX >= startX + previewSize || 
                  fromY < startY || fromY >= startY + previewSize ||
                  toX < startX || toX >= startX + previewSize || 
                  toY < startY || toY >= startY + previewSize) {
                return null // Skip segments outside preview area
              }
              
              const startXPercent = ((fromX - startX) / previewSize) * 100
              const startYPercent = ((fromY - startY) / previewSize) * 100
              const endXPercent = ((toX - startX) / previewSize) * 100
              const endYPercent = ((toY - startY) / previewSize) * 100
              
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
