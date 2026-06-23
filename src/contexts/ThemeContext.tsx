import React, { createContext, useContext, useEffect, useState } from 'react'
import { ACCENT_PRESETS, DEFAULT_ACCENT, applyAccentColor, normalizeAccentHex } from '../utils/accentColor'

const ACCENT_STORAGE_KEY = 'carbon-accent-color'

interface ThemeContextType {
  isDark: boolean
  accentColor: string
  accentPresets: typeof ACCENT_PRESETS
  setAccentColor: (hex: string) => void
  resetAccentColor: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark] = useState(true)
  const [accentColor, setAccentColorState] = useState(() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY)
    const initial = saved ? normalizeAccentHex(saved) : DEFAULT_ACCENT
    applyAccentColor(initial)
    return initial
  })

  useEffect(() => {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  }, [])

  useEffect(() => {
    const normalized = applyAccentColor(accentColor)
    localStorage.setItem(ACCENT_STORAGE_KEY, normalized)
  }, [accentColor])

  const setAccentColor = (hex: string) => {
    setAccentColorState(normalizeAccentHex(hex))
  }

  const resetAccentColor = () => {
    setAccentColorState(DEFAULT_ACCENT)
  }

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        accentColor,
        accentPresets: ACCENT_PRESETS,
        setAccentColor,
        resetAccentColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
