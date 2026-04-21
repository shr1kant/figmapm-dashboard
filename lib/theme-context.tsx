'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeColors {
  bg: string
  toolbar: string
  toolbarBorder: string
  sidebar: string
  sidebarBorder: string
  card: string
  cardBorder: string
  cardHoverShadow: string
  text: string
  textMuted: string
  textFaint: string
  inputBg: string
  inputBorder: string
  divider: string
  navActive: string
  navHover: string
  emptyBorder: string
  footerBorder: string
  modalBg: string
  modalOverlay: string
  tagBg: string
}

const light: ThemeColors = {
  bg: '#f0f0f0',
  toolbar: '#ffffff',
  toolbarBorder: '#e5e5e5',
  sidebar: '#1e1e1e',
  sidebarBorder: '#383838',
  card: '#ffffff',
  cardBorder: '#e8e8e8',
  cardHoverShadow: '0 2px 8px rgba(0,0,0,0.08)',
  text: '#1a1a1a',
  textMuted: '#666666',
  textFaint: '#aaaaaa',
  inputBg: '#fafafa',
  inputBorder: '#e5e5e5',
  divider: '#f5f5f5',
  navActive: '#383838',
  navHover: '#2c2c2c',
  emptyBorder: '#d9d9d9',
  footerBorder: '#f0f0f0',
  modalBg: '#ffffff',
  modalOverlay: 'rgba(0,0,0,0.5)',
  tagBg: '#f5f5f5',
}

const dark: ThemeColors = {
  bg: '#141414',
  toolbar: '#1e1e1e',
  toolbarBorder: '#303030',
  sidebar: '#111111',
  sidebarBorder: '#2a2a2a',
  card: '#252525',
  cardBorder: '#333333',
  cardHoverShadow: '0 2px 8px rgba(0,0,0,0.3)',
  text: '#e5e5e5',
  textMuted: '#888888',
  textFaint: '#555555',
  inputBg: '#1e1e1e',
  inputBorder: '#383838',
  divider: '#2a2a2a',
  navActive: '#2e2e2e',
  navHover: '#252525',
  emptyBorder: '#333333',
  footerBorder: '#2a2a2a',
  modalBg: '#1e1e1e',
  modalOverlay: 'rgba(0,0,0,0.7)',
  tagBg: '#2c2c2c',
}

interface ThemeContextValue {
  theme: Theme
  colors: ThemeColors
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  colors: light,
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(prefersDark ? 'dark' : 'light')
  }, [])

  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, colors: theme === 'dark' ? dark : light, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)