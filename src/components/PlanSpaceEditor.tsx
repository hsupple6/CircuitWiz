import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  MousePointer2,
  Square,
  Circle,
  Diamond,
  RectangleHorizontal,
  Link2,
  ArrowRight,
  Trash2,
  Plus,
  Minus,
} from 'lucide-react'
import {
  PlanSpace,
  PlanBubble,
  PlanBubbleShape,
  PlanConnection,
  PlanArrow,
} from '../types/workspace'
import { seedPlanSpaceIfEmpty } from '../types/workspace'

type Tool = 'select' | 'bubble' | 'connect' | 'arrow' | 'delete'

const BUBBLE_COLORS = ['#ede9fe', '#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff']
const STROKE_COLORS = [
  '#64748b', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#22c55e', '#06b6d4', '#1e293b', '#0ea5e9',
]
const SVG_OFFSET = 5000

type Point = { x: number; y: number }

/** Support legacy x1/y1/x2/y2 arrows stored in localStorage */
function getArrowPoints(arrow: PlanArrow & { x1?: number; y1?: number; x2?: number; y2?: number }): Point[] {
  if (arrow.points?.length >= 2) return arrow.points
  if (arrow.x1 != null && arrow.x2 != null && arrow.y1 != null && arrow.y2 != null) {
    return [{ x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }]
  }
  return arrow.points ?? []
}

function pointsToSvgPath(points: Point[], offset = SVG_OFFSET): string {
  if (points.length < 2) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x + offset} ${p.y + offset}`)
    .join(' ')
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function markerUrl(color: string, selected: boolean): string {
  if (selected) return 'url(#arrowhead-selected)'
  return `url(#arrowhead-${color.replace('#', '')})`
}

function findArrowAt(wx: number, wy: number, arrows: PlanArrow[], threshold: number): PlanArrow | null {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const pts = getArrowPoints(arrows[i])
    for (let j = 0; j < pts.length - 1; j++) {
      if (distToSegment(wx, wy, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y) < threshold) {
        return arrows[i]
      }
    }
  }
  return null
}

interface PlanSpaceEditorProps {
  planSpace: PlanSpace
  onChange: (planSpace: PlanSpace) => void
  zoom: number
  onZoomChange: (zoom: number) => void
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function bubbleCenter(b: PlanBubble) {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

function getEdgePoint(bubble: PlanBubble, toward: { x: number; y: number }) {
  const cx = bubble.x + bubble.width / 2
  const cy = bubble.y + bubble.height / 2
  const dx = toward.x - cx
  const dy = toward.y - cy
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { x: cx, y: cy }
  const scale = Math.min(bubble.width / 2 / Math.abs(dx), bubble.height / 2 / Math.abs(dy))
  return { x: cx + dx * scale, y: cy + dy * scale }
}

function buildPath(
  x1: number, y1: number, x2: number, y2: number,
  curve: PlanConnection['curve'] = 'straight'
): string {
  if (curve === 'elbow') {
    const midY = y1 + (y2 - y1) * 0.55
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
  }
  if (curve === 'arc') {
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const bulge = Math.min(100, len * 0.4)
    const cx = mx - (dy / len) * bulge
    const cy = my + (dx / len) * bulge
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
  }
  return `M ${x1} ${y1} L ${x2} ${y2}`
}

function PlanBubbleNode({
  bubble,
  isSelected,
  isConnectSource,
  isEditing,
  onDoubleClick,
  onTextChange,
  onBlur,
}: {
  bubble: PlanBubble
  isSelected: boolean
  isConnectSource: boolean
  isEditing: boolean
  onDoubleClick: () => void
  onTextChange: (text: string) => void
  onBlur: () => void
}) {
  const ring = isSelected || isConnectSource
    ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-gray-50 dark:ring-offset-dark-bg'
    : ''

  const textStyle = { color: bubble.textColor || '#1e293b' }
  const border = bubble.borderColor ?? 'transparent'

  const editArea = (
    <textarea
      autoFocus
      value={bubble.text}
      onChange={(e) => onTextChange(e.target.value)}
      onBlur={onBlur}
      className="w-full bg-transparent border-none outline-none resize-none text-center text-sm font-medium p-1"
      style={textStyle}
      onClick={(e) => e.stopPropagation()}
    />
  )

  const content = isEditing ? editArea : (
    <div className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 w-full h-full">
      <span className="text-sm font-semibold text-center whitespace-pre-wrap leading-snug" style={textStyle}>
        {bubble.text}
      </span>
      {bubble.subtitle && (
        <span className="text-[11px] text-center leading-tight opacity-70" style={textStyle}>
          {bubble.subtitle}
        </span>
      )}
    </div>
  )

  const base = {
    left: bubble.x,
    top: bubble.y,
    width: bubble.width,
    height: bubble.height,
    backgroundColor: bubble.color === 'transparent' ? undefined : bubble.color,
    borderColor: border,
  }

  if (bubble.shape === 'phase') {
    return (
      <div
        className={`absolute flex items-center justify-center ${ring}`}
        style={base}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      >
        <div className="text-center">
          {isEditing ? editArea : (
            <>
              <div className="text-xl font-bold tracking-tight" style={{ color: bubble.textColor || '#4f46e5' }}>
                {bubble.text}
              </div>
              {bubble.subtitle && (
                <div className="text-sm mt-1 opacity-60" style={textStyle}>{bubble.subtitle}</div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  if (bubble.shape === 'pill') {
    return (
      <div
        className={`absolute flex items-center justify-center rounded-full border ${ring} ${
          bubble.shadow ? 'shadow-md shadow-black/5' : ''
        }`}
        style={{ ...base, borderWidth: border !== 'transparent' ? 1.5 : 0 }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      >
        {content}
      </div>
    )
  }

  if (bubble.shape === 'card') {
    return (
      <div
        className={`absolute flex items-center justify-center rounded-2xl border backdrop-blur-sm ${ring} ${
          bubble.shadow ? 'shadow-lg shadow-black/[0.06]' : ''
        } dark:bg-dark-surface/90`}
        style={{ ...base, borderWidth: 1 }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      >
        {content}
      </div>
    )
  }

  if (bubble.shape === 'diamond') {
    return (
      <div
        className={`absolute flex items-center justify-center rotate-45 border ${ring}`}
        style={{ ...base, borderWidth: border !== 'transparent' ? 2 : 0, borderRadius: 8 }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      >
        <div className="-rotate-45 w-full h-full flex items-center justify-center">
          {content}
        </div>
      </div>
    )
  }

  const shapeClass =
    bubble.shape === 'rectangle' ? 'rounded-lg' :
    bubble.shape === 'ellipse' ? 'rounded-full' :
    'rounded-xl'

  return (
    <div
      className={`absolute flex items-center justify-center border ${shapeClass} ${ring}`}
      style={{ ...base, borderWidth: border !== 'transparent' ? 1.5 : 0 }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
    >
      {content}
    </div>
  )
}

export function PlanSpaceEditor({ planSpace, onChange, zoom, onZoomChange }: PlanSpaceEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const seeded = useRef(false)
  const [tool, setTool] = useState<Tool>('select')
  const [selectedShape, setSelectedShape] = useState<PlanBubbleShape>('card')
  const [offset, setOffset] = useState(planSpace.metadata.offset)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'bubble' | 'arrow' | 'connection' | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 })
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; bubbleX: number; bubbleY: number } | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [arrowDrawing, setArrowDrawing] = useState<Point[] | null>(null)
  const [arrowPreview, setArrowPreview] = useState<Point | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [arrowDrawColor, setArrowDrawColor] = useState(STROKE_COLORS[0])

  useEffect(() => {
    if (seeded.current || planSpace.bubbles.length > 0) return
    seeded.current = true
    const filled = seedPlanSpaceIfEmpty(planSpace)
    onChange(filled)
    setOffset(filled.metadata.offset)
    onZoomChange(filled.metadata.zoom)
  }, [planSpace, onChange, onZoomChange])

  useEffect(() => {
    setOffset(planSpace.metadata.offset)
  }, [planSpace.id])

  const emit = useCallback((updated: Partial<PlanSpace>) => {
    onChange({
      ...planSpace,
      ...updated,
      metadata: { zoom, offset, ...updated.metadata },
    })
  }, [planSpace, onChange, zoom, offset])

  const finishArrow = useCallback((points: Point[]) => {
    if (points.length < 2) {
      setArrowDrawing(null)
      setArrowPreview(null)
      return
    }
    const arrow: PlanArrow = {
      id: newId('arrow'),
      points,
      color: arrowDrawColor,
    }
    emit({ arrows: [...planSpace.arrows, arrow] })
    setArrowDrawing(null)
    setArrowPreview(null)
    setTool('select')
  }, [arrowDrawColor, emit, planSpace.arrows])

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId || !selectedType) return
    if (selectedType === 'bubble') {
      emit({
        bubbles: planSpace.bubbles.filter((b) => b.id !== selectedId),
        connections: planSpace.connections.filter(
          (c) => c.fromBubbleId !== selectedId && c.toBubbleId !== selectedId
        ),
      })
    } else if (selectedType === 'arrow') {
      emit({ arrows: planSpace.arrows.filter((a) => a.id !== selectedId) })
    } else if (selectedType === 'connection') {
      emit({ connections: planSpace.connections.filter((c) => c.id !== selectedId) })
    }
    setSelectedId(null)
    setSelectedType(null)
  }, [selectedId, selectedType, emit, planSpace.bubbles, planSpace.connections, planSpace.arrows])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      if (e.key === 'Escape') {
        setArrowDrawing(null)
        setArrowPreview(null)
        setConnectFrom(null)
      }
      if (e.key === 'Enter' && arrowDrawing && arrowDrawing.length >= 1 && arrowPreview) {
        finishArrow([...arrowDrawing, arrowPreview])
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId && !isTyping) {
        e.preventDefault()
        handleDeleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [arrowDrawing, arrowPreview, finishArrow, selectedId, editingId, handleDeleteSelected])

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - offset.x) / zoom,
      y: (clientY - rect.top - offset.y) / zoom,
    }
  }, [offset, zoom])

  const zoomAtPoint = useCallback((newZoom: number, clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) { onZoomChange(newZoom); return }
    const mx = clientX - rect.left
    const my = clientY - rect.top
    const wx = (mx - offset.x) / zoom
    const wy = (my - offset.y) / zoom
    const clamped = Math.max(0.25, Math.min(3, newZoom))
    setOffset({ x: mx - wx * clamped, y: my - wy * clamped })
    onZoomChange(clamped)
  }, [offset, zoom, onZoomChange])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAtPoint(zoom + (e.deltaY > 0 ? -0.08 : 0.08), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, zoomAtPoint])

  const findBubbleAt = useCallback((wx: number, wy: number): PlanBubble | null => {
    for (let i = planSpace.bubbles.length - 1; i >= 0; i--) {
      const b = planSpace.bubbles[i]
      if (wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height) return b
    }
    return null
  }, [planSpace.bubbles])

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y })
      return
    }

    const world = screenToWorld(e.clientX, e.clientY)

    if (tool === 'select') {
      const hit = findBubbleAt(world.x, world.y)
      if (hit) {
        setSelectedId(hit.id)
        setSelectedType('bubble')
        setDragging({ id: hit.id, startX: e.clientX, startY: e.clientY, bubbleX: hit.x, bubbleY: hit.y })
      } else {
        const arrowHit = findArrowAt(world.x, world.y, planSpace.arrows, 10 / zoom)
        if (arrowHit) {
          setSelectedId(arrowHit.id)
          setSelectedType('arrow')
        } else {
          setSelectedId(null)
          setSelectedType(null)
          setIsPanning(true)
          setPanStart({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y })
        }
      }
      return
    }

    if (tool === 'bubble') {
      const idx = planSpace.bubbles.length % BUBBLE_COLORS.length
      const isCard = selectedShape === 'card'
      const bubble: PlanBubble = {
        id: newId('bubble'),
        x: world.x - (isCard ? 100 : 80),
        y: world.y - 40,
        width: isCard ? 200 : 160,
        height: isCard ? 88 : 72,
        text: 'New step',
        shape: selectedShape,
        color: selectedShape === 'card' ? '#ffffff' : BUBBLE_COLORS[idx],
        borderColor: '#e2e8f0',
        shadow: isCard,
        textColor: '#1e293b',
      }
      emit({ bubbles: [...planSpace.bubbles, bubble] })
      setSelectedId(bubble.id)
      setEditingId(bubble.id)
      setTool('select')
      return
    }

    if (tool === 'connect') {
      const hit = findBubbleAt(world.x, world.y)
      if (!hit) return
      if (!connectFrom) setConnectFrom(hit.id)
      else if (connectFrom !== hit.id) {
        const exists = planSpace.connections.some(
          (c) => c.fromBubbleId === connectFrom && c.toBubbleId === hit.id
        )
        if (!exists) {
          emit({
            connections: [...planSpace.connections, {
              id: newId('conn'),
              fromBubbleId: connectFrom,
              toBubbleId: hit.id,
              color: '#94a3b8',
              curve: 'arc',
            }],
          })
        }
        setConnectFrom(null)
        setTool('select')
      }
      return
    }

    if (tool === 'arrow') {
      if (!arrowDrawing) {
        setArrowDrawing([world])
        setArrowPreview(world)
      } else {
        const last = arrowDrawing[arrowDrawing.length - 1]
        if (Math.hypot(world.x - last.x, world.y - last.y) > 6 / zoom) {
          setArrowDrawing([...arrowDrawing, world])
        }
      }
      return
    }

    if (tool === 'delete') {
      const hit = findBubbleAt(world.x, world.y)
      if (hit) {
        emit({
          bubbles: planSpace.bubbles.filter((b) => b.id !== hit.id),
          connections: planSpace.connections.filter(
            (c) => c.fromBubbleId !== hit.id && c.toBubbleId !== hit.id
          ),
        })
        return
      }
      const arrowHit = findArrowAt(world.x, world.y, planSpace.arrows, 10 / zoom)
      if (arrowHit) {
        emit({ arrows: planSpace.arrows.filter((a) => a.id !== arrowHit.id) })
      }
    }
  }

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'arrow' || !arrowDrawing) return
    const world = screenToWorld(e.clientX, e.clientY)
    const pts = arrowDrawing.length === 1 && arrowPreview
      ? [arrowDrawing[0], arrowPreview]
      : arrowPreview && Math.hypot(world.x - arrowDrawing[arrowDrawing.length - 1].x, world.y - arrowDrawing[arrowDrawing.length - 1].y) > 6 / zoom
        ? [...arrowDrawing, world]
        : arrowDrawing
    finishArrow(pts)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) })
      return
    }
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoom
      const dy = (e.clientY - dragging.startY) / zoom
      emit({
        bubbles: planSpace.bubbles.map((b) =>
          b.id === dragging.id ? { ...b, x: dragging.bubbleX + dx, y: dragging.bubbleY + dy } : b
        ),
      })
      return
    }
    if (arrowDrawing) {
      const world = screenToWorld(e.clientX, e.clientY)
      setArrowPreview(world)
    }
  }

  const handleCanvasMouseUp = () => {
    if (isPanning || dragging) {
      onChange({ ...planSpace, metadata: { zoom, offset } })
    }
    setIsPanning(false)
    setDragging(null)
  }

  const handleStrokeColorChange = (color: string) => {
    if (!selectedId) return
    if (selectedType === 'arrow') {
      emit({
        arrows: planSpace.arrows.map((a) => (a.id === selectedId ? { ...a, color } : a)),
      })
    } else if (selectedType === 'connection') {
      emit({
        connections: planSpace.connections.map((c) => (c.id === selectedId ? { ...c, color } : c)),
      })
    }
  }

  const selectedStrokeColor = useMemo(() => {
    if (!selectedId) return STROKE_COLORS[0]
    if (selectedType === 'arrow') {
      return planSpace.arrows.find((a) => a.id === selectedId)?.color || STROKE_COLORS[0]
    }
    if (selectedType === 'connection') {
      return planSpace.connections.find((c) => c.id === selectedId)?.color || '#94a3b8'
    }
    return STROKE_COLORS[0]
  }, [selectedId, selectedType, planSpace.arrows, planSpace.connections])

  const handleBubbleTextChange = (id: string, text: string) => {
    emit({ bubbles: planSpace.bubbles.map((b) => (b.id === id ? { ...b, text } : b)) })
  }

  const connectionPaths = useMemo(() => {
    return planSpace.connections.map((conn) => {
      const from = planSpace.bubbles.find((b) => b.id === conn.fromBubbleId)
      const to = planSpace.bubbles.find((b) => b.id === conn.toBubbleId)
      if (!from || !to) return null
      const tc = bubbleCenter(to)
      const fc = bubbleCenter(from)
      const start = getEdgePoint(from, tc)
      const end = getEdgePoint(to, fc)
      const d = buildPath(start.x, start.y, end.x, end.y, conn.curve)
      return { conn, d, color: conn.color || '#94a3b8' }
    }).filter(Boolean) as Array<{ conn: PlanConnection; d: string; color: string }>
  }, [planSpace.connections, planSpace.bubbles])

  const shapes: { shape: PlanBubbleShape; icon: React.ReactNode; label: string }[] = [
    { shape: 'card', icon: <RectangleHorizontal className="h-4 w-4" />, label: 'Card' },
    { shape: 'pill', icon: <Minus className="h-4 w-4 rotate-90" />, label: 'Pill' },
    { shape: 'rounded', icon: <Square className="h-4 w-4 rounded" />, label: 'Rounded' },
    { shape: 'ellipse', icon: <Circle className="h-4 w-4" />, label: 'Ellipse' },
    { shape: 'diamond', icon: <Diamond className="h-4 w-4" />, label: 'Diamond' },
  ]

  const tools: { t: Tool; icon: React.ReactNode; label: string }[] = [
    { t: 'select', icon: <MousePointer2 className="h-4 w-4" />, label: 'Select / Pan' },
    { t: 'bubble', icon: <Plus className="h-4 w-4" />, label: 'Add Node' },
    { t: 'connect', icon: <Link2 className="h-4 w-4" />, label: 'Connect' },
    { t: 'arrow', icon: <ArrowRight className="h-4 w-4" />, label: 'Draw Arrow Path' },
    { t: 'delete', icon: <Trash2 className="h-4 w-4" />, label: 'Delete' },
  ]

  return (
    <div className="flex h-full">
      <div className="w-14 border-r border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface flex flex-col items-center py-3 gap-1 shrink-0">
        {tools.map(({ t, icon, label }) => (
          <button
            key={t}
            onClick={() => {
              setTool(t)
              setConnectFrom(null)
              if (t !== 'arrow') {
                setArrowDrawing(null)
                setArrowPreview(null)
              }
            }}
            title={label}
            className={`p-2.5 rounded-lg transition-colors ${
              tool === t
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                : 'text-gray-500 hover:bg-gray-100 dark:text-dark-text-muted dark:hover:bg-dark-border'
            }`}
          >
            {icon}
          </button>
        ))}
        <div className="w-8 border-t border-gray-200 dark:border-dark-border my-2" />
        {shapes.map(({ shape, icon, label }) => (
          <button
            key={shape}
            onClick={() => { setSelectedShape(shape); setTool('bubble') }}
            title={label}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'bubble' && selectedShape === shape
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-border'
            }`}
          >
            {icon}
          </button>
        ))}
        {selectedId && (selectedType === 'arrow' || selectedType === 'connection') && (
          <>
            <div className="w-8 border-t border-gray-200 dark:border-dark-border my-2" />
            <div className="flex flex-col gap-1.5 px-1">
              {STROKE_COLORS.map((color) => (
                <button
                  key={color}
                  title={`Color ${color}`}
                  onClick={() => handleStrokeColorChange(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    selectedStrokeColor === color
                      ? 'border-primary-500 scale-110 shadow-sm'
                      : 'border-white dark:border-dark-border'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </>
        )}
        {tool === 'arrow' && (
          <>
            <div className="w-8 border-t border-gray-200 dark:border-dark-border my-2" />
            <div className="flex flex-col gap-1.5 px-1">
              {STROKE_COLORS.slice(0, 6).map((color) => (
                <button
                  key={color}
                  title={`Draw in ${color}`}
                  onClick={() => setArrowDrawColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    arrowDrawColor === color
                      ? 'border-primary-500 scale-110'
                      : 'border-white dark:border-dark-border'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </>
        )}
        {selectedId && (
          <>
            <div className="w-8 border-t border-gray-200 dark:border-dark-border my-2" />
            <button onClick={handleDeleteSelected} title="Delete selected" className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative bg-[#f8fafc] dark:bg-dark-bg"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onDoubleClick={handleCanvasDoubleClick}
        style={{ cursor: isPanning ? 'grabbing' : tool === 'select' ? 'default' : 'crosshair' }}
      >
        {connectFrom && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-primary-600 text-white text-sm px-4 py-1.5 rounded-full shadow-lg">
            Click another node to connect
          </div>
        )}
        {tool === 'arrow' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-slate-800 text-white text-sm px-4 py-1.5 rounded-full shadow-lg">
            {arrowDrawing
              ? 'Click to add bends · Double-click or Enter to finish · Esc to cancel'
              : 'Click to start your arrow path'}
          </div>
        )}
        {(selectedType === 'arrow' || selectedType === 'connection') && selectedId && (
          <div className="absolute top-3 right-4 z-20 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl shadow-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 dark:text-dark-text-muted mb-2">Stroke color</p>
            <div className="flex flex-wrap gap-2 max-w-[180px]">
              {STROKE_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleStrokeColorChange(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    selectedStrokeColor === color ? 'border-primary-500 scale-110' : 'border-gray-200 dark:border-dark-border'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        )}

        <div
          className="absolute inset-0 origin-top-left"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        >
          <svg
            className="absolute"
            style={{ left: -SVG_OFFSET, top: -SVG_OFFSET, width: SVG_OFFSET * 2, height: SVG_OFFSET * 2 }}
          >
            <defs>
              <marker id="arrowhead-selected" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" />
              </marker>
              {STROKE_COLORS.concat(['#94a3b8', '#f472b6', '#4ade80', '#fbbf24', '#60a5fa', '#a78bfa']).map((c, i, arr) =>
                arr.indexOf(c) === i ? (
                  <marker
                    key={c}
                    id={`arrowhead-${c.replace('#', '')}`}
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill={c} />
                  </marker>
                ) : null
              )}
            </defs>

            {connectionPaths.map(({ conn, color }) => {
              const selected = selectedId === conn.id
              const from = planSpace.bubbles.find((b) => b.id === conn.fromBubbleId)!
              const to = planSpace.bubbles.find((b) => b.id === conn.toBubbleId)!
              const tc = bubbleCenter(to)
              const fc = bubbleCenter(from)
              const start = getEdgePoint(from, tc)
              const end = getEdgePoint(to, fc)
              const offsetPath = buildPath(
                start.x + SVG_OFFSET, start.y + SVG_OFFSET,
                end.x + SVG_OFFSET, end.y + SVG_OFFSET,
                conn.curve
              )
              const stroke = selected ? '#6366f1' : color

              return (
                <g key={conn.id} className="cursor-pointer">
                  <path
                    d={offsetPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    style={{ pointerEvents: 'stroke' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(conn.id); setSelectedType('connection') }}
                  />
                  <path
                    d={offsetPath}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={selected ? 2.5 : 2}
                    strokeDasharray={conn.dashed ? '6 5' : undefined}
                    strokeLinecap="round"
                    markerEnd={markerUrl(color, selected)}
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )
            })}

            {planSpace.arrows.map((arrow) => {
              const selected = selectedId === arrow.id
              const color = arrow.color || '#64748b'
              const pts = getArrowPoints(arrow)
              const d = pointsToSvgPath(pts)
              if (!d) return null
              const stroke = selected ? '#6366f1' : color

              return (
                <g key={arrow.id} className="cursor-pointer">
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    style={{ pointerEvents: 'stroke' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(arrow.id); setSelectedType('arrow') }}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={selected ? 2.5 : 2}
                    strokeDasharray={arrow.dashed ? '6 5' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={markerUrl(color, selected)}
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )
            })}

            {arrowDrawing && arrowPreview && (() => {
              const draftPts = [...arrowDrawing, arrowPreview]
              const d = pointsToSvgPath(draftPts)
              return (
                <g>
                  {draftPts.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x + SVG_OFFSET}
                      cy={p.y + SVG_OFFSET}
                      r={4}
                      fill={arrowDrawColor}
                      opacity={0.7}
                    />
                  ))}
                  <path
                    d={d}
                    fill="none"
                    stroke={arrowDrawColor}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={markerUrl(arrowDrawColor, false)}
                    opacity={0.85}
                  />
                </g>
              )
            })()}
          </svg>

          {planSpace.bubbles.map((bubble) => (
            <PlanBubbleNode
              key={bubble.id}
              bubble={bubble}
              isSelected={selectedId === bubble.id}
              isConnectSource={connectFrom === bubble.id}
              isEditing={editingId === bubble.id}
              onDoubleClick={() => setEditingId(bubble.id)}
              onTextChange={(text) => handleBubbleTextChange(bubble.id, text)}
              onBlur={() => setEditingId(null)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
