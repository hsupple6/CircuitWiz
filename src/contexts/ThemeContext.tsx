import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ACCENT_PRESETS, DEFAULT_ACCENT, applyAccentColor, normalizeAccentHex } from '../utils/accentColor'
import {
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
  WIRE_COLOR_MODE_STORAGE_KEY,
  parseColorMode,
  type ColorMode,
} from '../theme/colors'

const ACCENT_STORAGE_KEY = 'carbon-accent-color'

function loadInitialColorMode(): ColorMode {
  const stored =
    localStorage.getItem(COLOR_MODE_STORAGE_KEY) ??
    localStorage.getItem(WIRE_COLOR_MODE_STORAGE_KEY) ??
    localStorage.getItem('theme')
  return parseColorMode(stored)
}

const THEME_TRANSITION_MS = 500

function applyDocumentColorMode(mode: ColorMode, animate = false) {
  const root = document.documentElement
  let transitionTimer: ReturnType<typeof setTimeout> | undefined

  const apply = () => {
    root.classList.toggle('dark', mode === 'dark')
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
    localStorage.setItem(WIRE_COLOR_MODE_STORAGE_KEY, mode)
    localStorage.setItem('theme', mode)
  }

  if (animate) {
    root.classList.add('theme-transition')
    apply()
    transitionTimer = window.setTimeout(() => {
      root.classList.remove('theme-transition')
    }, THEME_TRANSITION_MS)
  } else {
    apply()
  }

  return () => {
    if (transitionTimer !== undefined) {
      window.clearTimeout(transitionTimer)
      root.classList.remove('theme-transition')
    }
  }
}

interface ThemeContextType {
  colorMode: ColorMode
  isDark: boolean
  accentColor: string
  accentPresets: typeof ACCENT_PRESETS
  /** Wire palette variant — follows app color mode */
  wireColorMode: ColorMode
  setColorMode: (mode: ColorMode) => void
  setAccentColor: (hex: string) => void
  resetAccentColor: () => void
  /** @deprecated Use setColorMode */
  setWireColorMode: (mode: ColorMode) => void
  resetColorMode: () => void
  /** @deprecated Use resetColorMode */
  resetWireColorMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    const mode = loadInitialColorMode()
    applyDocumentColorMode(mode)
    return mode
  })
  const [accentColor, setAccentColorState] = useState(() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY)
    const initial = saved ? normalizeAccentHex(saved) : DEFAULT_ACCENT
    applyAccentColor(initial)
    return initial
  })

  const isDark = colorMode === 'dark'
  const isInitialColorMode = useRef(true)

  useEffect(() => {
    const cleanup = applyDocumentColorMode(colorMode, !isInitialColorMode.current)
    isInitialColorMode.current = false
    return cleanup
  }, [colorMode])

  useEffect(() => {
    const normalized = applyAccentColor(accentColor)
    localStorage.setItem(ACCENT_STORAGE_KEY, normalized)
  }, [accentColor])

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode)
  }

  const setAccentColor = (hex: string) => {
    setAccentColorState(normalizeAccentHex(hex))
  }

  const resetAccentColor = () => {
    setAccentColorState(DEFAULT_ACCENT)
  }

  const resetColorMode = () => {
    setColorModeState(DEFAULT_COLOR_MODE)
  }

  const value = useMemo(
    () => ({
      colorMode,
      isDark,
      accentColor,
      accentPresets: ACCENT_PRESETS,
      wireColorMode: colorMode,
      setColorMode,
      setAccentColor,
      resetAccentColor,
      setWireColorMode: setColorMode,
      resetColorMode,
      resetWireColorMode: resetColorMode,
    }),
    [colorMode, isDark, accentColor]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
