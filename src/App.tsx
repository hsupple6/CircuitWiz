import React, { useState, useEffect } from 'react'
import { 
  Zap, 
  Plus,
  Search,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react'
import { ThemeProvider } from './contexts/ThemeContext'
import { ThemeToggle } from './components/ThemeToggle'
import { ProjectGrid } from './components/ProjectGrid'
import { ComponentPalette } from './components/ComponentPalette'
import { ResistanceSelector } from './components/ResistanceSelector'
import { DevMenu } from './components/DevMenu'
import { ModuleDefinition } from './modules/types'
import { logger } from './services/Logger'

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

function AppContent() {
  const [currentView, setCurrentView] = useState<'projects' | 'project'>('projects')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedModule, setSelectedModule] = useState<ModuleDefinition | null>(null)
  const [showResistanceSelector, setShowResistanceSelector] = useState(false)
  const [selectedResistance, setSelectedResistance] = useState(1000)
  const [showDevMenu, setShowDevMenu] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [componentStates, setComponentStates] = useState<Map<string, any>>(new Map())
  
  // Subscribe to logger updates
  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs)
    })
    return unsubscribe
  }, [])

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
  
  const handleModuleSelect = (module: ModuleDefinition | null) => {
    console.log('App: Module selected:', module)
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

  // Sample projects data
  const [projects] = useState<Project[]>([
    {
      id: 1,
      name: 'Smart Home Controller',
      lastModified: '2 hours ago',
      preview: 'A comprehensive smart home system using ESP32...',
      gridSize: { width: 20, height: 15 }
    },
    {
      id: 2,
      name: 'Weather Station',
      lastModified: '1 day ago',
      preview: 'Arduino-based weather monitoring station with...',
      gridSize: { width: 15, height: 12 }
    },
    {
      id: 3,
      name: 'LED Matrix Display',
      lastModified: '3 days ago',
      preview: 'ESP32-powered LED matrix for displaying...',
      gridSize: { width: 25, height: 20 }
    }
  ])

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
    setCurrentView('project')
  }

  const handleBackToProjects = () => {
    setCurrentView('projects')
    setSelectedProject(null)
    setSelectedModule(null)
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
            <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary">
              {selectedProject.name}
            </h1>
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
              project={selectedProject}
              selectedModule={selectedModule}
              onModuleSelect={handleModuleSelect}
              onComponentStatesChange={setComponentStates}
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
          logs={logs}
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
            <div className="card p-6 border-2 border-dashed border-gray-300 dark:border-dark-border hover:border-primary-400 dark:hover:border-primary-500 transition-colors cursor-pointer group">
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

            {/* Existing Project Cards */}
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectSelect(project)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

interface Project {
  id: number
  name: string
  lastModified: string
  preview: string
  gridSize: { width: number; height: number }
}

interface ProjectCardProps {
  project: Project
  onClick: () => void
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div 
      className="card overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
      onClick={onClick}
    >
      {/* Preview Area - Blurred */}
      <div className="relative h-48 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400/20 to-primary-600/20 dark:from-primary-300/20 dark:to-primary-500/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid grid-cols-4 gap-2 opacity-30">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-3 h-3 bg-white dark:bg-dark-text-primary rounded-sm" />
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-black/10 dark:bg-white/10" />
      </div>
      
      {/* Project Info */}
      <div className="p-4 bg-white dark:bg-dark-card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary truncate">
          {project.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-muted">
          Last modified {project.lastModified}
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-dark-text-secondary line-clamp-2">
          {project.preview}
        </p>
      </div>
    </div>
  )
}

export default App