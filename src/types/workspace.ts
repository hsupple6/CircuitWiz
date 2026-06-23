import { WireConnection } from '../modules/types'
import { ComponentState, GridCell } from '../systems/ElectricalSystem'
import { createDefaultPlanSpacePreset } from '../modules/planSpacePreset'

export type PlanBubbleShape = 'rounded' | 'rectangle' | 'ellipse' | 'diamond' | 'pill' | 'card' | 'phase'

export interface SchematicGroupBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  title: string
  color: string
  borderColor?: string
}

export const GROUP_BOX_COLOR_PRESETS: Array<{ name: string; fill: string; border: string }> = [
  { name: 'Indigo', fill: 'rgba(224, 231, 255, 0.55)', border: '#818CF8' },
  { name: 'Blue', fill: 'rgba(219, 234, 254, 0.55)', border: '#60A5FA' },
  { name: 'Green', fill: 'rgba(209, 250, 229, 0.55)', border: '#34D399' },
  { name: 'Amber', fill: 'rgba(254, 243, 199, 0.55)', border: '#FBBF24' },
  { name: 'Pink', fill: 'rgba(252, 231, 243, 0.55)', border: '#F472B6' },
  { name: 'Purple', fill: 'rgba(243, 232, 255, 0.55)', border: '#A78BFA' },
  { name: 'Slate', fill: 'rgba(241, 245, 249, 0.55)', border: '#94A3B8' },
]

export function createSchematicGroupBox(
  x: number,
  y: number,
  width: number,
  height: number,
  title = 'New Region',
  colorPreset = GROUP_BOX_COLOR_PRESETS[0]
): SchematicGroupBox {
  return {
    id: `groupbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x,
    y,
    width,
    height,
    title,
    color: colorPreset.fill,
    borderColor: colorPreset.border,
  }
}

export interface Schematic {
  id: string
  name: string
  description?: string
  gridData: GridCell[][]
  occupiedComponents?: unknown[]
  wires: WireConnection[]
  componentStates: Record<string, ComponentState>
  groupBoxes?: SchematicGroupBox[]
  metadata: {
    createdAt: string
    updatedAt: string
    gridSize: { width: number; height: number }
    zoom: number
    gridOffset: { x: number; y: number }
  }
  arduinoProject?: {
    name: string
    files: Array<{
      name: string
      content: string
      type: 'ino' | 'h' | 'cpp' | 'c'
      isMain: boolean
    }>
    board: string
    libraries: string[]
  }
}

export interface Document {
  id: string
  name: string
  content: string
  metadata: {
    createdAt: string
    updatedAt: string
  }
}

export interface PlanBubble {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  shape: PlanBubbleShape
  color: string
  subtitle?: string
  textColor?: string
  borderColor?: string
  shadow?: boolean
}

export interface PlanConnection {
  id: string
  fromBubbleId: string
  toBubbleId: string
  color?: string
  curve?: 'straight' | 'arc' | 'elbow'
  dashed?: boolean
}

export interface PlanArrow {
  id: string
  /** Polyline vertices; arrowhead renders at the last point */
  points: Array<{ x: number; y: number }>
  color?: string
  dashed?: boolean
}

export interface PlanSpace {
  id: string
  bubbles: PlanBubble[]
  connections: PlanConnection[]
  arrows: PlanArrow[]
  metadata: {
    zoom: number
    offset: { x: number; y: number }
  }
}

export interface ProjectFolder {
  id: string
  name: string
  description?: string
  schematics: Schematic[]
  documents: Document[]
  planSpace: PlanSpace
  metadata: {
    createdAt: string
    updatedAt: string
    version: string
  }
}

export type WorkspaceView = 'folders' | 'folder' | 'schematic' | 'document' | 'plan-space'

export type WorkspaceItemType = 'schematic' | 'document' | 'plan-space'

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createPlanSpace(): PlanSpace {
  const preset = createDefaultPlanSpacePreset()
  return {
    id: newId('plan'),
    ...preset,
  }
}

/** Seed preset into an existing empty plan space (e.g. migrated projects) */
export function seedPlanSpaceIfEmpty(planSpace: PlanSpace): PlanSpace {
  if (planSpace.bubbles.length > 0) return planSpace
  const preset = createDefaultPlanSpacePreset()
  return { ...planSpace, ...preset }
}

export function createSchematic(
  name: string,
  description = '',
  extra: Partial<Schematic> = {}
): Schematic {
  const now = new Date().toISOString()
  return {
    id: newId('schematic'),
    name,
    description,
    gridData: [],
    wires: [],
    componentStates: {},
    metadata: {
      createdAt: now,
      updatedAt: now,
      gridSize: { width: 50, height: 50 },
      zoom: 1,
      gridOffset: { x: -200, y: -200 },
    },
    ...extra,
  }
}

export function createDocument(name: string, content = ''): Document {
  const now = new Date().toISOString()
  return {
    id: newId('doc'),
    name,
    content,
    metadata: { createdAt: now, updatedAt: now },
  }
}

export function createProjectFolder(
  name: string,
  description = '',
  extra: Partial<ProjectFolder> = {}
): ProjectFolder {
  const now = new Date().toISOString()
  return {
    id: newId('folder'),
    name,
    description,
    schematics: [],
    documents: [],
    planSpace: createPlanSpace(),
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: '2.0.0',
    },
    ...extra,
  }
}

/** Migrate legacy UserProject (flat schematic) to ProjectFolder */
export function migrateToProjectFolder(old: Record<string, unknown>): ProjectFolder {
  if (Array.isArray(old.schematics)) {
    const folder = old as unknown as ProjectFolder
    if (!folder.planSpace) {
      folder.planSpace = createPlanSpace()
    } else {
      folder.planSpace = seedPlanSpaceIfEmpty(folder.planSpace)
    }
    return folder
  }

  const now = new Date().toISOString()
  const meta = (old.metadata as Record<string, unknown>) || {}
  const legacyMeta = meta as Partial<Schematic['metadata']>
  const schematic = createSchematic(
    (old.name as string) || 'Schematic 1',
    (old.description as string) || '',
    {
      gridData: (old.gridData as GridCell[][]) || [],
      occupiedComponents: old.occupiedComponents as unknown[],
      wires: (old.wires as WireConnection[]) || [],
      componentStates: (old.componentStates as Record<string, ComponentState>) || {},
      arduinoProject: old.arduinoProject as Schematic['arduinoProject'],
      metadata: {
        createdAt: (meta.createdAt as string) || now,
        updatedAt: (meta.updatedAt as string) || now,
        gridSize: legacyMeta.gridSize || { width: 50, height: 50 },
        zoom: legacyMeta.zoom ?? 1,
        gridOffset: legacyMeta.gridOffset || { x: -200, y: -200 },
      },
    }
  )

  return {
    id: (old.id as string) || newId('folder'),
    name: (old.name as string) || 'Project',
    description: old.description as string | undefined,
    schematics: [schematic],
    documents: [],
    planSpace: createPlanSpace(),
    metadata: {
      createdAt: (meta.createdAt as string) || now,
      updatedAt: (meta.updatedAt as string) || now,
      version: '2.0.0',
    },
  }
}
