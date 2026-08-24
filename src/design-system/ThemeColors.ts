import { COLOR_TOKENS } from './ColorTokens'

export type ThemeMode = 'light' | 'dark'

export type SemanticColorName =
  | 'appBackground'
  | 'backgroundSubtle'
  | 'surface'
  | 'surfaceMuted'
  | 'surfaceSubtle'
  | 'surfaceRaised'
  | 'cardBackground'
  | 'sidebarBackground'
  | 'navbarBackground'
  | 'modalBackground'
  | 'drawerBackground'
  | 'tooltipBackground'
  | 'toastBackground'
  | 'tableHeaderBackground'
  | 'tableRowHover'
  | 'border'
  | 'borderSoft'
  | 'borderStrong'
  | 'text'
  | 'textSoft'
  | 'textMuted'
  | 'textMutedStrong'
  | 'icon'
  | 'iconMuted'
  | 'primary'
  | 'primaryHover'
  | 'primarySoft'
  | 'primarySubtle'
  | 'primaryLine'
  | 'primaryButtonBackground'
  | 'primaryButtonText'
  | 'primaryButtonHover'
  | 'secondaryButtonBackground'
  | 'secondaryButtonText'
  | 'secondaryButtonHover'
  | 'hover'
  | 'active'
  | 'disabledBackground'
  | 'disabledText'
  | 'selectedBackground'
  | 'focusRing'
  | 'inputBorder'
  | 'inputFocus'
  | 'inputError'
  | 'inputSuccess'
  | 'success'
  | 'successSoft'
  | 'successLine'
  | 'warning'
  | 'warningSoft'
  | 'warningLine'
  | 'danger'
  | 'dangerSoft'
  | 'dangerLine'
  | 'info'
  | 'infoSoft'
  | 'infoLine'
  | 'orange'
  | 'orangeSoft'
  | 'orangeLine'
  | 'white'
  | 'black'

export type ThemeColorMap = Record<SemanticColorName, string>

export const LIGHT_THEME_COLORS: ThemeColorMap = {
  appBackground: '#f8fafc',
  backgroundSubtle: '#f1f5f9',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  surfaceSubtle: '#f1f5f9',
  surfaceRaised: '#ffffff',
  cardBackground: '#ffffff',
  sidebarBackground: '#0f172a',
  navbarBackground: '#ffffff',
  modalBackground: '#ffffff',
  drawerBackground: '#ffffff',
  tooltipBackground: '#0f172a',
  toastBackground: '#ffffff',
  tableHeaderBackground: '#f8fafc',
  tableRowHover: '#f8fafc',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textSoft: '#334155',
  textMuted: '#64748b',
  textMutedStrong: '#475569',
  icon: '#475569',
  iconMuted: '#64748b',
  primary: '#0f766e',
  primaryHover: '#115e59',
  primarySoft: '#f0fdfa',
  primarySubtle: '#ccfbf1',
  primaryLine: '#99f6e4',
  primaryButtonBackground: '#0f766e',
  primaryButtonText: '#ffffff',
  primaryButtonHover: '#115e59',
  secondaryButtonBackground: '#ffffff',
  secondaryButtonText: '#334155',
  secondaryButtonHover: '#f8fafc',
  hover: '#f8fafc',
  active: '#f0fdfa',
  disabledBackground: '#f1f5f9',
  disabledText: COLOR_TOKENS.text[400],
  selectedBackground: '#f0fdfa',
  focusRing: 'rgba(15, 118, 110, 0.20)',
  inputBorder: '#e2e8f0',
  inputFocus: '#0f766e',
  inputError: '#dc2626',
  inputSuccess: '#059669',
  success: '#059669',
  successSoft: '#ecfdf5',
  successLine: '#a7f3d0',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  warningLine: '#fde68a',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerLine: '#fecaca',
  info: '#0284c7',
  infoSoft: '#f0f9ff',
  infoLine: '#bae6fd',
  orange: '#ea580c',
  orangeSoft: '#fff7ed',
  orangeLine: '#fed7aa',
  white: '#ffffff',
  black: '#0f172a'
}

export const DARK_THEME_COLORS: ThemeColorMap = {
  appBackground: '#0b0f17',
  backgroundSubtle: '#0f172a',
  surface: '#111827',
  surfaceMuted: '#1e293b',
  surfaceSubtle: '#334155',
  surfaceRaised: '#182234',
  cardBackground: '#111827',
  sidebarBackground: '#0b0f17',
  navbarBackground: '#111827',
  modalBackground: '#111827',
  drawerBackground: '#111827',
  tooltipBackground: '#1e293b',
  toastBackground: '#111827',
  tableHeaderBackground: '#1e293b',
  tableRowHover: '#182234',
  border: '#1e293b',
  borderSoft: '#182234',
  borderStrong: '#334155',
  text: '#f8fafc',
  textSoft: '#cbd5e1',
  textMuted: '#94a3b8',
  textMutedStrong: '#cbd5e1',
  icon: '#cbd5e1',
  iconMuted: '#94a3b8',
  primary: '#2dd4bf',
  primaryHover: '#5eead4',
  primarySoft: 'rgba(45, 212, 191, 0.15)',
  primarySubtle: 'rgba(45, 212, 191, 0.22)',
  primaryLine: 'rgba(45, 212, 191, 0.35)',
  primaryButtonBackground: '#0d9488',
  primaryButtonText: '#ffffff',
  primaryButtonHover: '#0f766e',
  secondaryButtonBackground: '#1e293b',
  secondaryButtonText: '#f8fafc',
  secondaryButtonHover: '#334155',
  hover: '#182234',
  active: '#1e293b',
  disabledBackground: '#1e293b',
  disabledText: '#64748b',
  selectedBackground: 'rgba(45, 212, 191, 0.15)',
  focusRing: 'rgba(45, 212, 191, 0.30)',
  inputBorder: '#1e293b',
  inputFocus: '#2dd4bf',
  inputError: '#f87171',
  inputSuccess: '#34d399',
  success: '#34d399',
  successSoft: 'rgba(52, 211, 153, 0.15)',
  successLine: 'rgba(52, 211, 153, 0.35)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251, 191, 36, 0.15)',
  warningLine: 'rgba(251, 191, 36, 0.35)',
  danger: '#f87171',
  dangerSoft: 'rgba(248, 113, 113, 0.15)',
  dangerLine: 'rgba(248, 113, 113, 0.35)',
  info: '#38bdf8',
  infoSoft: 'rgba(56, 189, 248, 0.15)',
  infoLine: 'rgba(56, 189, 248, 0.35)',
  orange: '#fb923c',
  orangeSoft: 'rgba(251, 146, 60, 0.15)',
  orangeLine: 'rgba(251, 146, 60, 0.35)',
  white: '#ffffff',
  black: '#0b0f17'
}

export const THEME_COLORS: Record<ThemeMode, ThemeColorMap> = {
  light: LIGHT_THEME_COLORS,
  dark: DARK_THEME_COLORS
}

type ChartThemeColorName =
  | 'primary'
  | 'success'
  | 'warning'
  | 'warningStrong'
  | 'danger'
  | 'secondary'
  | 'muted'
  | 'empty'
  | 'teal'
  | 'cyan'
  | 'purple'
  | 'orange'

export const CHART_THEME_COLORS: Record<ChartThemeColorName, string> = {
  primary: '#0f766e',
  success: '#059669',
  warning: '#d97706',
  warningStrong: '#b45309',
  danger: '#dc2626',
  secondary: '#475569',
  muted: '#64748b',
  empty: '#e2e8f0',
  teal: '#0f766e',
  cyan: '#0284c7',
  purple: '#7c3aed',
  orange: '#ea580c'
}

export const DISTRIBUTION_CHART_COLORS: string[] = [
  CHART_THEME_COLORS.cyan,
  CHART_THEME_COLORS.success,
  CHART_THEME_COLORS.warning,
  CHART_THEME_COLORS.danger,
  CHART_THEME_COLORS.secondary,
  CHART_THEME_COLORS.muted
]

export const AI_ANALYSIS_CHART_COLORS: string[] = [
  CHART_THEME_COLORS.teal,
  CHART_THEME_COLORS.primary,
  CHART_THEME_COLORS.warningStrong,
  CHART_THEME_COLORS.danger,
  CHART_THEME_COLORS.secondary,
  CHART_THEME_COLORS.cyan
]

export const KPI_CHART_COLORS: string[] = [
  CHART_THEME_COLORS.primary,
  CHART_THEME_COLORS.success,
  CHART_THEME_COLORS.orange,
  CHART_THEME_COLORS.purple,
  CHART_THEME_COLORS.danger,
  CHART_THEME_COLORS.teal,
  CHART_THEME_COLORS.warningStrong,
  CHART_THEME_COLORS.muted
]

export const LEGACY_THEME_VARIABLES: Record<string, SemanticColorName> = {
  bg: 'appBackground',
  surface: 'surface',
  'surface-muted': 'surfaceMuted',
  'surface-subtle': 'surfaceSubtle',
  'surface-raised': 'surfaceRaised',
  card: 'cardBackground',
  text: 'text',
  'text-soft': 'textSoft',
  muted: 'textMuted',
  'muted-strong': 'textMutedStrong',
  accent: 'primary',
  'accent-hover': 'primaryHover',
  'accent-soft': 'primarySoft',
  'accent-subtle': 'primarySubtle',
  'accent-line': 'primaryLine',
  line: 'border',
  'line-soft': 'borderSoft',
  'line-strong': 'borderStrong',
  success: 'success',
  'success-soft': 'successSoft',
  'success-line': 'successLine',
  warning: 'warning',
  'warning-soft': 'warningSoft',
  'warning-line': 'warningLine',
  danger: 'danger',
  'danger-soft': 'dangerSoft',
  'danger-line': 'dangerLine',
  orange: 'orange',
  'orange-soft': 'orangeSoft',
  'orange-line': 'orangeLine'
}

export const PRINT_THEME_COLORS = {
  text: LIGHT_THEME_COLORS.text,
  textDeep: COLOR_TOKENS.background[900],
  textInk: '#172033',
  textRecipe: '#17202a',
  textSoftAlt: '#5d6678',
  textSoft: LIGHT_THEME_COLORS.textSoft,
  textMuted: LIGHT_THEME_COLORS.textMuted,
  textMutedStrong: LIGHT_THEME_COLORS.textMutedStrong,
  textMutedAlt: '#6b7280',
  textHeader: COLOR_TOKENS.text[700],
  background: LIGHT_THEME_COLORS.white,
  pageBackground: LIGHT_THEME_COLORS.backgroundSubtle,
  surface: LIGHT_THEME_COLORS.white,
  surfaceMuted: LIGHT_THEME_COLORS.surfaceMuted,
  surfaceSubtle: COLOR_TOKENS.surface[100],
  surfaceBox: '#f9fafb',
  border: '#d1d5db',
  borderMuted: COLOR_TOKENS.text[200],
  borderSoft: '#e5e7eb',
  borderTable: COLOR_TOKENS.border[300],
  borderMarketplace: '#d8deea',
  borderRecipe: '#d8e0ea',
  borderAccent: '#b9cdfb',
  tableHeader: '#f3f4f6',
  tableHeaderSoft: COLOR_TOKENS.surface[100],
  tableHeaderMarketplace: '#f3f6fb',
  tableHeaderRecipe: '#eef4fb',
  accent: '#2557d6',
  pillText: '#1f49b8'
} as const
