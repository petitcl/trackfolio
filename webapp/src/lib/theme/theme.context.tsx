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

  // Initialize theme from DOM (which was set by the script in layout)
  useEffect(() => {
    setMounted(true)
    
    // Read the current theme from the DOM (set by the script in layout)
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    setThemeState(currentTheme)
  }, [])

  // Update DOM and localStorage when theme changes
  const updateDOMTheme = (newTheme: Theme) => {
    const root = document.documentElement
    
    // Set the full className to maintain h-full and add theme
    root.className = `h-full ${newTheme}`
    
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