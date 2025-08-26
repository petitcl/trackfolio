'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    setMounted(true)
    
    // Read the current theme from the DOM (set by the script in layout)
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    setThemeState(currentTheme)
    
    // Ensure DOM is in sync (script should have already handled this)
    const savedTheme = localStorage.getItem('trackfolio-theme') as Theme
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const expectedTheme = savedTheme || systemPreference
    
    if (currentTheme !== expectedTheme) {
      updateDOMTheme(expectedTheme)
      setThemeState(expectedTheme)
    }
  }, [])

  // Update DOM and localStorage when theme changes
  const updateDOMTheme = (newTheme: Theme) => {
    const root = document.documentElement
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark')
    
    // Add new theme class
    root.classList.add(newTheme)
    
    // Also update the data attribute for CSS targeting
    root.setAttribute('data-theme', newTheme)
    
    // Save to localStorage
    localStorage.setItem('trackfolio-theme', newTheme)
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    updateDOMTheme(newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  // Provide context even before mounted to prevent hydration issues
  const contextValue = {
    theme,
    toggleTheme,
    setTheme
  }

  return (
    <ThemeContext.Provider value={contextValue}>
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