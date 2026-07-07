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
  Pencil,
  Tag,
  LayoutGrid,
  FileDown,
  Network,
} from 'lucide-react'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { extractOccupiedComponents } from './utils/gridUtils'
import { AppearancePanel } from './components/AppearancePanel'
import { AgentDevPanel, AgentDevToggle } from './components/AgentDevPanel'
import { AgentProvider } from './contexts/AgentContext'
import { ProductSuiteHost } from './components/ProductSuiteHost'
import { CarbonLogo } from './components/CarbonLogo'
import { ProjectGrid } from './components/ProjectGrid'
import { ComponentsFloatingPanel } from './components/ComponentsFloatingPanel'
import { ProjectsAgentLayout } from './components/ProjectsAgentLayout'
import { ProjectPreview } from './components/ProjectPreview'
import { ProjectFolderView } from './components/ProjectFolderView'
import { DocumentEditor } from './components/DocumentEditor'
import { ProgramEditor } from './components/ProgramEditor'
import { PlanSpaceEditor } from './components/PlanSpaceEditor'
import { ResistanceSelector } from './components/ResistanceSelector'
import { CapacitanceSelector } from './components/CapacitanceSelector'
import { InductanceSelector } from './components/InductanceSelector'
import { ACSourceSelector } from './components/ACSourceSelector'
import { ConnectorPlacementSelector } from './components/ConnectorPlacementSelector'
import { ModuleConfigSelector } from './components/ModuleConfigSelector'
import {
  buildNPinConnectorDefinition,
  isNPinConnectorModule,
  readConnectorGender,
  readConnectorPins,
  type ConnectorGender,
} from './modules/connectors/buildConnectorDefinition'
import { EditorFloatingChrome } from './components/EditorFloatingChrome'
import { SchematicTidyModal } from './components/SchematicTidyModal'
import { DatasheetExportModal } from './components/DatasheetExportModal'
import { SchematicExportModal } from './components/SchematicExportModal'
import type { HoverStats } from './utils/hoverStats'
import type { ComponentState } from './systems/ElectricalSystem'
import { ModuleDefinition } from './modules/types'
import {
  getPassiveValueKind,
  passiveValueSelectorTitle,
  type PassiveValueKind,
} from './modules/passiveValueKind'
import {
  applyModuleConfig,
  getModuleConfigKind,
  moduleConfigSelectorTitle,
  readModuleConfig,
  type ModuleConfigKind,
  type ModuleConfigSettings,
} from './modules/moduleConfigKind'
import {
  ProjectFolder,
  Schematic,
  WorkspaceView,
  createSchematic,
  createDocument,
  createProgram,
  type SchematicGroupBox,
  type SchematicCellLabel,
  type ProgramCompilation,
} from './types/workspace'
import {
  loadLocalSession,
  saveLocalSession,
  createLocalProjectFolder,
} from './services/localProjectStorage'
import { ensureExamplesProject, EXAMPLES_FOLDER_ID } from './examples/examplesProject'

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
  const [passiveValueSelector, setPassiveValueSelector] = useState<PassiveValueKind | null>(null)
  const [moduleConfigSelector, setModuleConfigSelector] = useState<ModuleConfigKind | null>(null)
  const [moduleConfigDraft, setModuleConfigDraft] = useState<ModuleConfigSettings | null>(null)
  const [connectorSelectorOpen, setConnectorSelectorOpen] = useState(false)
  const [selectedResistance, setSelectedResistance] = useState(1000)
  const [selectedCapacitance, setSelectedCapacitance] = useState(0.0001)
  const [selectedInductance, setSelectedInductance] = useState(0.001)
  const [selectedACVrms, setSelectedACVrms] = useState(12)
  const [selectedACFrequency, setSelectedACFrequency] = useState(60)
  const [selectedACWaveform, setSelectedACWaveform] = useState<
    'sine' | 'square' | 'triangle' | 'sawtooth'
  >('sine')
  const [componentStates, setComponentStates] = useState<Map<string, ComponentState>>(new Map())
  const [zoom, setZoom] = useState(1)
  const [hoveredPosition, setHoveredPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoverStats, setHoverStats] = useState<HoverStats | null>(null)
  const [groupBoxes, setGroupBoxes] = useState<SchematicGroupBox[]>([])
  const [selectedGroupBoxId, setSelectedGroupBoxId] = useState<string | null>(null)
  const [focusGroupBoxRequest, setFocusGroupBoxRequest] = useState<SchematicGroupBox | null>(null)
  const [labelMode, setLabelMode] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [labels, setLabels] = useState<SchematicCellLabel[]>([])
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [workspaceOverlay, setWorkspaceOverlay] = useState<HTMLDivElement | null>(null)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'folder' | 'schematic' | 'document' | 'program'
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
  const [agentDevOpen, setAgentDevOpen] = useState(false)
  const [tidyModalOpen, setTidyModalOpen] = useState(false)
  const [datasheetExportOpen, setDatasheetExportOpen] = useState(false)
  const [schematicExportOpen, setSchematicExportOpen] = useState(false)
  const [, setLastSavedState] = useState<Record<string, unknown> | null>(null)

  const selectedSchematic = useMemo(() => {
    if (!selectedFolder || !selectedItemId || activeView !== 'schematic') return null
    return selectedFolder.schematics.find((s) => s.id === selectedItemId) ?? null
  }, [selectedFolder, selectedItemId, activeView])

  const schematicSyncKey = useMemo(() => {
    if (!selectedSchematic) return ''
    const occupied =
      selectedSchematic.gridData?.flat().filter((cell) => cell?.occupied).length ?? 0
    return `${selectedSchematic.metadata.updatedAt}:${selectedSchematic.wires?.length ?? 0}:${occupied}`
  }, [selectedSchematic])

  useEffect(() => {
    if (selectedSchematic) {
      setGroupBoxes(selectedSchematic.groupBoxes ?? [])
      setLabels(selectedSchematic.labels ?? [])
      setSelectedGroupBoxId(null)
      setSelectedLabelId(null)
      setFocusGroupBoxRequest(null)
      setLabelMode(false)
    }
  }, [selectedSchematic?.id])

  const selectedDocument = useMemo(() => {
    if (!selectedFolder || !selectedItemId || activeView !== 'document') return null
    return selectedFolder.documents.find((d) => d.id === selectedItemId) ?? null
  }, [selectedFolder, selectedItemId, activeView])

  const selectedProgram = useMemo(() => {
    if (!selectedFolder || !selectedItemId || activeView !== 'program') return null
    return selectedFolder.programs.find((p) => p.id === selectedItemId) ?? null
  }, [selectedFolder, selectedItemId, activeView])

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return projectFolders
    const q = searchQuery.toLowerCase()
    return projectFolders.filter(
      (f) => f.name.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q)
    )
  }, [projectFolders, searchQuery])

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.1, 3)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.1, 0.35)), [])
  const handleZoomReset = useCallback(() => setZoom(1), [])

  const persistSession = useCallback((
    folders: ProjectFolder[],
    folder: ProjectFolder | null,
    itemId: string | null,
    view: WorkspaceView
  ) => {
    const result = saveLocalSession({
      projectFolders: folders,
      selectedFolderId: folder?.id ?? null,
      selectedItemId: itemId,
      activeView: view,
    })
    if (!result.ok) {
      console.warn('Local session save failed:', result.error)
      setSaveStatus((prev) => ({
        ...prev,
        error: result.error ?? 'Local save failed',
        hasUnsavedChanges: true,
      }))
    }
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
    const folders = ensureExamplesProject(previous).map((f) => ({
      ...f,
      programs: f.programs ?? [],
    }))

    setProjectFolders(folders)

    persistSession(
      folders,
      session?.selectedFolderId ? folders.find((f) => f.id === session.selectedFolderId) ?? null : null,
      session?.selectedItemId ?? null,
      (session?.activeView as string | undefined) === 'style-dev' ? 'folders' : (session?.activeView ?? 'folders')
    )

    if (!session) return

    if (session.selectedFolderId) {
      const folder = folders.find((f) => f.id === session.selectedFolderId)
      if (folder) {
        setSelectedFolder(folder)
        setSelectedItemId(session.selectedItemId)
        setActiveView((session.activeView as string) === 'style-dev' ? 'folder' : (session.activeView || 'folder'))

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

  const handleCreateProgram = () => {
    if (!selectedFolder) return
    const count = selectedFolder.programs.length
    const program = createProgram(`Program ${count + 1}`)
    const updated: ProjectFolder = {
      ...selectedFolder,
      programs: [program, ...selectedFolder.programs],
      metadata: { ...selectedFolder.metadata, updatedAt: new Date().toISOString() },
    }
    updateFolders(
      (folders) => folders.map((f) => (f.id === updated.id ? updated : f)),
      updated,
      program.id,
      'program'
    )
    setSelectedItemId(program.id)
    setActiveView('program')
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

  const handleOpenProgram = (programId: string) => {
    if (!selectedFolder) return
    setSelectedItemId(programId)
    setActiveView('program')
    persistSession(projectFolders, selectedFolder, programId, 'program')
  }

  const handleOpenPlanSpace = () => {
    if (!selectedFolder) return
    const planSpace = selectedFolder.planSpace
    setZoom(planSpace.metadata.zoom)
    setSelectedItemId(planSpace.id)
    setActiveView('plan-space')
    persistSession(projectFolders, selectedFolder, planSpace.id, 'plan-space')
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

  const handleDeleteProgram = (programId: string) => {
    if (!selectedFolder) return
    const program = selectedFolder.programs.find((p) => p.id === programId)
    setDeleteModal({
      isOpen: true,
      type: 'program',
      folderId: selectedFolder.id,
      itemId: programId,
      name: program?.name || 'Program',
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
        if (deleteModal.type === 'program') {
          return { ...f, programs: f.programs.filter((p) => p.id !== deleteModal.itemId) }
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
    if (module) setLabelMode(false)
    if (isNPinConnectorModule(module)) {
      setConnectorSelectorOpen(true)
      setPassiveValueSelector(null)
      setModuleConfigSelector(null)
      return
    }
    setConnectorSelectorOpen(false)
    const passiveKind = getPassiveValueKind(module)
    if (passiveKind) {
      setPassiveValueSelector(passiveKind)
      setModuleConfigSelector(null)
      return
    }
    const configKind = getModuleConfigKind(module)
    if (configKind && module) {
      setModuleConfigSelector(configKind)
      setModuleConfigDraft(readModuleConfig(configKind, module))
      setPassiveValueSelector(null)
      return
    }
    setPassiveValueSelector(null)
    setModuleConfigSelector(null)
  }

  const toggleDeleteMode = useCallback(() => {
    setDeleteMode((prev) => {
      const next = !prev
      if (next) {
        setLabelMode(false)
        setSelectedModule(null)
        setConnectorSelectorOpen(false)
        setPassiveValueSelector(null)
        setModuleConfigSelector(null)
      }
      return next
    })
  }, [])

  const handleConnectorApply = (pins: number, gender: ConnectorGender) => {
    setSelectedModule(buildNPinConnectorDefinition(pins, gender))
    setConnectorSelectorOpen(false)
  }

  const handleConnectorClose = () => {
    setConnectorSelectorOpen(false)
    setSelectedModule(null)
  }

  const handleResistanceSelect = (resistance: number) => {
    setSelectedResistance(resistance)
    setPassiveValueSelector(null)
    if (selectedModule && getPassiveValueKind(selectedModule) === 'resistor') {
      setSelectedModule({
        ...selectedModule,
        properties: { ...(selectedModule as ModuleDefinition & { properties?: Record<string, unknown> }).properties, resistance },
      } as ModuleDefinition)
    }
  }

  const handleCapacitanceSelect = (capacitance: number) => {
    setSelectedCapacitance(capacitance)
    setPassiveValueSelector(null)
    if (selectedModule && getPassiveValueKind(selectedModule) === 'capacitor') {
      setSelectedModule({
        ...selectedModule,
        properties: { ...(selectedModule as ModuleDefinition & { properties?: Record<string, unknown> }).properties, capacitance },
      } as ModuleDefinition)
    }
  }

  const handleInductanceSelect = (inductance: number) => {
    setSelectedInductance(inductance)
    setPassiveValueSelector(null)
    if (selectedModule && getPassiveValueKind(selectedModule) === 'inductor') {
      setSelectedModule({
        ...selectedModule,
        properties: { ...(selectedModule as ModuleDefinition & { properties?: Record<string, unknown> }).properties, inductance },
      } as ModuleDefinition)
    }
  }

  const handleModuleConfigApply = (settings: ModuleConfigSettings) => {
    if (!selectedModule || !moduleConfigSelector) return
    setModuleConfigDraft(settings)
    setModuleConfigSelector(null)
    setSelectedModule(applyModuleConfig(selectedModule, moduleConfigSelector, settings))
  }

  const handleACSourceSelect = (
    vrms: number,
    frequency: number,
    waveform: 'sine' | 'square' | 'triangle' | 'sawtooth'
  ) => {
    setSelectedACVrms(vrms)
    setSelectedACFrequency(frequency)
    setSelectedACWaveform(waveform)
    setPassiveValueSelector(null)
    if (selectedModule?.module === 'ACSource') {
      setSelectedModule({
        ...selectedModule,
        properties: {
          ...(selectedModule as ModuleDefinition & { properties?: Record<string, unknown> }).properties,
          vrms,
          frequency,
          waveform,
        },
      } as ModuleDefinition)
    }
  }

  const handleSchematicDataChange = useCallback(async (projectData: {
    gridData?: unknown[][]
    wires?: unknown[]
    componentStates?: Record<string, unknown>
    groupBoxes?: SchematicGroupBox[]
    labels?: SchematicCellLabel[]
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
        wires: (projectData.wires as Schematic['wires']) ?? selectedSchematic.wires,
        componentStates: {},
        groupBoxes: projectData.groupBoxes ?? selectedSchematic.groupBoxes ?? [],
        labels: projectData.labels ?? selectedSchematic.labels ?? [],
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
        componentStates: {},
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

  const handleApplyTidyLayout = useCallback(
    (updated: Schematic) => {
      handleSchematicDataChange({
        gridData: updated.gridData,
        wires: updated.wires,
        groupBoxes: updated.groupBoxes,
        labels: updated.labels,
      })
    },
    [handleSchematicDataChange]
  )

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

  const programSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateProgramInFolder = (
    programId: string,
    updater: (program: NonNullable<typeof selectedProgram>) => NonNullable<typeof selectedProgram>
  ) => {
    if (!selectedFolder) return
    const folderId = selectedFolder.id

    setProjectFolders((prev) => {
      const folder = prev.find((f) => f.id === folderId)
      const program = folder?.programs.find((p) => p.id === programId)
      if (!folder || !program) return prev

      const updatedProgram = updater(program)
      const updatedFolder: ProjectFolder = {
        ...folder,
        programs: folder.programs.map((p) => (p.id === programId ? updatedProgram : p)),
        metadata: { ...folder.metadata, updatedAt: new Date().toISOString() },
      }
      const next = prev.map((f) => (f.id === folderId ? updatedFolder : f))
      setSelectedFolder(updatedFolder)
      persistSession(next, updatedFolder, programId, 'program')
      return next
    })
  }

  const handleProgramChange = (code: string) => {
    if (!selectedProgram) return
    const programId = selectedProgram.id

    if (programSaveTimer.current) clearTimeout(programSaveTimer.current)
    programSaveTimer.current = setTimeout(() => {
      updateProgramInFolder(programId, (program) => ({
        ...program,
        code,
        compilation: undefined,
        metadata: { ...program.metadata, updatedAt: new Date().toISOString() },
      }))
    }, 400)
  }

  const handleProgramNameChange = (name: string) => {
    if (!selectedProgram) return
    updateProgramInFolder(selectedProgram.id, (program) => ({
      ...program,
      name,
      metadata: { ...program.metadata, updatedAt: new Date().toISOString() },
    }))
  }

  const handleProgramBoardChange = (board: string) => {
    if (!selectedProgram) return
    updateProgramInFolder(selectedProgram.id, (program) => ({
      ...program,
      board,
      compilation: undefined,
      metadata: { ...program.metadata, updatedAt: new Date().toISOString() },
    }))
  }

  const handleProgramCompilationChange = (compilation: ProgramCompilation | undefined) => {
    if (!selectedProgram) return
    updateProgramInFolder(selectedProgram.id, (program) => ({
      ...program,
      compilation,
      metadata: { ...program.metadata, updatedAt: new Date().toISOString() },
    }))
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

  const handleFolderNameChange = (name: string) => {
    if (!selectedFolder) return
    const updatedFolder: ProjectFolder = {
      ...selectedFolder,
      name,
      metadata: { ...selectedFolder.metadata, updatedAt: new Date().toISOString() },
    }
    updateFolders(
      (folders) => folders.map((f) => (f.id === updatedFolder.id ? updatedFolder : f)),
      updatedFolder,
      selectedItemId,
      activeView
    )
  }

  const handleFolderDescriptionChange = (description: string) => {
    if (!selectedFolder) return
    const updatedFolder: ProjectFolder = {
      ...selectedFolder,
      description,
      metadata: { ...selectedFolder.metadata, updatedAt: new Date().toISOString() },
    }
    updateFolders(
      (folders) => folders.map((f) => (f.id === updatedFolder.id ? updatedFolder : f)),
      updatedFolder,
      selectedItemId,
      activeView
    )
  }

  const handleRenameFolder = (folderId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    updateFolders((folders) =>
      folders.map((f) =>
        f.id === folderId
          ? {
              ...f,
              name: trimmed,
              metadata: { ...f.metadata, updatedAt: new Date().toISOString() },
            }
          : f
      )
    )
  }

  const agentProjectContext = useMemo(() => {
    if (!selectedFolder) return null
    return {
      folder: selectedFolder,
      activeSchematicId: activeView === 'schematic' ? selectedItemId : null,
      activeDocumentId: activeView === 'document' ? selectedItemId : null,
      activeProgramId: activeView === 'program' ? selectedItemId : null,
    }
  }, [selectedFolder, activeView, selectedItemId])

  const handleAgentProjectUpdate = useCallback(
    (folder: ProjectFolder, options?: { openSchematicId?: string | null }) => {
      updateFolders(
        (folders) => folders.map((f) => (f.id === folder.id ? folder : f)),
        folder,
        options?.openSchematicId ?? selectedItemId,
        options?.openSchematicId ? 'schematic' : activeView
      )
      setSelectedFolder((prev) => (prev?.id === folder.id ? folder : prev))
      if (options?.openSchematicId) {
        setActiveView('schematic')
        setSelectedItemId(options.openSchematicId)
      }
    },
    [updateFolders, selectedItemId, activeView]
  )

  const wrapWorkspaceLayout = (
    content: React.ReactNode,
    options?: { carbonHeader?: React.ReactNode }
  ) =>
    options?.carbonHeader ? (
      <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden bg-gray-50 dark:bg-black">
        {options.carbonHeader}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>
      </div>
    ) : (
      <div className="flex h-screen flex-col overflow-hidden">{content}</div>
    )

  let workspaceContent: React.ReactNode
  let carbonHeader: React.ReactNode | undefined
  let projectsBrowserShell = false

  const editorTopBar = (title: string, backLabel: string, onBack: () => void, showSave = false) => (
    <div className="sticky top-0 z-workspace-chrome flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-white/[0.06] dark:bg-black">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 transition-colors hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-300"
        >
          <ArrowLeft className="h-5 w-5" />
          {backLabel}
        </button>
        <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">{title}</h1>
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
            <button
              onClick={() => {
                setLabelMode((prev) => {
                  const next = !prev
                  if (next) {
                    setSelectedModule(null)
                    setPassiveValueSelector(null)
                  }
                  return next
                })
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                labelMode
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
              }`}
              title={labelMode ? 'Exit label mode' : 'Add labels to grid cells'}
            >
              <Tag className="h-4 w-4" />
              Label
            </button>
            <button
              onClick={() => setTidyModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
              title="Rearrange components for readability"
            >
              <LayoutGrid className="h-4 w-4" />
              Tidy
            </button>
            <button
              onClick={() => setDatasheetExportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
              title="Export KiCad datasheets and PCB footprints as PDF"
            >
              <FileDown className="h-4 w-4" />
              Datasheets
            </button>
            <button
              onClick={() => setSchematicExportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
              title="Export KiCad symbols and wiring schematic"
            >
              <Network className="h-4 w-4" />
              KiCad Export
            </button>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-sm text-gray-500 dark:text-zinc-500 font-mono truncate max-w-[240px]">
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
        <AgentDevToggle onClick={() => setAgentDevOpen(true)} />
      </div>
    </div>
  )

  const editorSaveStatus = (
    <SaveStatus
      isSaving={saveStatus.isSaving}
      lastSaved={saveStatus.lastSaved}
      error={saveStatus.error}
      hasUnsavedChanges={saveStatus.hasUnsavedChanges}
    />
  )

  const canvasEditorToolbar = (
    <>
      {activeView === 'schematic' && (
        <>
          <button
            onClick={() => {
              setLabelMode((prev) => {
                const next = !prev
                if (next) {
                  setSelectedModule(null)
                  setPassiveValueSelector(null)
                }
                return next
              })
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
              labelMode
                ? 'bg-primary-500 text-white hover:bg-primary-600'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200'
            }`}
            title={labelMode ? 'Exit label mode' : 'Add labels to grid cells'}
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Label</span>
          </button>
          <button
            onClick={() => setTidyModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            title="Rearrange components for readability"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Tidy</span>
          </button>
          <button
            onClick={() => setDatasheetExportOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            title="Export KiCad datasheets and PCB footprints as PDF"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Datasheets</span>
          </button>
          <button
            onClick={() => setSchematicExportOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            title="Export KiCad symbols and wiring schematic"
          >
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">KiCad</span>
          </button>
          <div className="hidden h-5 w-px bg-gray-200 dark:bg-white/10 md:block" />
          <div className="hidden text-sm text-gray-500 dark:text-zinc-500 font-mono truncate max-w-[200px] lg:block xl:max-w-[240px]">
            {hoverStats
              ? `${hoverStats.title}${hoverStats.status ? ` · ${hoverStats.status.label}` : ''}`
              : hoveredPosition
                ? `(${hoveredPosition.x}, ${hoveredPosition.y})`
                : 'Hover for live stats'}
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button onClick={handleZoomOut} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-zinc-200" title="Zoom Out">
              <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <span className="min-w-[2.5rem] text-center text-xs text-gray-500 sm:min-w-[3rem] sm:text-sm">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-zinc-200" title="Zoom In">
              <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button onClick={handleZoomReset} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-zinc-200" title="Reset Zoom">
              <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </>
      )}
      <AppearancePanel />
      <AgentDevToggle onClick={() => setAgentDevOpen(true)} />
    </>
  )

  if (activeView === 'schematic' && selectedFolder && selectedSchematic) {
    workspaceContent = (
      <div ref={setWorkspaceOverlay} className="relative flex min-h-0 flex-1 flex-col bg-white dark:bg-black">
        <div className="absolute inset-0 overflow-hidden">
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
            initialLabels={selectedSchematic.labels || []}
            schematicUpdatedAt={selectedSchematic.metadata.updatedAt}
            schematicSyncKey={schematicSyncKey}
            groupBoxes={groupBoxes}
            onGroupBoxesChange={setGroupBoxes}
            labels={labels}
            onLabelsChange={setLabels}
            labelMode={labelMode}
            onLabelModeChange={setLabelMode}
            deleteMode={deleteMode}
            onDeleteModeChange={setDeleteMode}
            selectedLabelId={selectedLabelId}
            onSelectedLabelIdChange={setSelectedLabelId}
            selectedGroupBoxId={selectedGroupBoxId}
            onSelectedGroupBoxIdChange={setSelectedGroupBoxId}
            focusGroupBoxRequest={focusGroupBoxRequest}
            onFocusGroupBoxHandled={() => setFocusGroupBoxRequest(null)}
            schematicId={selectedSchematic.id}
            key={selectedSchematic.id}
            getAccessToken={getAccessToken}
            onProjectDataChange={handleSchematicDataChange}
            zoom={zoom}
            onZoomChange={setZoom}
            onHoveredPositionChange={setHoveredPosition}
            onHoverStatsChange={setHoverStats}
            projectPrograms={selectedFolder.programs}
            programFlashes={selectedSchematic.programFlashes}
            showWorkspacePanels
            workspaceOverlay={workspaceOverlay}
            showExamplesDocs={selectedFolder.id === EXAMPLES_FOLDER_ID}
            examplesSchematicId={selectedSchematic.id}
            examplesSchematicName={selectedSchematic.name}
          />
        </div>

        <EditorFloatingChrome
          title={selectedSchematic.name}
          backLabel={selectedFolder.name}
          onBack={handleBackToFolder}
          showSave
          saveStatus={editorSaveStatus}
          toolbar={canvasEditorToolbar}
        />

        <ComponentsFloatingPanel
          selectedModule={selectedModule}
          onModuleSelect={handleModuleSelect}
          deleteMode={deleteMode}
          onToggleDeleteMode={toggleDeleteMode}
          groupBoxBrowser={{
            groupBoxes,
            selectedId: selectedGroupBoxId,
            onSelect: setSelectedGroupBoxId,
            onUpdate: (id, patch) =>
              setGroupBoxes((prev) => prev.map((box) => (box.id === id ? { ...box, ...patch } : box))),
            onDelete: (id) => {
              setGroupBoxes((prev) => prev.filter((box) => box.id !== id))
              if (selectedGroupBoxId === id) setSelectedGroupBoxId(null)
            },
            onFocus: (box) => setFocusGroupBoxRequest(box),
          }}
        />

        {moduleConfigSelector && moduleConfigDraft && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
                {moduleConfigSelectorTitle(moduleConfigSelector, selectedModule?.module)}
              </h3>
              <ModuleConfigSelector
                kind={moduleConfigSelector}
                currentSettings={moduleConfigDraft}
                onApply={handleModuleConfigApply}
                onClose={() => setModuleConfigSelector(null)}
              />
            </div>
          </div>
        )}
        {passiveValueSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
                {passiveValueSelectorTitle(passiveValueSelector, selectedModule?.module)}
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
              {passiveValueSelector === 'ac' && (
                <ACSourceSelector
                  currentSettings={{
                    vrms: selectedACVrms,
                    frequency: selectedACFrequency,
                    waveform: selectedACWaveform,
                  }}
                  onApply={({ vrms, frequency, waveform }) =>
                    handleACSourceSelect(vrms, frequency, waveform)
                  }
                  onClose={() => setPassiveValueSelector(null)}
                />
              )}
            </div>
          </div>
        )}
        {connectorSelectorOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
                Configure N Pin Connector
              </h3>
              <ConnectorPlacementSelector
                initialPins={readConnectorPins(selectedModule)}
                initialGender={readConnectorGender(selectedModule)}
                onApply={handleConnectorApply}
                onClose={handleConnectorClose}
              />
            </div>
          </div>
        )}
      </div>
    )
  } else if (activeView === 'document' && selectedFolder && selectedDocument) {
    workspaceContent = (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50 dark:bg-dark-bg">
        {editorTopBar(selectedDocument.name, selectedFolder.name, handleBackToFolder)}
        <div className="min-h-0 flex-1">
          <DocumentEditor
            name={selectedDocument.name}
            content={selectedDocument.content}
            onChange={handleDocumentChange}
            onNameChange={handleDocumentNameChange}
          />
        </div>
      </div>
    )
  } else if (activeView === 'program' && selectedFolder && selectedProgram) {
    workspaceContent = (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50 dark:bg-dark-bg">
        {editorTopBar(selectedProgram.name, selectedFolder.name, handleBackToFolder)}
        <div className="min-h-0 flex-1">
          <ProgramEditor
            program={selectedProgram}
            onChange={handleProgramChange}
            onNameChange={handleProgramNameChange}
            onBoardChange={handleProgramBoardChange}
            onCompilationChange={handleProgramCompilationChange}
          />
        </div>
      </div>
    )
  } else if (activeView === 'plan-space' && selectedFolder) {
    workspaceContent = (
      <div className="flex min-h-0 flex-1 flex-col bg-[#f1f5f9]">
        {editorTopBar('Plan Space', selectedFolder.name, handleBackToFolder)}
        <div className="min-h-0 flex-1">
          <PlanSpaceEditor
            planSpace={selectedFolder.planSpace}
            onChange={handlePlanSpaceChange}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>
      </div>
    )
  } else if (activeView === 'folder' && selectedFolder) {
    projectsBrowserShell = true
    workspaceContent = (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-workspace-chrome flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm dark:border-dark-border dark:bg-dark-surface">
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
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg">
          <ProjectFolderView
            folder={selectedFolder}
            onOpenSchematic={handleOpenSchematic}
            onOpenDocument={handleOpenDocument}
            onOpenProgram={handleOpenProgram}
            onOpenPlanSpace={handleOpenPlanSpace}
            onCreateSchematic={handleCreateSchematic}
            onCreateDocument={handleCreateDocument}
            onCreateProgram={handleCreateProgram}
            onDeleteSchematic={handleDeleteSchematic}
            onDeleteDocument={handleDeleteDocument}
            onDeleteProgram={handleDeleteProgram}
            onNameChange={handleFolderNameChange}
            onDescriptionChange={handleFolderDescriptionChange}
          />
        </div>
      </div>
    )
  } else {
    projectsBrowserShell = true
    workspaceContent = (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header className="relative z-workspace-chrome flex shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-black sm:gap-x-6 sm:px-6">
              <CarbonLogo size="lg" />
              <div className="flex flex-1 items-center gap-x-4 lg:gap-x-6">
                <div className="relative ml-auto flex flex-1 max-w-xl">
                  <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400 pl-3 dark:text-zinc-500" />
                  <input
                    type="search"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block h-10 w-full rounded-lg border border-gray-200 bg-gray-50 py-0 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-400/50 focus:outline-none focus:ring-1 focus:ring-primary-400/30 dark:border-white/[0.08] dark:bg-carbon-surface dark:text-zinc-100 dark:placeholder-zinc-500"
                  />
                </div>
                <AppearancePanel />
              </div>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-100 dark:bg-carbon-matte">
            <div className="relative shrink-0 pt-8 pb-6">
              <h1 className="px-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-50 sm:px-6 sm:text-4xl lg:px-8">
                Your Projects
              </h1>
              <p className="mt-3 max-w-2xl px-4 text-base text-gray-600 dark:text-zinc-400 sm:px-6 lg:px-8">
                Each project is a folder containing schematics, programs, documents, and a plan space
              </p>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto pb-8">
              <div className="grid grid-cols-1 gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8 xl:grid-cols-4">
            <div
              className="carbon-card group cursor-pointer border-dashed border-primary-400/20 p-6 transition-colors hover:border-primary-400/40 hover:bg-carbon-elevated/50"
              onClick={handleCreateFolder}
            >
              <div className="flex h-48 flex-col items-center justify-center">
                <Plus className="h-12 w-12 text-gray-400 transition-colors group-hover:text-primary-500 dark:text-zinc-600 dark:group-hover:text-primary-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-zinc-100">New Project</h3>
                <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-500">Create a new project folder</p>
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
                onRename={(name) => handleRenameFolder(folder.id, name)}
              />
            ))}

            {!projectsLoading && projectFolders.length <= 1 && (
              <div className="col-span-full">
                <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-carbon-card py-12 text-center">
                  <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full carbon-orb-sm" aria-hidden />
                  <CarbonLogo size="xl" className="mb-6 block mx-auto" />
                  <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-zinc-50">Welcome to Carbon</h3>
                  <p className="mx-auto mb-6 max-w-md text-gray-600 dark:text-zinc-400">
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
                  <h4 className="mb-4 text-lg font-semibold text-gray-900 dark:text-zinc-100">Try These Sample Projects</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SampleCard title="LED Blink Circuit" description="A simple circuit to blink an LED using Arduino" onClick={() => createSampleFolder('led-blink')} />
                    <SampleCard title="Temperature Sensor" description="Read temperature with a sensor and display on serial" onClick={() => createSampleFolder('temperature-sensor')} />
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
      </div>
    )
  }

  return (
    <AgentProvider
      projectContext={agentProjectContext}
      onProjectUpdate={handleAgentProjectUpdate}
    >
      {projectsBrowserShell ? (
        <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-black">
          <ProjectsAgentLayout>{workspaceContent}</ProjectsAgentLayout>
        </div>
      ) : (
        wrapWorkspaceLayout(workspaceContent, { carbonHeader })
      )}
      <ProductSuiteHost onProjectUpdate={handleAgentProjectUpdate} />
      {tidyModalOpen && selectedSchematic && (
        <SchematicTidyModal
          schematic={selectedSchematic}
          onClose={() => setTidyModalOpen(false)}
          onApply={handleApplyTidyLayout}
        />
      )}
      {datasheetExportOpen && selectedSchematic && (
        <DatasheetExportModal
          open={datasheetExportOpen}
          onClose={() => setDatasheetExportOpen(false)}
          schematic={selectedSchematic}
          projectName={`${selectedFolder?.name ?? 'Project'} — ${selectedSchematic.name}`}
        />
      )}
      {schematicExportOpen && selectedSchematic && (
        <SchematicExportModal
          open={schematicExportOpen}
          onClose={() => setSchematicExportOpen(false)}
          schematic={selectedSchematic}
          projectName={`${selectedFolder?.name ?? 'Project'} — ${selectedSchematic.name}`}
        />
      )}
      {deleteModal?.isOpen && (
        <DeleteModal modal={deleteModal} onClose={() => setDeleteModal(null)} onConfirm={confirmDelete} />
      )}
      <AgentDevPanel open={agentDevOpen} onClose={() => setAgentDevOpen(false)} />
    </AgentProvider>
  )
}

function SampleCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/[0.06] dark:bg-carbon-surface">
      <h5 className="mb-2 font-medium text-gray-900 dark:text-zinc-100">{title}</h5>
      <p className="mb-3 text-sm text-gray-600 dark:text-zinc-400">{description}</p>
      <button onClick={onClick} className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">Try This Project →</button>
    </div>
  )
}

function FolderCard({
  folder,
  onClick,
  onDelete,
  onRename,
}: {
  folder: ProjectFolder
  onClick: () => void
  onDelete: () => void
  onRename: (name: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(folder.name)

  useEffect(() => {
    setDraftName(folder.name)
  }, [folder.name])

  const commitRename = () => {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== folder.name) {
      onRename(trimmed)
    } else {
      setDraftName(folder.name)
    }
    setIsEditing(false)
  }

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
      <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-carbon-surface">
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
        <div className="absolute top-2 right-2 rounded bg-white/90 px-2 py-1 text-xs text-gray-600 backdrop-blur-sm dark:bg-black/70 dark:text-zinc-400">
          {folder.schematics.length} schematic{folder.schematics.length !== 1 ? 's' : ''} · {folder.programs.length} program{folder.programs.length !== 1 ? 's' : ''} · {folder.documents.length} doc{folder.documents.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-2">
          {isEditing ? (
            <input
              type="text"
              value={draftName}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitRename()
                }
                if (e.key === 'Escape') {
                  setDraftName(folder.name)
                  setIsEditing(false)
                }
              }}
              className="min-w-0 flex-1 rounded border border-primary-400/40 bg-white px-2 py-1 text-lg font-semibold text-gray-900 outline-none focus:ring-1 focus:ring-primary-400/50 dark:bg-carbon-surface dark:text-zinc-100"
            />
          ) : (
            <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900 dark:text-zinc-100">{folder.name}</h3>
          )}
          <button
            type="button"
            className="shrink-0 rounded-md p-1.5 text-gray-500 opacity-0 transition-all hover:bg-gray-100 hover:text-primary-600 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-primary-400"
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            title="Rename project"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">Last modified {formatDate(folder.metadata.updatedAt)}</p>
        {folder.description && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-zinc-400">{folder.description}</p>
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
