import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        isDark ? 'bg-primary-600' : 'bg-gray-200'
      } ${className}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
          isDark ? 'translate-x-7' : 'translate-x-1'
        }`}
      >
        <div className="flex h-full w-full items-center justify-center">
          {isDark ? (
            <Moon className="h-4 w-4 text-primary-600" />
          ) : (
            <Sun className="h-4 w-4 text-gray-600" />
          )}
        </div>
      </span>
    </button>
  )
}
