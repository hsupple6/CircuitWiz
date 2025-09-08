import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getCategories, getModulesByCategory } from '../modules/registry'
import { DynamicModule } from './DynamicModule'
import { ModuleDefinition } from '../modules/types'

interface ComponentPaletteProps {
  selectedModule: ModuleDefinition | null
  onModuleSelect: (module: ModuleDefinition | null) => void
}

export function ComponentPalette({ selectedModule, onModuleSelect }: ComponentPaletteProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['microcontrollers']))
  const categories = getCategories()

  const handleModuleClick = (module: ModuleDefinition) => {
    if (!onModuleSelect) {
      alert('Error: Module selection function not available. Please refresh the page.')
      return
    }
    
    // If the same module is clicked, deselect it
    if (selectedModule?.module === module.module) {
      onModuleSelect(null)
    } else {
      onModuleSelect(module)
    }
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  return (
    <div 
      className="w-80 bg-white dark:bg-dark-surface border-r border-gray-200 dark:border-dark-border flex flex-col select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-border">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
          Components
        </h2>
        <p className="text-sm text-gray-500 dark:text-dark-text-muted">
          Click to select, then click on grid to place
        </p>
      </div>

      {/* Components List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {categories.map((category) => {
            const modules = getModulesByCategory(category)
            const isExpanded = expandedCategories.has(category)
            
            return (
              <div key={category} className="border border-gray-200 dark:border-dark-border rounded-lg">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-dark-card transition-colors select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  <span className="font-medium text-gray-900 dark:text-dark-text-primary capitalize">
                    {category}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 dark:text-dark-text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 dark:text-dark-text-muted" />
                  )}
                </button>

                {/* Category Modules */}
                {isExpanded && (
                  <div className="p-2 space-y-1">
                    {modules.map((module) => (
                      <div
                        key={module.module}
                        onClick={() => handleModuleClick(module)}
                        className={`group cursor-pointer transition-all duration-200 ${
                          selectedModule?.module === module.module
                            ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-dark-bg'
                            : 'hover:shadow-md'
                        }`}
                      >
                        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden hover:shadow-sm transition-shadow flex flex-col">
                          {/* Module Preview - Top section */}
                          <div className="h-24 flex items-center justify-center bg-gray-50 dark:bg-dark-bg overflow-hidden" data-module-preview>
                            <DynamicModule 
                              definition={module}
                              className="scale-[0.3] origin-center"
                              style={{
                                transform: `scale(${module.gridX > module.gridY ? 0.3 : 0.3}) rotate(${module.gridX > module.gridY ? '0deg' : '90deg'})`
                              }}
                            />
                          </div>

                          {/* Module Info - Bottom section (auto height) */}
                          <div className="p-2 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                            <h3 className="font-medium text-gray-900 dark:text-dark-text-primary text-xs truncate">
                              {module.module}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                              {module.gridX} × {module.gridY} grid
                            </p>
                            {module.description && (
                              <p className="text-xs text-gray-400 dark:text-dark-text-muted truncate">
                                {module.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-gray-50 dark:bg-dark-bg rounded-lg select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
          <h4 className="font-medium text-gray-900 dark:text-dark-text-primary text-sm mb-2">
            How to use:
          </h4>
          <ul className="text-xs text-gray-600 dark:text-dark-text-secondary space-y-1">
            <li>• Click components to select them</li>
            <li>• Hover over grid to see placement preview</li>
            <li>• Click on grid to place selected component</li>
            <li>• Use zoom controls to adjust view</li>
            <li>• Right-click to pan around</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
