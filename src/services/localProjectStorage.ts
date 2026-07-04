import {
  ProjectFolder,
  Schematic,
  WorkspaceView,
  createProjectFolder,
  migrateToProjectFolder,
} from '../types/workspace'
import {
  extractOccupiedComponents,
  reconstructGridData,
  type OccupiedComponent,
} from '../utils/gridUtils'

const SESSION_KEY = 'circuitwiz-local-session'

export interface LocalSession {
  projectFolders: ProjectFolder[]
  selectedFolderId: string | null
  selectedItemId: string | null
  activeView: WorkspaceView
}

export interface LocalSaveResult {
  ok: boolean
  error?: string
  compacted?: boolean
}

interface LegacySession {
  userProjects?: Record<string, unknown>[]
  selectedProjectId?: string | null
  currentView?: 'projects' | 'project'
}

function compactSchematicForStorage(schematic: Schematic): Schematic {
  const occupied =
    (schematic.occupiedComponents as OccupiedComponent[] | undefined) ??
    (schematic.gridData?.length ? extractOccupiedComponents(schematic.gridData) : [])

  return {
    ...schematic,
    gridData: [],
    occupiedComponents: occupied,
    componentStates: {},
  }
}

function hydrateSchematicFromStorage(schematic: Schematic): Schematic {
  const hasGrid = Boolean(schematic.gridData?.length && schematic.gridData[0]?.length)
  if (hasGrid) {
    return { ...schematic, componentStates: schematic.componentStates ?? {} }
  }

  const components = (schematic.occupiedComponents ?? []) as OccupiedComponent[]
  const gridSize = schematic.metadata?.gridSize ?? { width: 50, height: 50 }

  return {
    ...schematic,
    gridData: reconstructGridData(components, gridSize),
    componentStates: {},
  }
}

function compactFolderForStorage(folder: ProjectFolder): ProjectFolder {
  return {
    ...folder,
    schematics: folder.schematics.map(compactSchematicForStorage),
  }
}

function hydrateFolderFromStorage(folder: ProjectFolder): ProjectFolder {
  return {
    ...folder,
    schematics: folder.schematics.map(hydrateSchematicFromStorage),
  }
}

function compactSessionForStorage(session: LocalSession): LocalSession {
  return {
    ...session,
    projectFolders: session.projectFolders.map(compactFolderForStorage),
  }
}

function writeSession(raw: string): LocalSaveResult {
  try {
    localStorage.setItem(SESSION_KEY, raw)
    return { ok: true }
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'Local storage is full. Free space in your browser or remove old projects.'
        : error instanceof Error
          ? error.message
          : 'Failed to save local session'
    return { ok: false, error: message }
  }
}

export function loadLocalSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)

    if (parsed.projectFolders) {
      const session = parsed as LocalSession
      return {
        ...session,
        projectFolders: session.projectFolders.map(hydrateFolderFromStorage),
      }
    }

    const legacy = parsed as LegacySession
    const folders = (legacy.userProjects || []).map(migrateToProjectFolder).map(hydrateFolderFromStorage)
    const wasInEditor = legacy.currentView === 'project' && legacy.selectedProjectId

    return {
      projectFolders: folders,
      selectedFolderId: wasInEditor ? legacy.selectedProjectId ?? null : null,
      selectedItemId: wasInEditor
        ? folders.find((f) => f.id === legacy.selectedProjectId)?.schematics[0]?.id ?? null
        : null,
      activeView: wasInEditor ? 'schematic' : 'folders',
    }
  } catch {
    return null
  }
}

export function saveLocalSession(session: LocalSession): LocalSaveResult {
  const compacted = compactSessionForStorage(session)
  const payload = JSON.stringify(compacted)
  const result = writeSession(payload)
  if (result.ok) return { ok: true, compacted: true }
  return result
}

export function createLocalProjectFolder(
  name: string,
  description: string,
  extra: Partial<ProjectFolder> = {}
): ProjectFolder {
  return createProjectFolder(name, description, extra)
}
