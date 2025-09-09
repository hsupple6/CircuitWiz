import { useState, useEffect, useCallback } from 'react'
import { 
  Zap, 
  Plus,
  Search,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LogIn,
  User,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2
} from 'lucide-react'
import { Auth0Provider } from '@auth0/auth0-react'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { extractOccupiedComponents } from './utils/gridUtils'
import { ProjectSaveData } from './services/UserDatabaseService'
import { ThemeToggle } from './components/ThemeToggle'
import { ProjectGrid } from './components/ProjectGrid'
import { ComponentPalette } from './components/ComponentPalette'
import { ProjectPreview } from './components/ProjectPreview'
import { ResistanceSelector } from './components/ResistanceSelector'
import { DevMenu } from './components/DevMenu'
import { ModuleDefinition } from './modules/types'
import { logger } from './services/Logger'
import { useUserDatabase } from './hooks/useUserDatabase'
import { UserProject } from './services/UserDatabaseService'

interface SaveStatusProps {
  isSaving: boolean
  lastSaved: Date | null
  error: string | null
  hasUnsavedChanges: boolean
}

function SaveStatus({ isSaving, lastSaved, error, hasUnsavedChanges }: SaveStatusProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      return date.toLocaleDateString()
    }
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
        <div className="animate-spin">
          <Save className="h-4 w-4" />
        </div>
        <span className="text-sm animate-pulse">Saving...</span>
      </div>
    )
  }

  if (lastSaved) {
    const isRecent = (Date.now() - lastSaved.getTime()) < 3000 // Show "Saved" for 3 seconds
    
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm">
          {isRecent ? (
            <span className="animate-pulse">Saved</span>
          ) : (
            <>
              Saved at {formatTime(lastSaved)} ({getRelativeTime(lastSaved)})
            </>
          )}
        </span>
      </div>
    )
  }

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
        <div className="animate-pulse">
          <Save className="h-4 w-4" />
        </div>
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
  const domain = (import.meta as any).env.VITE_AUTH0_DOMAIN
  const clientId = (import.meta as any).env.VITE_AUTH0_CLIENT_ID
  const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE


  if (!domain || !clientId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-gray-600">Missing Auth0 configuration. Please check your environment variables.</p>
          <p className="text-sm text-gray-500 mt-2">Domain: {domain || 'Missing'}</p>
          <p className="text-sm text-gray-500">Client ID: {clientId || 'Missing'}</p>
        </div>
      </div>
    )
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
        scope: 'openid profile email'
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </Auth0Provider>
  )
}

function AppContent() {
  const { user, isLoading, isAuthenticated, login, logout, getAccessToken } = useAuth()
  const { getProjects, createProject, autoSaveProject, error: dbError } = useUserDatabase()
  const [currentView, setCurrentView] = useState<'projects' | 'project'>('projects')
  const [selectedProject, setSelectedProject] = useState<UserProject | null>(null)
  const [selectedModule, setSelectedModule] = useState<ModuleDefinition | null>(null)
  const [showResistanceSelector, setShowResistanceSelector] = useState(false)
  const [selectedResistance, setSelectedResistance] = useState(1000)
  const [showDevMenu, setShowDevMenu] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [componentStates, setComponentStates] = useState<Map<string, any>>(new Map())
  const [circuitPathways, setCircuitPathways] = useState<any[]>([])
  const [wires, setWires] = useState<any[]>([])
  const [circuitInfo, setCircuitInfo] = useState<any>(null)
  const [gridData, setGridData] = useState<any[][]>([])
  const [userProjects, setUserProjects] = useState<UserProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    project: UserProject | null
  }>({
    isOpen: false,
    project: null
  })
  const [saveStatus, setSaveStatus] = useState<{
    isSaving: boolean
    lastSaved: Date | null
    error: string | null
    hasUnsavedChanges: boolean
  }>({
    isSaving: false,
    lastSaved: null,
    error: null,
    hasUnsavedChanges: false
  })

  // Reference to the last saved state for comparison
  const [lastSavedState, setLastSavedState] = useState<{
    gridData?: any[][]
    wires?: any[]
    componentStates?: Record<string, any>
  } | null>(null)

  // Function to compare current state with saved state
  const compareStates = (current: any, saved: any): boolean => {
    if (!current && !saved) return true
    if (!current || !saved) return false
    
    // For large objects, use a more efficient comparison
    if (Array.isArray(current) && Array.isArray(saved)) {
      if (current.length !== saved.length) return false
      
      // For grid data, compare only occupied cells to be more efficient
      if (current.length > 0 && current[0] && typeof current[0] === 'object' && 'occupied' in current[0]) {
        // This is grid data - compare only occupied cells
        for (let i = 0; i < current.length; i++) {
          if (current[i].length !== saved[i]?.length) return false
          for (let j = 0; j < current[i].length; j++) {
            const currentCell = current[i][j]
            const savedCell = saved[i]?.[j]
            if (currentCell.occupied !== savedCell?.occupied) return false
            if (currentCell.occupied && (
              currentCell.componentId !== savedCell.componentId ||
              currentCell.componentType !== savedCell.componentType ||
              currentCell.isPowered !== savedCell.isPowered
            )) return false
          }
        }
        return true
      }
    }
    
    // For other data types, use JSON comparison
    try {
      return JSON.stringify(current) === JSON.stringify(saved)
    } catch (error) {
      return false
    }
  }

  // Function to check for unsaved changes
  const checkForUnsavedChanges = (currentState: {
    gridData?: any[][]
    wires?: any[]
    componentStates?: Record<string, any>
  }) => {
    if (!lastSavedState) return false

    const gridDataChanged = !compareStates(currentState.gridData, lastSavedState.gridData)
    const wiresChanged = !compareStates(currentState.wires, lastSavedState.wires)
    const componentStatesChanged = !compareStates(currentState.componentStates, lastSavedState.componentStates)

    const hasChanges = gridDataChanged || wiresChanged || componentStatesChanged

    return hasChanges
  }
  
  // Subscribe to logger updates
  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs)
    })
    return unsubscribe
  }, [])

  // Periodic check for unsaved changes every 5 seconds
  useEffect(() => {
    if (!selectedProject || !isAuthenticated || !user) return

    const interval = setInterval(() => {
      if (selectedProject && !saveStatus.isSaving) {
        const currentState = {
          gridData: selectedProject.gridData,
          wires: selectedProject.wires,
          componentStates: selectedProject.componentStates
        }

        const hasUnsavedChanges = checkForUnsavedChanges(currentState)
        
        setSaveStatus(prev => ({
          ...prev,
          hasUnsavedChanges
        }))
      }
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [selectedProject, isAuthenticated, user, saveStatus.isSaving, lastSavedState])

  // Load user projects when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserProjects()
    }
  }, [isAuthenticated, user])

  const loadUserProjects = async () => {
    if (!isAuthenticated || !user) {
      return
    }
    
    setProjectsLoading(true)
    try {
      const projects = await getProjects()
      setUserProjects(projects)
    } catch (error) {
      // Don't show error to user if it's just an authentication issue
      if (error instanceof Error && !error.message.includes('401') && !error.message.includes('403')) {
        alert('Failed to load projects. Please try refreshing the page.')
      }
    } finally {
      setProjectsLoading(false)
    }
  }

  const handleCreateNewProject = async () => {
    if (!isAuthenticated || !user) {
      alert('Please sign in to create projects.')
      return
    }
    
    try {
      setProjectsLoading(true)
      
      // Create a new project with proper initial data
      const newProject = await createProject({
        name: `Project ${userProjects.length + 1}`,
        description: 'A new electronics project',
        gridData: [],
        wires: [],
        componentStates: {}
      })
      
      if (newProject) {
        setUserProjects(prev => [newProject, ...prev])
        setSelectedProject(newProject)
        setGridData(newProject.gridData || []) // Initialize gridData for DevMenu
        setCurrentView('project')
      }
    } catch (error) {
      alert('Failed to create project. Please try again.')
    } finally {
      setProjectsLoading(false)
    }
  }

  const handleDeleteProject = async (project: UserProject) => {
    if (!isAuthenticated || !user) {
      alert('Please sign in to delete projects.')
      return
    }
    
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(`/api/user/projects/${project.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(`Failed to delete project: ${errorMessage}`)
      }
      
      // Remove from local state
      setUserProjects(prev => prev.filter(p => p.id !== project.id))
      
      // Close modal
      setDeleteModal({ isOpen: false, project: null })
      
      // If the deleted project was currently selected, go back to projects view
      if (selectedProject?.id === project.id) {
        setSelectedProject(null)
        setCurrentView('projects')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to delete project: ${errorMessage}`)
    }
  }

  const openDeleteModal = (project: UserProject) => {
    setDeleteModal({ isOpen: true, project })
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, project: null })
  }

  const createSampleProject = async (type: 'led-blink' | 'temperature-sensor') => {
    if (!isAuthenticated || !user) {
      alert('Please sign in to create projects.')
      return
    }
    
    try {
      setProjectsLoading(true)
      
      let projectData
      
      if (type === 'led-blink') {
        projectData = {
          name: 'LED Blink Circuit',
          description: 'A simple circuit to blink an LED using Arduino',
          gridData: [],
          wires: [],
          componentStates: {},
          arduinoProject: {
            name: 'LED Blink',
            files: [{
              name: 'LED_Blink.ino',
              content: `// LED Blink Example
// This example blinks the built-in LED

void setup() {
  // Initialize digital pin LED_BUILTIN as an output
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);   // Turn the LED on
  delay(1000);                       // Wait for a second
  digitalWrite(LED_BUILTIN, LOW);    // Turn the LED off
  delay(1000);                       // Wait for a second
}`,
              type: 'ino' as const,
              isMain: true
            }],
            board: 'arduino:avr:uno',
            libraries: []
          }
        }
      } else if (type === 'temperature-sensor') {
        projectData = {
          name: 'Temperature Sensor',
          description: 'Read temperature with a sensor and display on serial',
          gridData: [],
          wires: [],
          componentStates: {},
          arduinoProject: {
            name: 'Temperature Sensor',
            files: [{
              name: 'Temperature_Sensor.ino',
              content: `// Temperature Sensor Example
// Reads analog input on pin A0 and prints to serial

void setup() {
  // Initialize serial communication at 9600 bits per second
  Serial.begin(9600);
}

void loop() {
  // Read the input on analog pin 0
  int sensorValue = analogRead(A0);
  
  // Convert the analog reading (0-1023) to a voltage (0-5V)
  float voltage = sensorValue * (5.0 / 1023.0);
  
  // Convert voltage to temperature (assuming LM35 sensor)
  float temperature = voltage * 100;
  
  // Print out the value
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" °C");
  
  delay(1000); // Wait for a second
}`,
              type: 'ino' as const,
              isMain: true
            }],
            board: 'arduino:avr:uno',
            libraries: []
          }
        }
      }
      
      if (projectData) {
        const newProject = await createProject(projectData)
        
        if (newProject) {
          setUserProjects(prev => [newProject, ...prev])
          setSelectedProject(newProject)
          setGridData(newProject.gridData || []) // Initialize gridData for DevMenu
          setCurrentView('project')
        }
      }
    } catch (error) {
      alert('Failed to create sample project. Please try again.')
    } finally {
      setProjectsLoading(false)
    }
  }

  // Handle dev menu toggle with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setShowDevMenu(!showDevMenu)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showDevMenu])

  // Ensure gridData is always synchronized with selectedProject
  useEffect(() => {
    if (selectedProject) {
      let projectGridData = selectedProject.gridData || []
      
      // If gridData is empty but we have occupiedComponents, reconstruct it
      if ((!projectGridData || projectGridData.length === 0) && selectedProject.occupiedComponents && selectedProject.occupiedComponents.length > 0) {
        console.log('🔧 Syncing gridData from occupiedComponents')
        const { reconstructGridData } = require('../utils/gridUtils')
        projectGridData = reconstructGridData(selectedProject.occupiedComponents, selectedProject.metadata?.gridSize || { width: 50, height: 50 })
      }
      
      setGridData(projectGridData)
      setWires(selectedProject.wires || [])
    }
  }, [selectedProject])
  
  const handleModuleSelect = (module: ModuleDefinition | null) => {
    setSelectedModule(module)
    
    // Show resistance selector if resistor is selected
    if (module?.module === 'Resistor') {
      setShowResistanceSelector(true)
    } else {
      setShowResistanceSelector(false)
    }
  }
  
  const handleResistanceSelect = (resistance: number) => {
    setSelectedResistance(resistance)
    setShowResistanceSelector(false)
    // Update the selected module with the chosen resistance
    if (selectedModule?.module === 'Resistor') {
      const updatedModule = {
        ...selectedModule,
        properties: {
          ...(selectedModule as any).properties,
          resistance: resistance
        }
      }
      setSelectedModule(updatedModule)
    }
  }


  const handleProjectSelect = (project: UserProject) => {
    setSelectedProject(project)
    setCurrentView('project')
    
    // Update gridData for DevMenu when project is selected
    // Ensure we always have valid gridData, even if it needs to be reconstructed
    let projectGridData = project.gridData || []
    
    // If gridData is empty but we have occupiedComponents, reconstruct it
    if ((!projectGridData || projectGridData.length === 0) && project.occupiedComponents && project.occupiedComponents.length > 0) {
      console.log('🔧 Reconstructing gridData from occupiedComponents for DevMenu')
      const { reconstructGridData } = require('../utils/gridUtils')
      projectGridData = reconstructGridData(project.occupiedComponents, project.metadata?.gridSize || { width: 50, height: 50 })
    }
    
    setGridData(projectGridData)
    setWires(project.wires || [])
    
    // Reset save status when loading a project
    setSaveStatus({
      isSaving: false,
      lastSaved: project.metadata?.updatedAt ? new Date(project.metadata.updatedAt) : null,
      error: null,
      hasUnsavedChanges: false
    })

    // Initialize the last saved state for comparison
    setLastSavedState({
      gridData: projectGridData,
      wires: project.wires,
      componentStates: project.componentStates
    })
  }

  const handleBackToProjects = () => {
    setCurrentView('projects')
    setSelectedProject(null)
    setSelectedModule(null)
  }

  const handleProjectDataChange = useCallback(async (projectData: {
    gridData?: any[][]
    wires?: any[]
    componentStates?: Record<string, any>
    hasUnsavedChanges?: boolean
    triggerUnsavedCheck?: boolean
  }) => {
    if (!selectedProject || !isAuthenticated || !user) return

    // Handle unsaved changes notification
    if (projectData.hasUnsavedChanges !== undefined) {
      setSaveStatus(prev => ({
        ...prev,
        hasUnsavedChanges: projectData.hasUnsavedChanges || false
      }))
      
      // If this is just a notification of unsaved changes, don't proceed with saving
      if (projectData.hasUnsavedChanges) {
        return
      }
    }

    // Handle immediate unsaved check trigger
    if (projectData.triggerUnsavedCheck && selectedProject) {
      const currentState = {
        gridData: projectData.gridData || selectedProject.gridData,
        wires: projectData.wires || selectedProject.wires,
        componentStates: projectData.componentStates || selectedProject.componentStates
      }

      const hasUnsavedChanges = checkForUnsavedChanges(currentState)
      
      setSaveStatus(prev => ({
        ...prev,
        hasUnsavedChanges
      }))

      // If this is just a trigger for unsaved check, don't proceed with saving
      if (projectData.triggerUnsavedCheck) {
        return
      }
    }

    try {
      // Set saving status
      setSaveStatus({
        isSaving: true,
        lastSaved: null,
        error: null,
        hasUnsavedChanges: false
      })

      // Update the local state immediately for responsive UI
      setSelectedProject(prev => prev ? {
        ...prev,
        gridData: projectData.gridData || prev.gridData,
        wires: projectData.wires || prev.wires,
        componentStates: projectData.componentStates || prev.componentStates,
        metadata: {
          ...prev.metadata,
          updatedAt: new Date().toISOString()
        }
      } : null)

      // Update gridData for DevMenu
      if (projectData.gridData) {
        setGridData(projectData.gridData)
      }

      // Auto-save to backend - only save occupied components and wires
      const occupiedComponents = projectData.gridData ? 
        extractOccupiedComponents(projectData.gridData) : []
      
      await autoSaveProject(selectedProject.id, {
        occupiedComponents,
        wires: projectData.wires
      } as ProjectSaveData)
      
      // Set saved status with current time
      setSaveStatus({
        isSaving: false,
        lastSaved: new Date(),
        error: null,
        hasUnsavedChanges: false
      })

      // Update the last saved state for comparison (use the data that was actually saved)
      setLastSavedState({
        gridData: projectData.gridData,
        wires: projectData.wires,
        componentStates: projectData.componentStates
      })
    } catch (error) {
      
      // Set error status
      setSaveStatus({
        isSaving: false,
        lastSaved: null,
        error: error instanceof Error ? error.message : 'Save failed',
        hasUnsavedChanges: true
      })
    }
  }, [selectedProject, isAuthenticated, user, autoSaveProject, lastSavedState])

  // Show loading spinner while Auth0 is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">Loading CircuitWiz...</p>
        </div>
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50 dark:from-dark-bg dark:to-dark-surface">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-full mb-6">
              <Zap className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
              CircuitWiz
            </h1>
            <p className="text-xl text-gray-600 dark:text-dark-text-secondary mb-8 max-w-2xl mx-auto">
              The ultimate electronics prototyping platform. Design circuits, write Arduino code, and bring your ideas to life.
            </p>
            
            <button
              onClick={login}
              className="inline-flex items-center gap-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <LogIn className="h-6 w-6" />
              Get Started Free
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white dark:bg-dark-surface rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-2">
                Visual Circuit Design
              </h3>
              <p className="text-gray-600 dark:text-dark-text-secondary">
                Drag and drop components to build circuits with real-time electrical simulation.
              </p>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-2">
                Arduino Code Generation
              </h3>
              <p className="text-gray-600 dark:text-dark-text-secondary">
                Automatically generate Arduino code from your circuit designs.
              </p>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-2">
                Real-time Simulation
              </h3>
              <p className="text-gray-600 dark:text-dark-text-secondary">
                Test your circuits with live electrical calculations and component behavior.
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-white dark:bg-dark-surface rounded-2xl p-8 shadow-xl text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
              Ready to Build Something Amazing?
            </h2>
            <p className="text-gray-600 dark:text-dark-text-secondary mb-6">
              Join thousands of makers, students, and engineers who use CircuitWiz to bring their ideas to life.
            </p>
            <button
              onClick={login}
              className="inline-flex items-center gap-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <LogIn className="h-5 w-5" />
              Start Building Now
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'project' && selectedProject) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
        {/* Top Navigation */}
        <div className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToProjects}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-dark-text-secondary dark:hover:text-dark-text-primary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Projects
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-dark-border" />
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary">
                {selectedProject.name}
              </h1>
              <SaveStatus 
                isSaving={saveStatus.isSaving}
                lastSaved={saveStatus.lastSaved}
                error={saveStatus.error}
                hasUnsavedChanges={saveStatus.hasUnsavedChanges}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:text-dark-text-muted dark:hover:text-dark-text-secondary">
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-500 dark:text-dark-text-muted">100%</span>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:text-dark-text-muted dark:hover:text-dark-text-secondary">
                <ZoomIn className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:text-dark-text-muted dark:hover:text-dark-text-secondary">
                <Maximize2 className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={() => setShowDevMenu(true)}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              title="Developer Menu (Ctrl+Shift+D)"
            >
              Dev
            </button>
            
            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user?.picture ? (
                  <img 
                    src={user.picture} 
                    alt={user.name} 
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-dark-text-primary">
                  {user?.name || user?.email}
                </span>
              </div>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-dark-text-muted dark:hover:text-dark-text-secondary transition-colors"
              >
                Sign Out
              </button>
            </div>
            
            <ThemeToggle />
          </div>
        </div>

        {/* Main Project Area */}
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Component Palette */}
          <ComponentPalette 
            selectedModule={selectedModule}
            onModuleSelect={handleModuleSelect}
          />
          
          {/* Project Grid */}
          <div className="flex-1 overflow-hidden">
            <ProjectGrid 
              project={{
                id: 1, // ProjectGrid expects a number ID, but we'll use the string ID from selectedProject internally
                name: selectedProject.name,
                lastModified: selectedProject.metadata?.updatedAt || new Date().toISOString(),
                preview: selectedProject.description || 'No description',
                gridSize: selectedProject.metadata?.gridSize || { width: 50, height: 50 }
              }}
              selectedModule={selectedModule}
              onModuleSelect={handleModuleSelect}
              onComponentStatesChange={setComponentStates}
              // Pass the actual project data
              initialGridData={selectedProject.gridData || []}
              initialWires={selectedProject.wires || []}
              initialComponentStates={selectedProject.componentStates || {}}
              projectId={selectedProject.id}
              getAccessToken={getAccessToken}
              onProjectDataChange={handleProjectDataChange}
              // Debug suite callbacks
              onCircuitPathwaysChange={setCircuitPathways}
              onWiresChange={setWires}
              onCircuitInfoChange={setCircuitInfo}
            />
          </div>
        </div>
        
        {/* Resistance Selector Modal */}
        {showResistanceSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
                Select Resistor Value
              </h3>
              <ResistanceSelector
                currentResistance={selectedResistance}
                onResistanceChange={handleResistanceSelect}
                onClose={() => setShowResistanceSelector(false)}
              />
            </div>
          </div>
        )}

        {/* Dev Menu */}
        <DevMenu
          isOpen={showDevMenu}
          onClose={() => setShowDevMenu(false)}
          componentStates={componentStates}
          circuitPathways={circuitPathways}
          logs={logs}
          wires={wires}
          circuitInfo={circuitInfo}
          gridData={gridData}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
      {/* Top Navigation */}
      <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Zap className="h-8 w-8 text-primary-600" />
          <span className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">CircuitWiz</span>
        </div>

        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <div className="relative flex flex-1">
            <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400 dark:text-dark-text-muted pl-3" />
            <input
              type="search"
              placeholder="Search projects..."
              className="input-field block h-full w-full border-0 py-0 pl-10 pr-0 focus:ring-0 sm:text-sm"
            />
          </div>
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user?.picture ? (
                  <img 
                    src={user.picture} 
                    alt={user.name} 
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-dark-text-primary">
                  {user?.name || user?.email}
                </span>
              </div>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-dark-text-muted dark:hover:text-dark-text-secondary transition-colors"
              >
                Sign Out
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary">
              Your Projects
            </h1>
            <p className="mt-2 text-gray-600 dark:text-dark-text-secondary">
              Create and manage your electronics prototyping projects
            </p>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* New Project Card */}
            <div 
              className="card p-6 border-2 border-dashed border-gray-300 dark:border-dark-border hover:border-primary-400 dark:hover:border-primary-500 transition-colors cursor-pointer group"
              onClick={handleCreateNewProject}
            >
              <div className="flex flex-col items-center justify-center h-48">
                <Plus className="h-12 w-12 text-gray-400 dark:text-dark-text-muted group-hover:text-primary-500 transition-colors" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-dark-text-primary">
                  New Project
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-dark-text-muted text-center">
                  Start a new electronics prototyping project
                </p>
              </div>
            </div>

            {/* Loading State */}
            {projectsLoading && (
              <div className="col-span-full flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            )}

            {/* Error State */}
            {dbError && (
              <div className="col-span-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400 text-sm">
                  Failed to load projects: {dbError}
                </p>
              </div>
            )}

            {/* User Project Cards */}
            {userProjects.map((project) => (
              <UserProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectSelect(project)}
                onDelete={() => openDeleteModal(project)}
              />
            ))}

            {/* Empty State */}
            {!projectsLoading && !dbError && userProjects.length === 0 && (
              <div className="col-span-full">
                <div className="text-center py-12 mb-8">
                  <div className="text-gray-400 dark:text-dark-text-muted mb-4">
                    <Zap className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
                    Welcome to CircuitWiz!
                  </h3>
                  <p className="text-gray-500 dark:text-dark-text-muted mb-6 max-w-md mx-auto">
                    You're ready to start building amazing electronics projects. Create your first project or try one of our sample projects.
                  </p>
                  <button
                    onClick={handleCreateNewProject}
                    className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    Create Your First Project
                  </button>
                </div>

                {/* Sample Projects */}
                <div className="bg-white dark:bg-dark-surface rounded-xl p-6 shadow-lg">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
                    Try These Sample Projects
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4">
                      <h5 className="font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                        LED Blink Circuit
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-3">
                        A simple circuit to blink an LED using Arduino
                      </p>
                      <button
                        onClick={() => createSampleProject('led-blink')}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Try This Project →
                      </button>
                    </div>
                    <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4">
                      <h5 className="font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                        Temperature Sensor
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-3">
                        Read temperature with a sensor and display on serial
                      </p>
                      <button
                        onClick={() => createSampleProject('temperature-sensor')}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Try This Project →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.project && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
                    Delete Project
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-muted">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 dark:text-dark-text-secondary">
                  Are you sure you want to delete <strong>"{deleteModal.project.name}"</strong>? 
                  This will permanently remove the project and all its data.
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={closeDeleteModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-dark-text-secondary bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteProject(deleteModal.project!)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                >
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface UserProjectCardProps {
  project: UserProject
  onClick: () => void
  onDelete: () => void
}

function UserProjectCard({ project, onClick, onDelete }: UserProjectCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} day${Math.floor(diffInHours / 24) > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  const getComponentCount = () => {
    if (!project.gridData || project.gridData.length === 0) return 0
    return project.gridData.flat().filter(cell => cell.occupied).length
  }

  return (
    <div 
      className="card overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
      onClick={onClick}
    >
      {/* Preview Area */}
      <div className="relative h-48 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400/20 to-primary-600/20 dark:from-primary-300/20 dark:to-primary-500/20" />
        
        {/* Project Preview */}
        <div className="absolute inset-0 opacity-25">
          <ProjectPreview project={project} className="w-full h-full" />
        </div>
        
        <div className="absolute inset-0 bg-black/10 dark:bg-white/10" />
        
        {/* Delete Button */}
        <button
          className="absolute top-2 left-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete project"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        
        {/* Project Stats */}
        <div className="absolute top-2 right-2 bg-white/90 dark:bg-dark-surface/90 rounded px-2 py-1 text-xs text-gray-600 dark:text-dark-text-secondary">
          {getComponentCount()} components
        </div>
      </div>
      
      {/* Project Info */}
      <div className="p-4 bg-white dark:bg-dark-card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary truncate">
          {project.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-muted">
          Last modified {formatDate(project.metadata.updatedAt)}
        </p>
        {project.description && (
          <p className="mt-2 text-sm text-gray-600 dark:text-dark-text-secondary line-clamp-2">
            {project.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-dark-text-muted">
          <span>v{project.metadata.version}</span>
          <span>•</span>
          <span>{project.metadata.gridSize.width}×{project.metadata.gridSize.height}</span>
        </div>
      </div>
    </div>
  )
}

export default App