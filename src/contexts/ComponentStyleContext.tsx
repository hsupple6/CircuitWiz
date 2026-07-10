import React, { createContext, useContext, useMemo, useState } from 'react'

export type ComponentVisualStyle = 'default' | 'schematic'

const STORAGE_KEY = 'circuitwiz-component-style'

export const COMPONENT_STYLE_OPTIONS: { id: ComponentVisualStyle; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'schematic', label: 'Schematic' },
]

function loadInitialStyle(): ComponentVisualStyle {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'schematic' ? 'schematic' : 'default'
}

interface ComponentStyleContextType {
  componentStyle: ComponentVisualStyle
  setComponentStyle: (style: ComponentVisualStyle) => void
}

const ComponentStyleContext = createContext<ComponentStyleContextType | undefined>(undefined)

export function ComponentStyleProvider({ children }: { children: React.ReactNode }) {
  const [componentStyle, setComponentStyleState] = useState<ComponentVisualStyle>(loadInitialStyle)

  const setComponentStyle = (style: ComponentVisualStyle) => {
    setComponentStyleState(style)
    localStorage.setItem(STORAGE_KEY, style)
  }

  const value = useMemo(
    () => ({ componentStyle, setComponentStyle }),
    [componentStyle]
  )

  return <ComponentStyleContext.Provider value={value}>{children}</ComponentStyleContext.Provider>
}

export function useComponentStyle() {
  const context = useContext(ComponentStyleContext)
  if (!context) {
    throw new Error('useComponentStyle must be used within a ComponentStyleProvider')
  }
  return context
}
