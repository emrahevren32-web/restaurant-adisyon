import {
  DEFAULT_THEME_ACCENT,
  DEFAULT_THEME_MODE,
  PREMIUM_ACCENT_NAMES,
  PREMIUM_ELEVATION_LEVELS,
  PREMIUM_GLASS_SURFACES,
  PREMIUM_SURFACE_LEVELS,
  type PremiumAccentName,
  type PremiumElevationLevel,
  type PremiumGlassSurface,
  type PremiumSurfaceLevel,
  type ThemeMode
} from './PremiumThemeTokens'

export type PremiumSurfaceElement =
  | 'div'
  | 'section'
  | 'article'
  | 'aside'
  | 'header'
  | 'main'
  | 'nav'
  | 'footer'

const toCssVariableName = (value: string) => (
  value
    .replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('en-US')
)

export const getThemeCssVariable = (...segments: Array<string | number>) => (
  `var(--theme-${segments.map(segment => toCssVariableName(String(segment))).join('-')})`
)

export const isThemeMode = (value: unknown): value is ThemeMode => (
  value === 'light' || value === 'dark'
)

export const normalizeThemeMode = (value: unknown): ThemeMode => (
  isThemeMode(value) ? value : DEFAULT_THEME_MODE
)

export const isPremiumAccentName = (value: unknown): value is PremiumAccentName => (
  typeof value === 'string' && PREMIUM_ACCENT_NAMES.includes(value as PremiumAccentName)
)

export const normalizePremiumAccentName = (value: unknown): PremiumAccentName => (
  isPremiumAccentName(value) ? value : DEFAULT_THEME_ACCENT
)

export const isPremiumSurfaceLevel = (value: unknown): value is PremiumSurfaceLevel => (
  typeof value === 'number' && PREMIUM_SURFACE_LEVELS.includes(value as PremiumSurfaceLevel)
)

export const normalizePremiumSurfaceLevel = (value: unknown): PremiumSurfaceLevel => (
  isPremiumSurfaceLevel(value) ? value : 1
)

export const isPremiumElevationLevel = (value: unknown): value is PremiumElevationLevel => (
  typeof value === 'number' && PREMIUM_ELEVATION_LEVELS.includes(value as PremiumElevationLevel)
)

export const normalizePremiumElevationLevel = (value: unknown): PremiumElevationLevel => (
  isPremiumElevationLevel(value) ? value : 1
)

export const isPremiumGlassSurface = (value: unknown): value is PremiumGlassSurface => (
  typeof value === 'string' && PREMIUM_GLASS_SURFACES.includes(value as PremiumGlassSurface)
)

export const normalizePremiumGlassSurface = (value: unknown): PremiumGlassSurface => (
  isPremiumGlassSurface(value) ? value : 'card'
)

export const getSurfaceClassName = (level: PremiumSurfaceLevel = 1) => (
  `theme-surface surface-level-${level}`
)

export const getElevationClassName = (level: PremiumElevationLevel = 1) => (
  `theme-elevation elevation-level-${level}`
)

export const getGlassClassName = (surface: PremiumGlassSurface = 'card') => (
  `glass-surface glass-${surface}`
)

