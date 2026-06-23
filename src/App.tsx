import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus,
  Search,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  FolderOpen,
} from 'lucide-react'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { extractOccupiedComponents } from './utils/gridUtils'
import { AppearancePanel } from './components/AppearancePanel'
import { CarbonLogo } from './components/CarbonLogo'
import { ProjectGrid } from './components/ProjectGrid'
import { ComponentPalette } from './components/ComponentPalette'
import { SchematicGroupBoxBrowser } from './components/SchematicGroupBoxBrowser'
import { ProjectPreview } from './components/ProjectPreview'
import { ProjectFolderView } from './components/ProjectFolderView'
import { DocumentEditor } from './components/DocumentEditor'
import { PlanSpaceEditor } from './components/PlanSpaceEditor'
import { ResistanceSelector } from './components/ResistanceSelector'
import { CapacitanceSelector } from './components/CapacitanceSelector'
import { InductanceSelector } from './components/InductanceSelector'
import { HoverStatsPanel } from './components/HoverStatsPanel'
import type { HoverStats } from './utils/hoverStats'
import type { ComponentState } from './systems/ElectricalSystem'
import { ModuleDefinition } from './modules/types'
import {
  ProjectFolder,
  Schematic,
  WorkspaceView,
  createSchematic,
  createDocument,
  seedPlanSpaceIfEmpty,
  type SchematicGroupBox,
} from './types/workspace'
import {
  loadLocalSession,
  saveLocalSession,
  createLocalProjectFolder,
} from './services/localProjectStorage'
import { ensureExamplesProject, hasExamplesProject } from './examples/examplesProject'

interface SaveStatusProps {
  isSaving: boolean
  lastSaved: Date | null
  error: string | null
  hasUnsavedChanges: boolean
}

function SaveStatus({ isSaving, lastSaved, error, hasUnsavedChanges }: SaveStatusProps) {
  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const getRelativeTime = (date: Date) => {
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffSeconds < 60) return `${diffSeconds}s ago`
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Save failed</span>
      </div>
    )
  }
  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
        <div className="animate-spin"><Save className="h-4 w-4" /></div>
        <span className="text-sm animate-pulse">Saving...</span>
      </div>
    )
  }
  if (lastSaved) {
    const isRecent = Date.now() - lastSaved.getTime() < 3000
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm">
          {isRecent ? <span className="animate-pulse">Saved</span> : <>Saved at {formatTime(lastSaved)} ({getRelativeTime(lastSaved)})</>}
        </span>
      </div>
    )
  }
  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
        <div className="animate-pulse"><Save className="h-4 w-4" /></div>
        <span className="text-sm">Unsaved changes</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
      <Clock className="h-4 w-4" />
      <span className="text-sm">Not saved</span>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

function AppContent() {
  const { getAccessToken } = useAuth()
  const [activeView, setActiveView] = useState<WorkspaceView>('folders')
  const [projectFolders, setProjectFolders] = useState<ProjectFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<ProjectFolder | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedModule, setSelectedModule] = useState<ModuleDefinition | null>(null)
  const [passiveValueSelector, setPassiveValueSelector] = useState<'resistor' | 'capacitor' | 'inductor' | null>(null)
  const [selectedResistance, setSelectedResistance] = useState(1000)
  const [selectedCapacitance, setSelectedCapacitance] = useState(0.0001)
  const [selectedInductance, setSelectedInductance] = useState(0.001)
  const [componentStates, setComponentStates] = useState<Map<string, ComponentState>>(new Map())
  const [zoom, setZoom] = useState(1)
  const [hoveredPosition, setHoveredPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoverStats, setHoverStats] = useState<HoverStats | null>(null)
  const [groupBoxes, setGroupBoxes] = useState<SchematicGroupBox[]>([])
  const [selectedGroupBoxId, setSelectedGroupBoxId] = useState<string | null>(null)
  const [focusGroupBoxRequest, setFocusGroupBoxRequest] = useState<SchematicGroupBox | null>(null)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'folder' | 'schematic' | 'document'
    folderId: string
    itemId?: string
    name: string
  } | null>(null)
  const [saveStatus, setSaveStatus] = useState({
    isSaving: false,
    lastSaved: null as Date | null,
    error: null as string | null,
    hasUnsavedChanges: false,
  })
  const [, setLastSavedState] = useState<Record<string, unknown> | null>(null)

  const selectedSchematic = useMemo(() => {
    if (!selectedFolder || !selectedItemId || activeView !== 'schematic') return null
    return selectedFolder.schematics.find((s) => s.id === selectedItemId) ?? null
  }, [selectedFolder, selectedItemId, activeView])

  useEffect(() => {
    if (selectedSchematic) {
      setGroupBoxes(selectedSchematic.groupBoxes ?? [])
      setSelectedGroupBoxId(null)
      setFocusGroupBoxRequest(null)
    }
  }, [selectedSchematic?.id])

  const selectedDocument = useMemo(() => {
    if (!selectedFolder || !selectedItemId || activeView !== 'document') return null
    return selectedFolder.documents.find((d) => d.id === selectedItemId) ?? null
  }, [selectedFolder, selectedItemId, activeView])

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return projectFolders
    const q = searchQuery.toLowerCase()
    return projectFolders.filter(
      (f) => f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q)
    )
  }, [projectFolders, searchQuery])

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.1, 3)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.1, 0.25)), [])
  const handleZoomReset = useCallback(() => setZoom(1), [])

  const persistSession = useCallback((
    folders: ProjectFolder[],
    folder: ProjectFolder | null,
    itemId: string | null,
    view: WorkspaceView
  ) => {
    saveLocalSession({
      projectFolders: folders,
      selectedFolderId: folder?.id ?? null,
      selectedItemId: itemId,
      activeView: view,
    })
  }, [])

  const updateFolders = useCallback((
    updater: (folders: ProjectFolder[]) => ProjectFolder[],
    folder?: ProjectFolder | null,
    itemId?: string | null,
    view?: WorkspaceView
  ) => {
    setProjectFolders((prev) => {
      const next = updater(prev)
      const activeFolder = folder ?? selectedFolder
      if (activeFolder) {
        const updated = next.find((f) => f.id === activeFolder.id)
        if (updated) setSelectedFolder(updated)
      }
      persistSession(next, folder ?? selectedFolder, itemId ?? selectedItemId, view ?? activeView)
      return next
    })
  }, [selectedFolder, selectedItemId, activeView, persistSession])

  useEffect(() => {
    const session = loadLocalSession()
    const previous = session?.projectFolders || []
    const folders = ensureExamplesProject(previous)

    setProjectFolders(folders)

    const examplesAdded = !hasExamplesProject(previous)
    if (!session || examplesAdded) {
      persistSession(
        folders,
        session?.selectedFolderId ? folders.find((f) => f.id === session.selectedFolderId) ?? null : null,
        session?.selectedItemId ?? null,
        session?.activeView ?? 'folders'
      )
    }

    if (!session) return

    if (session.selectedFolderId) {
      const folder = folders.find((f) => f.id === session.selectedFolderId)
      if (folder) {
        setSelectedFolder(folder)
        setSelectedItemId(session.selectedItemId)
        setActiveView(session.activeView || 'folder')

        if (session.activeView === 'schematic' && session.selectedItemId) {
          const schematic = folder.schematics.find((s) => s.id === session.selectedItemId)
          if (schematic) {
            setLastSavedState({
              gridData: schematic.gridData,
              wires: schematic.wires,
              componentStates: schematic.componentStates,
            })
            setSaveStatus({
              isSaving: false,
              lastSaved: schematic.metadata?.updatedAt ? new Date(schematic.metadata.updatedAt) : null,
              error: null,
              hasUnsavedChanges: false,
            })
          }
        }
      }
    }
  }, [])

  const handleCreateFolder = () => {
    setProjectsLoading(true)
    try {
      const folder = createLocalProjectFolder(
        `Project ${projectFolders.length + 1}`,
        'A new electronics project'
      )
      const next = [folder, ...projectFolders]
      setProjectFolders(next)
      setSelectedFolder(folder)
      setSelectedItemId(null)
      setActiveView('folder')
      persistSession(next, folder, null, 'folder')
    } finally {
      setProjectsLoading(false)
    }
  }

  const handleOpenFolder = (folder: ProjectFolder) => {
    setSelectedFolder(folder)
    setSelectedItemId(null)
    setActiveView('folder')
    persistSession(projectFolders, folder, null, 'folder')
  }

  const handleBackToFolders = () => {
    setActiveView('folders')
    setSelectedFolder(null)
    setSelectedItemId(null)
    setSelectedModule(null)
    persistSession(projectFolders, null, null, 'folders')
  }

  const handleBackToFolder = () => {
    if (!selectedFolder) return
    setActiveView('folder')
    setSelectedItemId(null)
    setSelectedModule(null)
    persistSession(projectFolders, selectedFolder, null, 'folder')
  }

  const handleDeleteFolder = (folderId: string) => {
    const next = projectFolders.filter((f) => f.id !== folderId)
    setProjectFolders(next)
    setDeleteModal(null)
    if (selectedFolder?.id === folderId) {
      setSelectedFolder(null)
      setActiveView('folders')
      persistSession(next, null, null, 'folders')
    } else {
      persistSession(next, selectedFolder, selectedItemId, activeView)
    }
  }

  const handleCreateSchematic = () => {
    if (!selectedFolder) return
    const count = selectedFolder.schematics.length
    const schematic = createSchematic(`Schematic ${count + 1}`)
    const updated: ProjectFolder = {
      ...selectedFolder,
      schematics: [schematic, ...selectedFolder.schematics],
      metadata: { ...selectedFolder.metadata, updatedAt: new Date().toISOString() },
    }
    updateFolders(
      (folders) => folders.map((f) => (f.id === updated.id ? updated : f)),
      updated,
      schematic.id,
      'schematic'
    )
    setSelectedItemId(schematic.id)
    setActiveView('schematic')
    setLastSavedState({ gridData: [], wires: [], componentStates: {} })
    setSaveStatus({ isSaving: false, lastSaved: new Date(), error: null, hasUnsavedChanges: false })
  }

  const handleCreateDocument = () => {
    if (!selectedFolder) return
    const count = selectedFolder.documents.length
    const doc = createDocument(`Document ${count + 1}`)
    const updated: ProjectFolder = {
      ...selectedFolder,
      documents: [doc, ...selectedFolder.documents],
      metadata: { ...selectedFolder.metadata, updatedAt: new Date().toISOString() },
    }
    updateFolders(
      (folders) => folders.map((f) => (f.id === updated.id ? updated : f)),
      updated,
      doc.id,
      'document'
    )
    setSelectedItemId(doc.id)
    setActiveView('document')
  }

  const handleOpenSchematic = (schematicId: string) => {
    if (!selectedFolder) return
    const schematic = selectedFolder.schematics.find((s) => s.id === schematicId)
    if (!schematic) return
    setSelectedItemId(schematicId)
    setActiveView('schematic')
    persistSession(projectFolders, selectedFolder, schematicId, 'schematic')
    setLastSavedState({
      gridData: schematic.gridData,
      wires: schematic.wires,
      componentStates: schematic.componentStates,
    })
    setSaveStatus({
      isSaving: false,
      lastSaved: schematic.metadata?.updatedAt ? new Date(schematic.metadata.updatedAt) : null,
      error: null,
      hasUnsavedChanges: false,
    })
  }

  const handleOpenDocument = (documentId: string) => {
    if (!selectedFolder) return
    setSelectedItemId(documentId)
    setActiveView('document')
    persistSession(projectFolders, selectedFolder, documentId, 'document')
  }

  const handleOpenPlanSpace = () => {
    if (!selectedFolder) return
    const planSpace = seedPlanSpaceIfEmpty(selectedFolder.planSpace)
    setZoom(planSpace.metadata.zoom)
    setSelectedItemId(planSpace.id)
    setActiveView('plan-space')

    if (planSpace !== selectedFolder.planSpace) {
      const updatedFolder = { ...selectedFolder, planSpace }
      updateFolders(
        (folders) => folders.map((f) => (f.id === updatedFolder.id ? updatedFolder : f)),
        updatedFolder,
        planSpace.id,
        'plan-space'
      )
    } else {
      persistSession(projectFolders, selectedFolder, planSpace.id, 'plan-space')
    }
  }

  const handleDeleteSchematic = (schematicId: string) => {
    if (!selectedFolder) return
    const schematic = selectedFolder.schematics.find((s) => s.id === schematicId)
    setDeleteModal({
      isOpen: true,
      type: 'schematic',
      folderId: selectedFolder.id,
      itemId: schematicId,
      name: schematic?.name || 'Schematic',
    })
  }

  const handleDeleteDocument = (documentId: string) => {
    if (!selectedFolder) return
    const doc = selectedFolder.documents.find((d) => d.id === documentId)
    setDeleteModal({
      isOpen: true,
      type: 'document',
      folderId: selectedFolder.id,
      itemId: documentId,
      name: doc?.name || 'Document',
    })
  }

  const confirmDelete = () => {
    if (!deleteModal) return
    if (deleteModal.type === 'folder') {
      handleDeleteFolder(deleteModal.folderId)
      return
    }
    if (!deleteModal.itemId) return

    updateFolders((folders) =>
      folders.map((f) => {
        if (f.id !== deleteModal.folderId) return f
        if (deleteModal.type === 'schematic') {
          return { ...f, schematics: f.schematics.filter((s) => s.id !== deleteModal.itemId) }
        }
        return { ...f, documents: f.documents.filter((d) => d.id !== deleteModal.itemId) }
      })
    )
    if (selectedItemId === deleteModal.itemId) {
      setSelectedItemId(null)
      setActiveView('folder')
    }
    setDeleteModal(null)
  }

  const createSampleFolder = (type: 'led-blink' | 'temperature-sensor') => {
    setProjectsLoading(true)
    try {
      let schematicExtra: Partial<Schematic> = {}
      if (type === 'led-blink') {
        schematicExtra = {
          name: 'LED Blink Circuit',
          arduinoProject: {
            name: 'LED Blink',
            files: [{
              name: 'LED_Blink.ino',
              content: `void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}`,
              type: 'ino' as const,
              isMain: true,
            }],
            board: 'arduino:avr:uno',
            libraries: [],
          },
        }
      } else {
        schematicExtra = {
          name: 'Temperature Sensor',
          arduinoProject: {
            name: 'Temperature Sensor',
            files: [{
              name: 'Temperature_Sensor.ino',
              content: `void setup() {\n  Serial.begin(9600);\n}\nvoid loop() {\n  int v = analogRead(A0);\n  Serial.println(v * (5.0 / 1023.0) * 100);\n  delay(1000);\n}`,
              type: 'ino' as const,
              isMain: true,
            }],
            board: 'arduino:avr:uno',
            libraries: [],
          },
        }
      }

      const folder = createLocalProjectFolder(
        type === 'led-blink' ? 'LED Blink' : 'Temperature Sensor',
        type === 'led-blink'
          ? 'A simple circuit to blink an LED using Arduino'
          : 'Read temperature with a sensor and display on serial',
        {
          schematics: [createSchematic(
            schematicExtra.name || 'Schematic 1',
            '',
            schematicExtra
          )],
        }
      )
      const next = [folder, ...projectFolders]
      setProjectFolders(next)
      setSelectedFolder(folder)
      setActiveView('folder')
      persistSession(next, folder, null, 'folder')
    } finally {
      setProjectsLoading(false)
    }
  }

  const handleModuleSelect = (module: ModuleDefinition | null) => {
    setSelectedModule(module)
    if (module?.module === 'Resistor') setPassiveValueSelector('resistor')
    else if (module?.module === 'Capacitor') setPassiveValueSelector('capacitor')
    else if (module?.module === 'Inductor') setPassiveValueSelector('inductor')
    else setPassiveValueSelector(null)
  }

  const handleResistanceSelect = (resistance: number) => {
    setSelectedResistance(resistance)
    setPassiveValueSelector(null)
    if (selectedModule?.module === 'Resistor') {
      setSelectedModule({ ...selectedModule, properties: { ...(selectedModule as any).properties, resistance } } as ModuleDefinition)
    }
  }

  const handleCapacitanceSelect = (capacitance: number) => {
    setSelectedCapacitance(capacitance)
    setPassiveValueSelector(null)
    if (selectedModule?.module === 'Capacitor') {
      setSelectedModule({ ...selectedModule, properties: { ...(selectedModule as any).properties, capacitance } } as ModuleDefinition)
    }
  }

  const handleInductanceSelect = (inductance: number) => {
    setSelectedInductance(inductance)
    setPassiveValueSelector(null)
    if (selectedModule?.module === 'Inductor') {
      setSelectedModule({ ...selectedModule, properties: { ...(selectedModule as any).properties, inductance } } as ModuleDefinition)
    }
  }

  const handleSchematicDataChange = useCallback(async (projectData: {
    gridData?: unknown[][]
    wires?: unknown[]
    componentStates?: Record<string, unknown>
    groupBoxes?: SchematicGroupBox[]
    hasUnsavedChanges?: boolean
    triggerUnsavedCheck?: boolean
  }) => {
    if (!selectedFolder || !selectedSchematic) return

    if (projectData.hasUnsavedChanges !== undefined) {
      setSaveStatus((prev) => ({ ...prev, hasUnsavedChanges: projectData.hasUnsavedChanges || false }))
      if (projectData.hasUnsavedChanges) return
    }
    if (projectData.triggerUnsavedCheck) {
      setSaveStatus((prev) => ({ ...prev, hasUnsavedChanges: true }))
      return
    }

    try {
      setSaveStatus({ isSaving: true, lastSaved: null, error: null, hasUnsavedChanges: false })

      const occupiedComponents = projectData.gridData
        ? extractOccupiedComponents(projectData.gridData as never)
        : []

      const updatedSchematic: Schematic = {
        ...selectedSchematic,
        gridData: (projectData.gridData as Schematic['gridData']) || selectedSchematic.gridData,
        wires: (projectData.wires as Schematic['wires']) || selectedSchematic.wires,
        componentStates: (projectData.componentStates as Schematic['componentStates']) || selectedSchematic.componentStates,
        groupBoxes: projectData.groupBoxes ?? selectedSchematic.groupBoxes ?? [],
        occupiedComponents,
        metadata: { ...selectedSchematic.metadata, updatedAt: new Date().toISOString() },
      }

      const updatedFolder: ProjectFolder = {
        ...selectedFolder,
        schematics: selectedFolder.schematics.map((s) =>
          s.id === updatedSchematic.id ? updatedSchematic : s
        ),
        metadata: { ...selectedFolder.metadata, updatedAt: new Date().toISOString() },
      }

      updateFolders(
        (folders) => folders.map((f) => (f.id === updatedFolder.id ? updatedFolder : f)),
        updatedFolder,
        selectedSchematic.id,
        'schematic'
      )

      setSaveStatus({ isSaving: false, lastSaved: new Date(), error: null, hasUnsavedChanges: false })
      setLastSavedState({
        gridData: updatedSchematic.gridData,
        wires: updatedSchematic.wires,
        componentStates: updatedSchematic.componentStates,
      })
    } catch (error) {
      setSaveStatus({
        isSaving: false,
        lastSaved: null,
        error: error instanceof Error ? error.message : 'Save failed',
        hasUnsavedChanges: true,
      })
    }
  }, [selectedFolder, selectedSchematic, updateFolders])

  const documentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDocumentChange = (content: string) => {
    if (!selectedFolder || !selectedDocument) return
    const docId = selectedDocument.id
    const folderId = selectedFolder.id

    if (documentSaveTimer.current) clearTimeout(documentSaveTimer.current)
    documentSaveTimer.current = setTimeout(() => {
      setProjectFolders((prev) => {
        const folder = prev.find((f) => f.id === folderId)
        const doc = folder?.documents.find((d) => d.id === docId)
        if (!folder || !doc) return prev

        const updatedDoc = {
          ...doc,
          content,
          metadata: { ...doc.metadata, updatedAt: new Date().toISOString() },
        }
        const updatedFolder: ProjectFolder = {
          ...folder,
          documents: folder.documents.map((d) => (d.id === docId ? updatedDoc : d)),
          metadata: { ...folder.metadata, updatedAt: new Date().toISOString() },
        }
        const next = prev.map((f) => (f.id === folderId ? updatedFolder : f))
        setSelectedFolder(updatedFolder)
        persistSession(next, updatedFolder, docId, 'document')
        return next
      })
    }, 400)
  }

  const handleDocumentNameChange = (name: string) => {
    if (!selectedFolder || !selectedDocument) return
    const updatedDoc = { ...selectedDocument, name, metadata: { ...selectedDocument.metadata, updatedAt: new Date().toISOString() } }
    const updatedFolder: ProjectFolder = {
      ...selectedFolder,
      documents: selectedFolder.documents.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)),
    }
    updateFolders(
      (folders) => folders.map((f) => (f.id === updatedFolder.id ? updatedFolder : f)),
      updatedFolder,
      selectedDocument.id,
      'document'
    )
  }

  const handlePlanSpaceChange = (planSpace: ProjectFolder['planSpace']) => {
    if (!selectedFolder) return
    const updatedFolder: ProjectFolder = {
      ...selectedFolder,
      planSpace,
      metadata: { ...selectedFolder.metadata, updatedAt: new Date().toISOString() },
    }
    updateFolders(
      (folders) => folders.map((f) => (f.id === updatedFolder.id ? updatedFolder : f)),
      updatedFolder,
      planSpace.id,
      'plan-space'
    )
  }

  const editorTopBar = (title: string, backLabel: string, onBack: () => void, showSave = false) => (
    <div className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/[0.06] bg-black px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-primary-300 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          {backLabel}
        </button>
        <div className="h-6 w-px bg-white/10" />
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
          {showSave && (
            <SaveStatus
              isSaving={saveStatus.isSaving}
              lastSaved={saveStatus.lastSaved}
              error={saveStatus.error}
              hasUnsavedChanges={saveStatus.hasUnsavedChanges}
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {activeView === 'schematic' && (
          <>
            <div className="text-sm text-zinc-500 font-mono truncate max-w-[240px]">
              {hoverStats
                ? `${hoverStats.title}${hoverStats.status ? ` · ${hoverStats.status.label}` : ''}`
                : hoveredPosition
                  ? `(${hoveredPosition.x}, ${hoveredPosition.y})`
                  : 'Hover for live stats'}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleZoomOut} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-secondary" title="Zoom Out">
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-500 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-secondary" title="Zoom In">
                <ZoomIn className="h-5 w-5" />
              </button>
              <button onClick={handleZoomReset} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-secondary" title="Reset Zoom">
                <Maximize2 className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
        {activeView === 'plan-space' && (
          <div className="flex items-center gap-2">
            <button onClick={handleZoomOut} className="p-2 text-gray-400 hover:text-gray-600" title="Zoom Out"><ZoomOut className="h-5 w-5" /></button>
            <span className="text-sm text-gray-500 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-2 text-gray-400 hover:text-gray-600" title="Zoom In"><ZoomIn className="h-5 w-5" /></button>
            <button onClick={handleZoomReset} className="p-2 text-gray-400 hover:text-gray-600" title="Reset Zoom"><Maximize2 className="h-5 w-5" /></button>
          </div>
        )}
        <AppearancePanel />
      </div>
    </div>
  )

  // Schematic editor
  if (activeView === 'schematic' && selectedFolder && selectedSchematic) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        {editorTopBar(selectedSchematic.name, selectedFolder.name, handleBackToFolder, true)}
        <div className="flex h-[calc(100vh-4rem)] min-h-0">
          <div className="w-80 flex flex-col border-r border-gray-200 dark:border-dark-border shrink-0 bg-white dark:bg-dark-surface min-h-0">
            <ComponentPalette selectedModule={selectedModule} onModuleSelect={handleModuleSelect} />
            <SchematicGroupBoxBrowser
              groupBoxes={groupBoxes}
              selectedId={selectedGroupBoxId}
              onSelect={setSelectedGroupBoxId}
              onUpdate={(id, patch) =>
                setGroupBoxes((prev) => prev.map((box) => (box.id === id ? { ...box, ...patch } : box)))
              }
              onDelete={(id) => {
                setGroupBoxes((prev) => prev.filter((box) => box.id !== id))
                if (selectedGroupBoxId === id) setSelectedGroupBoxId(null)
              }}
              onFocus={(box) => setFocusGroupBoxRequest(box)}
            />
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            <ProjectGrid
              project={{
                id: 1,
                name: selectedSchematic.name,
                lastModified: selectedSchematic.metadata.updatedAt,
                preview: selectedSchematic.description || '',
                gridSize: selectedSchematic.metadata.gridSize,
              }}
              selectedModule={selectedModule}
              onModuleSelect={handleModuleSelect}
              onComponentStatesChange={setComponentStates}
              initialGridData={selectedSchematic.gridData || []}
              initialWires={selectedSchematic.wires || []}
              initialComponentStates={selectedSchematic.componentStates || {}}
              initialGroupBoxes={selectedSchematic.groupBoxes || []}
              groupBoxes={groupBoxes}
              onGroupBoxesChange={setGroupBoxes}
              selectedGroupBoxId={selectedGroupBoxId}
              onSelectedGroupBoxIdChange={setSelectedGroupBoxId}
              focusGroupBoxRequest={focusGroupBoxRequest}
              onFocusGroupBoxHandled={() => setFocusGroupBoxRequest(null)}
              projectId={selectedSchematic.id}
              getAccessToken={getAccessToken}
              onProjectDataChange={handleSchematicDataChange}
              zoom={zoom}
              onZoomChange={setZoom}
              onHoveredPositionChange={setHoveredPosition}
              onHoverStatsChange={setHoverStats}
            />
          </div>
          <HoverStatsPanel stats={hoverStats} />
        </div>
        {passiveValueSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
                {passiveValueSelector === 'resistor' && 'Select Resistor Value'}
                {passiveValueSelector === 'capacitor' && 'Select Capacitance'}
                {passiveValueSelector === 'inductor' && 'Select Inductance'}
              </h3>
              {passiveValueSelector === 'resistor' && (
                <ResistanceSelector currentResistance={selectedResistance} onResistanceChange={handleResistanceSelect} onClose={() => setPassiveValueSelector(null)} />
              )}
              {passiveValueSelector === 'capacitor' && (
                <CapacitanceSelector currentCapacitance={selectedCapacitance} onCapacitanceChange={handleCapacitanceSelect} onClose={() => setPassiveValueSelector(null)} />
              )}
              {passiveValueSelector === 'inductor' && (
                <InductanceSelector currentInductance={selectedInductance} onInductanceChange={handleInductanceSelect} onClose={() => setPassiveValueSelector(null)} />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Document editor
  if (activeView === 'document' && selectedFolder && selectedDocument) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        {editorTopBar(selectedDocument.name, selectedFolder.name, handleBackToFolder)}
        <div className="h-[calc(100vh-4rem)]">
          <DocumentEditor
            name={selectedDocument.name}
            content={selectedDocument.content}
            onChange={handleDocumentChange}
            onNameChange={handleDocumentNameChange}
          />
        </div>
      </div>
    )
  }

  // Plan space editor
  if (activeView === 'plan-space' && selectedFolder) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        {editorTopBar('Plan Space', selectedFolder.name, handleBackToFolder)}
        <div className="h-[calc(100vh-4rem)]">
          <PlanSpaceEditor
            planSpace={selectedFolder.planSpace}
            onChange={handlePlanSpaceChange}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>
      </div>
    )
  }

  // Folder view
  if (activeView === 'folder' && selectedFolder) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="sticky top-0 z-10 flex h-16 items-center gap-x-4 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 shadow-sm">
          <button
            onClick={handleBackToFolders}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-dark-text-secondary dark:hover:text-dark-text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
            All Projects
          </button>
          <div className="h-6 w-px bg-gray-200 dark:bg-dark-border" />
          <FolderOpen className="h-5 w-5 text-primary-500" />
          <span className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">{selectedFolder.name}</span>
          <div className="flex-1" />
          <AppearancePanel />
        </div>
        <ProjectFolderView
          folder={selectedFolder}
          onOpenSchematic={handleOpenSchematic}
          onOpenDocument={handleOpenDocument}
          onOpenPlanSpace={handleOpenPlanSpace}
          onCreateSchematic={handleCreateSchematic}
          onCreateDocument={handleCreateDocument}
          onDeleteSchematic={handleDeleteSchematic}
          onDeleteDocument={handleDeleteDocument}
        />
        {deleteModal?.isOpen && (
          <DeleteModal modal={deleteModal} onClose={() => setDeleteModal(null)} onConfirm={confirmDelete} />
        )}
      </div>
    )
  }

  // Projects list (folders)
  return (
    <div className="grid h-screen grid-rows-[10fr_90fr] bg-black overflow-hidden">
      {/* Top 10% — Carbon + search */}
      <header className="flex min-h-0 items-center gap-x-4 bg-black sm:gap-x-6">
        <CarbonLogo size="lg" />
        <div className="flex flex-1 items-center gap-x-4 lg:gap-x-6">
          <div className="relative ml-auto flex flex-1 max-w-xl">
            <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-zinc-500 pl-3" />
            <input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block h-10 w-full rounded-lg border border-white/[0.08] bg-carbon-surface py-0 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-primary-400/50 focus:outline-none focus:ring-1 focus:ring-primary-400/30"
            />
          </div>
          <AppearancePanel />
        </div>
      </header>

      {/* Bottom 90% — Your Projects */}
      <main className="relative flex min-h-0 flex-col overflow-hidden bg-carbon-matte">
        {/* Huge orb — bottom right */}
        <div
          className="pointer-events-none absolute -bottom-[45%] -right-[25%] h-[min(1100px,95vw)] w-[min(1100px,95vw)] rounded-full carbon-orb"
          aria-hidden
        />

        <div className="relative shrink-0 pt-8 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl px-4 sm:px-6 lg:px-8">Your Projects</h1>
          <p className="mt-3 max-w-2xl text-base text-zinc-400 px-4 sm:px-6 lg:px-8">
            Each project is a folder containing schematics, documents, and a plan space
          </p>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto pb-8">
          <div className="grid grid-cols-1 gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8 xl:grid-cols-4">
            <div
              className="carbon-card group cursor-pointer border-dashed border-primary-400/20 p-6 transition-colors hover:border-primary-400/40 hover:bg-carbon-elevated/50"
              onClick={handleCreateFolder}
            >
              <div className="flex h-48 flex-col items-center justify-center">
                <Plus className="h-12 w-12 text-zinc-600 transition-colors group-hover:text-primary-400" />
                <h3 className="mt-4 text-lg font-medium text-zinc-100">New Project</h3>
                <p className="mt-2 text-center text-sm text-zinc-500">Create a new project folder</p>
              </div>
            </div>

            {projectsLoading && (
              <div className="col-span-full flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
              </div>
            )}

            {filteredFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onClick={() => handleOpenFolder(folder)}
                onDelete={() => setDeleteModal({ isOpen: true, type: 'folder', folderId: folder.id, name: folder.name })}
              />
            ))}

            {!projectsLoading && projectFolders.length <= 1 && (
              <div className="col-span-full">
                <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-carbon-card py-12 text-center">
                  <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full carbon-orb-sm" aria-hidden />
                  <CarbonLogo size="xl" className="mb-6 block mx-auto" />
                  <h3 className="mb-2 text-2xl font-bold text-zinc-50">Welcome to Carbon</h3>
                  <p className="mx-auto mb-6 max-w-md text-zinc-400">
                    Open the <strong className="text-primary-300">Examples</strong> folder for preset simulation test circuits, or create your own project.
                  </p>
                  <button
                    onClick={handleCreateFolder}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-400 px-6 py-3 font-medium text-black transition-colors hover:bg-primary-300"
                  >
                    <Plus className="h-5 w-5" />
                    Create a Project
                  </button>
                </div>
                <div className="carbon-card rounded-xl p-6">
                  <h4 className="mb-4 text-lg font-semibold text-zinc-100">Try These Sample Projects</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SampleCard title="LED Blink Circuit" description="A simple circuit to blink an LED using Arduino" onClick={() => createSampleFolder('led-blink')} />
                    <SampleCard title="Temperature Sensor" description="Read temperature with a sensor and display on serial" onClick={() => createSampleFolder('temperature-sensor')} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {deleteModal?.isOpen && (
        <DeleteModal modal={deleteModal} onClose={() => setDeleteModal(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}

function SampleCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-carbon-surface p-4">
      <h5 className="mb-2 font-medium text-zinc-100">{title}</h5>
      <p className="mb-3 text-sm text-zinc-400">{description}</p>
      <button onClick={onClick} className="text-sm font-medium text-primary-400 hover:text-primary-300">Try This Project →</button>
    </div>
  )
}

function FolderCard({ folder, onClick, onDelete }: { folder: ProjectFolder; onClick: () => void; onDelete: () => void }) {
  const formatDate = (dateString: string) => {
    const diffHours = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`
    return new Date(dateString).toLocaleDateString()
  }

  const firstSchematic = folder.schematics[0]

  return (
    <div className="carbon-card group cursor-pointer overflow-hidden transition-all hover:border-primary-400/20 hover:shadow-[0_0_40px_rgb(var(--accent-glow)/0.06)]" onClick={onClick}>
      <div className="relative h-48 overflow-hidden bg-carbon-surface">
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full carbon-orb-sm" aria-hidden />
        {firstSchematic ? (
          <div className="absolute inset-0 opacity-20">
            <ProjectPreview gridData={firstSchematic.gridData} wires={firstSchematic.wires} className="w-full h-full" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <FolderOpen className="h-16 w-16 text-primary-400/30" />
          </div>
        )}
        <button
          className="absolute top-2 left-2 rounded-full bg-red-500/90 p-2 text-white opacity-0 transition-all hover:bg-red-600 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Delete project"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="absolute top-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-zinc-400 backdrop-blur-sm">
          {folder.schematics.length} schematic{folder.schematics.length !== 1 ? 's' : ''} · {folder.documents.length} doc{folder.documents.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="p-4">
        <h3 className="truncate text-lg font-semibold text-zinc-100">{folder.name}</h3>
        <p className="mt-1 text-sm text-zinc-500">Last modified {formatDate(folder.metadata.updatedAt)}</p>
        {folder.description && (
          <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{folder.description}</p>
        )}
      </div>
    </div>
  )
}

function DeleteModal({ modal, onClose, onConfirm }: {
  modal: { type: string; name: string }
  onClose: () => void
  onConfirm: () => void
}) {
  const label = modal.type === 'folder' ? 'project' : modal.type
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Delete {label}</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-gray-700 dark:text-dark-text-secondary mb-6">
          Are you sure you want to delete <strong>"{modal.name}"</strong>?
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 dark:bg-dark-border rounded-md">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md">Delete</button>
        </div>
      </div>
    </div>
  )
}

export default App
