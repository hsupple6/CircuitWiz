import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { SchematicGroupBox } from '../types/workspace'

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

interface SchematicGroupBoxLayerProps {
  groupBoxes: SchematicGroupBox[]
  selectedId: string | null
  drawPreview: { x: number; y: number; width: number; height: number } | null
  isDrawMode: boolean
  isInteractive: boolean
  deleteMode: boolean
  cellSizePx: number
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<SchematicGroupBox>) => void
  onDelete: (id: string) => void
}

function boxStyle(box: SchematicGroupBox) {
  return {
    left: `${box.x * 2.5}vw`,
    top: `${box.y * 2.5}vw`,
    width: `${box.width * 2.5}vw`,
    height: `${box.height * 2.5}vw`,
    backgroundColor: box.color,
    borderColor: box.borderColor ?? '#818CF8',
  }
}

function previewStyle(preview: { x: number; y: number; width: number; height: number }) {
  return {
    left: `${preview.x * 2.5}vw`,
    top: `${preview.y * 2.5}vw`,
    width: `${preview.width * 2.5}vw`,
    height: `${preview.height * 2.5}vw`,
  }
}

export function SchematicGroupBoxLayer({
  groupBoxes,
  selectedId,
  drawPreview,
  isDrawMode,
  isInteractive,
  deleteMode,
  cellSizePx,
  onSelect,
  onUpdate,
  onDelete,
}: SchematicGroupBoxLayerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{
    id: string
    startX: number
    startY: number
    boxX: number
    boxY: number
  } | null>(null)
  const [resizing, setResizing] = useState<{
    id: string
    handle: ResizeHandle
    startX: number
    startY: number
    box: SchematicGroupBox
  } | null>(null)

  const stopInteraction = useCallback(() => {
    setDragging(null)
    setResizing(null)
  }, [])

  useEffect(() => {
    if (!dragging && !resizing) return

    const handleMove = (e: MouseEvent) => {
      const cellSize = cellSizePx || window.innerWidth * 0.025

      if (dragging) {
        const dx = Math.round((e.clientX - dragging.startX) / cellSize)
        const dy = Math.round((e.clientY - dragging.startY) / cellSize)
        onUpdate(dragging.id, {
          x: Math.max(0, dragging.boxX + dx),
          y: Math.max(0, dragging.boxY + dy),
        })
      }

      if (resizing) {
        const dx = Math.round((e.clientX - resizing.startX) / cellSize)
        const dy = Math.round((e.clientY - resizing.startY) / cellSize)
        const b = resizing.box
        let { x, y, width, height } = b

        switch (resizing.handle) {
          case 'se':
            width = Math.max(2, b.width + dx)
            height = Math.max(2, b.height + dy)
            break
          case 'sw':
            x = b.x + dx
            width = Math.max(2, b.width - dx)
            height = Math.max(2, b.height + dy)
            if (width === 2) x = b.x + b.width - 2
            break
          case 'ne':
            y = b.y + dy
            width = Math.max(2, b.width + dx)
            height = Math.max(2, b.height - dy)
            if (height === 2) y = b.y + b.height - 2
            break
          case 'nw':
            x = b.x + dx
            y = b.y + dy
            width = Math.max(2, b.width - dx)
            height = Math.max(2, b.height - dy)
            if (width === 2) x = b.x + b.width - 2
            if (height === 2) y = b.y + b.height - 2
            break
        }

        onUpdate(resizing.id, {
          x: Math.max(0, x),
          y: Math.max(0, y),
          width,
          height,
        })
      }
    }

    const handleUp = () => stopInteraction()

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, resizing, onUpdate, stopInteraction, cellSizePx])

  const handleBoxMouseDown = (e: React.MouseEvent, box: SchematicGroupBox) => {
    if (!isInteractive || isDrawMode) return
    e.stopPropagation()
    e.preventDefault()

    if (deleteMode) {
      onDelete(box.id)
      return
    }

    onSelect(box.id)
    setDragging({
      id: box.id,
      startX: e.clientX,
      startY: e.clientY,
      boxX: box.x,
      boxY: box.y,
    })
  }

  const handleResizeMouseDown = (e: React.MouseEvent, box: SchematicGroupBox, handle: ResizeHandle) => {
    if (!isInteractive || isDrawMode) return
    e.stopPropagation()
    e.preventDefault()
    onSelect(box.id)
    setResizing({
      id: box.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      box: { ...box },
    })
  }

  const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se']
  const handlePosition: Record<ResizeHandle, string> = {
    nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize',
    ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize',
    sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize',
    se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize',
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {groupBoxes.map((box) => {
        const isSelected = selectedId === box.id
        const isEditing = editingId === box.id
        const interactive = isInteractive && !isDrawMode

        return (
          <div
            key={box.id}
            className={`absolute rounded-lg border-2 border-dashed transition-shadow ${
              isSelected ? 'ring-2 ring-primary-500 ring-offset-1 shadow-md' : ''
            } ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={boxStyle(box)}
            onMouseDown={(e) => handleBoxMouseDown(e, box)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-1 left-1.5 right-1.5 min-w-0">
              {isEditing ? (
                <input
                  autoFocus
                  value={box.title}
                  onChange={(e) => onUpdate(box.id, { title: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEditingId(null)
                  }}
                  className="w-full text-xs font-semibold bg-white/80 dark:bg-dark-surface/90 border border-gray-300 dark:border-dark-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary-500"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="inline-block text-xs font-semibold text-gray-800 dark:text-gray-100 bg-white/70 dark:bg-dark-surface/80 px-1.5 py-0.5 rounded truncate max-w-full cursor-text"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (interactive) setEditingId(box.id)
                  }}
                >
                  {box.title || 'Untitled'}
                </span>
              )}
            </div>

            {isSelected && interactive && handles.map((handle) => (
              <div
                key={handle}
                className={`absolute w-3 h-3 bg-white border-2 border-primary-500 rounded-sm shadow ${handlePosition[handle]}`}
                onMouseDown={(e) => handleResizeMouseDown(e, box, handle)}
              />
            ))}
          </div>
        )
      })}

      {drawPreview && (
        <div
          className="absolute rounded-lg border-2 border-dashed border-primary-400 bg-primary-100/30 pointer-events-none"
          style={previewStyle(drawPreview)}
        />
      )}
    </div>
  )
}
