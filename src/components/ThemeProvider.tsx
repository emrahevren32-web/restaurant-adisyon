import React from 'react'
import {
  DEFAULT_THEME_ACCENT,
  DEFAULT_THEME_MODE,
  type PremiumAccentName,
  type ThemeMode
} from '../design-system/PremiumThemeTokens'
import {
  isThemeMode,
  normalizePremiumAccentName,
  normalizeThemeMode
} from '../design-system/ThemeUtilities'

const THEME_STORAGE_KEY = 'miyop-theme'
const THEME_ACCENT_STORAGE_KEY = 'miyop-theme-accent'

export type ThemeContextValue = {
  themeMode: ThemeMode
  accent: PremiumAccentName
  setThemeMode: (themeMode: ThemeMode) => void
  setAccent: (accent: PremiumAccentName) => void
  toggleThemeMode: () => void
}

const getStoredValue = (key: string) => {
  if(typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const setStoredValue = (key: string, value: string) => {
  if(typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Theme stays active for the current session when storage is blocked.
  }
}

const getInitialThemeMode = (): ThemeMode => {
  const storedTheme = getStoredValue(THEME_STORAGE_KEY)
  if(isThemeMode(storedTheme)) return storedTheme

  if(typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches){
    return 'dark'
  }

  return DEFAULT_THEME_MODE
}

const getInitialAccent = (): PremiumAccentName => (
  normalizePremiumAccentName(getStoredValue(THEME_ACCENT_STORAGE_KEY))
)

export const ThemeContext = React.createContext<ThemeContextValue>({
  themeMode: DEFAULT_THEME_MODE,
  accent: DEFAULT_THEME_ACCENT,
  setThemeMode: () => undefined,
  setAccent: () => undefined,
  toggleThemeMode: () => undefined
})

export type ThemeProviderProps = {
  children: React.ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeMode, setThemeModeState] = React.useState<ThemeMode>(getInitialThemeMode)
  const [accent, setAccentState] = React.useState<PremiumAccentName>(getInitialAccent)

  React.useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeMode
    root.dataset.themeEngine = 'premium'
    root.dataset.themeAccent = accent
    root.style.colorScheme = themeMode
    setStoredValue(THEME_STORAGE_KEY, themeMode)
    setStoredValue(THEME_ACCENT_STORAGE_KEY, accent)
  }, [accent, themeMode])

  const setThemeMode = React.useCallback((nextThemeMode: ThemeMode) => {
    setThemeModeState(normalizeThemeMode(nextThemeMode))
  }, [])

  const setAccent = React.useCallback((nextAccent: PremiumAccentName) => {
    setAccentState(normalizePremiumAccentName(nextAccent))
  }, [])

  const toggleThemeMode = React.useCallback(() => {
    setThemeModeState(current => current === 'dark' ? 'light' : 'dark')
  }, [])

  const value = React.useMemo<ThemeContextValue>(() => ({
    themeMode,
    accent,
    setThemeMode,
    setAccent,
    toggleThemeMode
  }), [accent, setAccent, setThemeMode, themeMode, toggleThemeMode])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => React.useContext(ThemeContext)

export default ThemeProvider
