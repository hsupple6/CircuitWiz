import {
  ProjectFolder,
  WorkspaceView,
  createProjectFolder,
  migrateToProjectFolder,
} from '../types/workspace'

const SESSION_KEY = 'circuitwiz-local-session'

export interface LocalSession {
  projectFolders: ProjectFolder[]
  selectedFolderId: string | null
  selectedItemId: string | null
  activeView: WorkspaceView
}

interface LegacySession {
  userProjects?: Record<string, unknown>[]
  selectedProjectId?: string | null
  currentView?: 'projects' | 'project'
}

export function loadLocalSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)

    if (parsed.projectFolders) {
      return parsed as LocalSession
    }

    const legacy = parsed as LegacySession
    const folders = (legacy.userProjects || []).map(migrateToProjectFolder)
    const wasInEditor = legacy.currentView === 'project' && legacy.selectedProjectId

    return {
      projectFolders: folders,
      selectedFolderId: wasInEditor ? legacy.selectedProjectId ?? null : null,
      selectedItemId: wasInEditor ? folders.find((f) => f.id === legacy.selectedProjectId)?.schematics[0]?.id ?? null : null,
      activeView: wasInEditor ? 'schematic' : 'folders',
    }
  } catch {
    return null
  }
}

export function saveLocalSession(session: LocalSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function createLocalProjectFolder(
  name: string,
  description: string,
  extra: Partial<ProjectFolder> = {}
): ProjectFolder {
  return createProjectFolder(name, description, extra)
}
