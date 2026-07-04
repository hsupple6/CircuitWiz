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

export interface SchematicCellLabel {
  id: string
  x: number
  y: number
  text: string
}

export function createSchematicCellLabel(x: number, y: number, text = ''): SchematicCellLabel {
  return {
    id: `label-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x,
    y,
    text,
  }
}

export interface ProgramFlashAssignment {
  programId: string
  flashedAt: string
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
  labels?: SchematicCellLabel[]
  /** Maps microcontroller component id → flashed program artifact */
  programFlashes?: Record<string, ProgramFlashAssignment>
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

export interface ProgramCompilationError {
  file: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface ProgramCompilation {
  success: boolean
  compiledAt: string
  output?: string
  errors?: ProgramCompilationError[]
  firmware?: string
  filename?: string
  size?: number
  binPath?: string
}

export interface Program {
  id: string
  name: string
  code: string
  board: string
  compilation?: ProgramCompilation
  metadata: {
    createdAt: string
    updatedAt: string
  }
}

export const DEFAULT_PROGRAM_CODE = `// Your sketch here
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`

export type PlanBubbleStageStatus = 'pending' | 'in_progress' | 'complete'

export type PipelineStage =
  | 'elicitation'
  | 'system_design'
  | 'schematic'
  | 'code_architecture'
  | 'bom'
  | 'assembly'

export interface PlanBubbleMetadata {
  stage?: PipelineStage
  status?: PlanBubbleStageStatus
  linkedSchematicId?: string
  linkedDocumentId?: string
  tags?: string[]
  notes?: string
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
  metadata?: PlanBubbleMetadata
}

export interface ProjectRequirements {
  useCase?: string
  environment?: string
  powerRequirements?: string
  commsProtocol?: string
  displaySize?: string
  unitCount?: number
  budgetRange?: string
  enclosurePreference?: string
  notes?: string
  custom?: Record<string, unknown>
}

export type ProductSuiteQuestionKind = 'choice' | 'text'

export interface ProductSuiteQuestion {
  id: string
  prompt: string
  kind: ProductSuiteQuestionKind
  options?: string[]
  /** When true, an "I don't know" option is always shown for choice questions */
  technical?: boolean
  suggestedAnswer?: string
  category?: string
}

export type ProductSuitePhase = 'blank' | 'questions'

export interface ProductSuiteSession {
  id: string
  phase: ProductSuitePhase
  idea: string
  prefill: Record<string, string>
  questions: ProductSuiteQuestion[]
  createdAt: string
}

export interface ProductDefinitionAnswer {
  questionId: string
  prompt: string
  answer: string
  category?: string
}

export interface ProductDefinition {
  id: string
  idea: string
  summary: string
  answers: ProductDefinitionAnswer[]
  metadata: {
    createdAt: string
    updatedAt: string
    completedAt?: string
  }
}

export interface BOMLineItem {
  id: string
  description: string
  partNumber?: string
  manufacturer?: string
  quantity: number
  unitPrice?: number
  substitutes?: string[]
  purchaseUrl?: string
  schematicComponentIds?: string[]
  notes?: string
}

export interface BOM {
  id: string
  name: string
  lineItems: BOMLineItem[]
  metadata: {
    createdAt: string
    updatedAt: string
  }
}

export interface AssemblyChecklistItem {
  id: string
  step: number
  title: string
  description?: string
  completed: boolean
}

export interface AssemblyGuide {
  id: string
  name: string
  wiringNotes?: string
  solderingNotes?: string
  flashGuide?: string
  checklist: AssemblyChecklistItem[]
  metadata: {
    createdAt: string
    updatedAt: string
  }
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
  programs: Program[]
  planSpace: PlanSpace
  requirements?: ProjectRequirements
  productDefinition?: ProductDefinition
  productSuiteSession?: ProductSuiteSession
  bom?: BOM
  assembly?: AssemblyGuide
  metadata: {
    createdAt: string
    updatedAt: string
    version: string
  }
}

export type WorkspaceView =
  | 'folders'
  | 'folder'
  | 'schematic'
  | 'document'
  | 'program'
  | 'plan-space'
  | 'style-dev'

export type WorkspaceItemType = 'schematic' | 'document' | 'program' | 'plan-space'

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

export function createProgram(name: string, code = DEFAULT_PROGRAM_CODE, board = 'arduino:avr:uno'): Program {
  const now = new Date().toISOString()
  return {
    id: newId('program'),
    name,
    code,
    board,
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
    programs: [],
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
    if (!folder.programs) {
      folder.programs = []
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
    programs: [],
    planSpace: createPlanSpace(),
    metadata: {
      createdAt: (meta.createdAt as string) || now,
      updatedAt: (meta.updatedAt as string) || now,
      version: '2.0.0',
    },
  }
}
