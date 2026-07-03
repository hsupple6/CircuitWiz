import React, { useCallback, useEffect, useState } from 'react'
import type { SchematicCellLabel } from '../types/workspace'

const CELL_VW = 2.5

interface SchematicLabelLayerProps {
  labels: SchematicCellLabel[]
  selectedId: string | null
  isLabelMode: boolean
  deleteMode: boolean
  editRequestId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<SchematicCellLabel>) => void
  onDelete: (id: string) => void
  onEditRequestHandled: () => void
}

function labelStyle(label: SchematicCellLabel) {
  return {
    left: `${label.x * CELL_VW}vw`,
    top: `${label.y * CELL_VW}vw`,
    width: `${CELL_VW}vw`,
    height: `${CELL_VW}vw`,
  }
}

export function SchematicLabelLayer({
  labels,
  selectedId,
  isLabelMode,
  deleteMode,
  editRequestId,
  onSelect,
  onUpdate,
  onDelete,
  onEditRequestHandled,
}: SchematicLabelLayerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (editRequestId) {
      setEditingId(editRequestId)
      onEditRequestHandled()
    }
  }, [editRequestId, onEditRequestHandled])

  const finishEditing = useCallback(
    (label: SchematicCellLabel) => {
      setEditingId(null)
      if (!label.text.trim()) {
        onDelete(label.id)
      }
    },
    [onDelete]
  )

  const handleLabelMouseDown = (e: React.MouseEvent, label: SchematicCellLabel) => {
    if (!isLabelMode && !deleteMode) return
    e.stopPropagation()
    e.preventDefault()

    if (deleteMode) {
      onDelete(label.id)
      return
    }

    onSelect(label.id)
    setEditingId(label.id)
  }

  const interactive = isLabelMode || deleteMode

  if (labels.length === 0 && !isLabelMode) return null

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 18 }}>
      {labels.map((label) => {
        const isSelected = selectedId === label.id
        const isEditing = editingId === label.id

        return (
          <div
            key={label.id}
            className={`absolute flex items-center justify-center ${
              interactive ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
            style={labelStyle(label)}
            onMouseDown={(e) => handleLabelMouseDown(e, label)}
            onClick={(e) => e.stopPropagation()}
          >
            {isEditing ? (
              <input
                autoFocus
                value={label.text}
                onChange={(e) => onUpdate(label.id, { text: e.target.value })}
                onBlur={() => finishEditing(label)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishEditing(label)
                  if (e.key === 'Escape') {
                    setEditingId(null)
                    if (!label.text.trim()) onDelete(label.id)
                  }
                }}
                placeholder="Label..."
                className="w-[90%] min-w-0 text-[10px] font-medium text-center bg-white/95 dark:bg-dark-surface/95 border border-primary-400 dark:border-primary-500 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary-500 shadow-sm"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              label.text.trim() && (
                <span
                  className={`max-w-full truncate rounded px-1 py-0.5 text-[10px] font-medium shadow-sm ${
                    isSelected && isLabelMode
                      ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-400 dark:bg-primary-900/50 dark:text-primary-200'
                      : 'bg-white/85 text-gray-800 dark:bg-dark-surface/90 dark:text-gray-100'
                  } ${isLabelMode ? 'cursor-text' : ''}`}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (isLabelMode) {
                      onSelect(label.id)
                      setEditingId(label.id)
                    }
                  }}
                >
                  {label.text}
                </span>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
