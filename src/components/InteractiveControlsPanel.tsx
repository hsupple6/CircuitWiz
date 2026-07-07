import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, GripVertical, PanelRightClose, SlidersHorizontal } from 'lucide-react'
import {
  patchInteractableCell,
  scanInteractableComponents,
  type InteractableControl,
  type InteractableKind,
} from '../utils/interactableComponents'

type DockEdge = 'left' | 'right' | 'top' | 'bottom' | null

interface InteractiveControlsPanelProps {
  gridData: Parameters<typeof scanInteractableComponents>[0]
  onGridPatch: (nextGrid: Parameters<typeof patchInteractableCell>[0]) => void
  containerRef?: HTMLElement | null
}

function kindLabel(kind: InteractableKind): string {
  switch (kind) {
    case 'potentiometer':
      return 'Potentiometer'
    case 'switch':
      return 'Toggle switch'
    case 'pushButton':
      return 'Push button'
    case 'limitSwitch':
      return 'Limit switch'
  }
}

export function InteractiveControlsPanel({
  gridData,
  onGridPatch,
  containerRef,
}: InteractiveControlsPanelProps) {
  const controls = useMemo(() => scanInteractableComponents(gridData), [gridData])
  const [dock, setDock] = useState<DockEdge>('left')
  const [collapsed, setCollapsed] = useState(false)
  const [position, setPosition] = useState({ x: 16, y: 96 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const patchControl = useCallback(
    (control: InteractableControl, patch: Record<string, unknown>) => {
      onGridPatch(patchInteractableCell(gridData, control.componentId, control.bodyCellIndex, patch))
    },
    [gridData, onGridPatch]
  )

  const snapToNearestWall = useCallback(() => {
    const rect = containerRef?.getBoundingClientRect()
    if (!rect) return
    const cx = position.x + 120
    const cy = position.y + 80
    const distLeft = cx
    const distRight = rect.width - cx
    const distTop = cy
    const distBottom = rect.height - cy
    const min = Math.min(distLeft, distRight, distTop, distBottom)
    if (min === distLeft) setDock('left')
    else if (min === distRight) setDock('right')
    else if (min === distTop) setDock('top')
    else setDock('bottom')
    setCollapsed(true)
  }, [containerRef, position])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const rect = containerRef?.getBoundingClientRect()
      if (!rect) return
      setDock(null)
      setCollapsed(false)
      setPosition({
        x: Math.max(8, Math.min(rect.width - 200, e.clientX - rect.left - dragOffset.current.x)),
        y: Math.max(48, Math.min(rect.height - 120, e.clientY - rect.top - dragOffset.current.y)),
      })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, containerRef])

  if (controls.length === 0) return null

  const panelStyle: CSSProperties = dock
    ? collapsed
      ? dock === 'left'
        ? { left: 0, top: '40%', transform: 'translateY(-50%)' }
        : dock === 'right'
          ? { right: 0, top: '40%', transform: 'translateY(-50%)' }
          : dock === 'top'
            ? { top: 48, left: '50%', transform: 'translateX(-50%)' }
            : { bottom: 8, left: '50%', transform: 'translateX(-50%)' }
      : dock === 'left'
        ? { left: 8, top: 72, maxHeight: 'calc(100% - 5rem)' }
        : dock === 'right'
          ? { right: 8, top: 72, maxHeight: 'calc(100% - 5rem)' }
          : dock === 'top'
            ? { top: 56, left: '50%', transform: 'translateX(-50%)', maxWidth: 'min(420px, 92vw)' }
            : { bottom: 12, left: '50%', transform: 'translateX(-50%)', maxWidth: 'min(420px, 92vw)' }
    : { left: position.x, top: position.y, maxHeight: 'min(420px, 55vh)' }

  const DockIcon =
    dock === 'left' ? ChevronRight : dock === 'right' ? ChevronLeft : dock === 'top' ? ChevronDown : ChevronUp

  if (collapsed && dock) {
    return (
      <div className="pointer-events-none absolute inset-0 z-50">
        <button
          type="button"
          data-control-buttons
          onClick={() => setCollapsed(false)}
          className={`pointer-events-auto absolute flex items-center justify-center rounded-lg border border-black/10 bg-white/95 text-gray-700 shadow-lg backdrop-blur-sm transition hover:bg-white dark:border-white/10 dark:bg-[#1e1e1e]/95 dark:text-zinc-200 dark:hover:bg-[#252525] ${
            dock === 'left' || dock === 'right' ? 'h-24 w-9' : 'h-9 min-w-[7rem] px-2'
          }`}
          style={panelStyle}
          title="Show circuit controls"
          aria-label="Show circuit controls"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${dock === 'left' || dock === 'right' ? 'sr-only' : 'ml-1.5'}`}
          >
            Controls
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div
        className="pointer-events-auto flex w-[min(300px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#1e1e1e]/95"
        style={{ position: 'absolute', ...panelStyle }}
        data-control-buttons
      >
        <div
          className="flex cursor-grab items-center gap-2 border-b border-gray-200 bg-gray-50/80 px-2 py-2 active:cursor-grabbing dark:border-white/10 dark:bg-zinc-900/60"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return
            const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
            const containerRect = containerRef?.getBoundingClientRect()
            if (!containerRect) return
            dragOffset.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            }
            setDragging(true)
          }}
        >
          <GripVertical className="h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-gray-900 dark:text-zinc-100">Circuit controls</p>
            <p className="truncate text-[10px] text-gray-500 dark:text-zinc-500">
              {controls.length} interactive part{controls.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={snapToNearestWall}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-white/10"
            title="Dock to nearest edge"
            aria-label="Dock to nearest edge"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
          {dock ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-white/10"
              title="Hide into wall"
              aria-label="Hide into wall"
            >
              <DockIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2">
          {controls.map((control) => (
            <ControlCard key={control.componentId} control={control} onPatch={patchControl} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ControlCard({
  control,
  onPatch,
}: {
  control: InteractableControl
  onPatch: (control: InteractableControl, patch: Record<string, unknown>) => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-white/10 dark:bg-zinc-900/50">
      <div className="mb-2">
        <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{control.label}</p>
        <p className="text-[10px] text-gray-500 dark:text-zinc-500">{kindLabel(control.kind)}</p>
      </div>

      {control.kind === 'potentiometer' && (
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={control.wiperPosition ?? 0.5}
            onChange={(e) => onPatch(control, { wiperPosition: Number(e.target.value) })}
            className="w-full accent-primary-600"
          />
          <p className="text-right text-[10px] tabular-nums text-gray-500 dark:text-zinc-400">
            {Math.round((control.wiperPosition ?? 0.5) * 100)}%
          </p>
        </div>
      )}

      {(control.kind === 'switch' || control.kind === 'limitSwitch') && (
        <button
          type="button"
          onClick={() =>
            onPatch(control, {
              isOn: !control.isOn,
              isPowered: !control.isOn,
            })
          }
          className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${
            control.isOn
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-gray-300 bg-gray-100 text-gray-700 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200'
          }`}
        >
          {control.isOn ? 'ON — click to open' : 'OFF — click to close'}
        </button>
      )}

      {control.kind === 'pushButton' && (
        <button
          type="button"
          onMouseDown={() => onPatch(control, { isOn: true, isPowered: true })}
          onMouseUp={() => onPatch(control, { isOn: false, isPowered: false })}
          onMouseLeave={() => {
            if (control.isOn) onPatch(control, { isOn: false, isPowered: false })
          }}
          onTouchStart={() => onPatch(control, { isOn: true, isPowered: true })}
          onTouchEnd={() => onPatch(control, { isOn: false, isPowered: false })}
          className={`w-full select-none rounded-lg border px-3 py-3 text-sm font-semibold transition active:scale-[0.98] ${
            control.isOn
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-gray-300 bg-gray-100 text-gray-800 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-100'
          }`}
        >
          {control.isOn ? 'Pressed' : 'Hold to press'}
        </button>
      )}
    </div>
  )
}
