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
  appBackground: '#f5f4f0',
  backgroundSubtle: '#eceae4',
  surface: '#faf9f5',
  surfaceMuted: '#f3f1ec',
  surfaceSubtle: '#ebe7df',
  surfaceRaised: '#fffdf8',
  cardBackground: '#fffdf8',
  sidebarBackground: '#faf9f5',
  navbarBackground: '#fffdf8',
  modalBackground: '#fffdf8',
  drawerBackground: '#fffdf8',
  tooltipBackground: COLOR_TOKENS.neutral[900],
  toastBackground: '#fffdf8',
  tableHeaderBackground: '#f3f1ec',
  tableRowHover: '#edf3ff',
  border: '#d5cec2',
  borderSoft: '#e6e1d8',
  borderStrong: '#b9afa1',
  text: '#161b22',
  textSoft: '#303a46',
  textMuted: '#687382',
  textMutedStrong: '#4b5563',
  icon: '#3f4854',
  iconMuted: '#687382',
  primary: '#2557d6',
  primaryHover: '#1f49b8',
  primarySoft: '#edf3ff',
  primarySubtle: '#dfe9ff',
  primaryLine: '#b9cdfb',
  primaryButtonBackground: '#2557d6',
  primaryButtonText: '#ffffff',
  primaryButtonHover: '#1f49b8',
  secondaryButtonBackground: '#faf9f5',
  secondaryButtonText: '#303a46',
  secondaryButtonHover: '#f3f1ec',
  hover: '#f0eee8',
  active: '#edf3ff',
  disabledBackground: '#eceae4',
  disabledText: COLOR_TOKENS.text[500],
  selectedBackground: '#e7efff',
  focusRing: 'rgba(37,87,214,0.18)',
  inputBorder: '#d5cec2',
  inputFocus: '#2557d6',
  inputError: '#b42318',
  inputSuccess: '#047857',
  success: '#047857',
  successSoft: '#edfdf6',
  successLine: '#a9e8ca',
  warning: '#b45309',
  warningSoft: '#fff8ed',
  warningLine: '#f3ca8f',
  danger: '#b42318',
  dangerSoft: '#fff3f2',
  dangerLine: '#f6bbb6',
  info: '#2563eb',
  infoSoft: '#eff6ff',
  infoLine: '#bfdbfe',
  orange: '#b45309',
  orangeSoft: '#fff6ed',
  orangeLine: '#f5c389',
  white: '#fffdf8',
  black: '#161b22'
}

export const DARK_THEME_COLORS: ThemeColorMap = {
  appBackground: '#272b31',
  backgroundSubtle: '#30343b',
  surface: '#333841',
  surfaceMuted: '#3b414b',
  surfaceSubtle: '#454c57',
  surfaceRaised: '#2d3138',
  cardBackground: '#333841',
  sidebarBackground: '#333841',
  navbarBackground: '#333841',
  modalBackground: '#333841',
  drawerBackground: '#333841',
  tooltipBackground: COLOR_TOKENS.surface[50],
  toastBackground: '#333841',
  tableHeaderBackground: '#3b414b',
  tableRowHover: '#34415a',
  border: '#464c55',
  borderSoft: '#3a3f48',
  borderStrong: '#58606b',
  text: '#f3f5f7',
  textSoft: '#d8dde4',
  textMuted: '#a5afbd',
  textMutedStrong: '#c7ced8',
  icon: '#d8dde4',
  iconMuted: '#a5afbd',
  primary: '#8ab4ff',
  primaryHover: '#a8c8ff',
  primarySoft: '#334263',
  primarySubtle: '#3a4b73',
  primaryLine: '#5f789f',
  primaryButtonBackground: '#8ab4ff',
  primaryButtonText: '#23272e',
  primaryButtonHover: '#a8c8ff',
  secondaryButtonBackground: '#3b414b',
  secondaryButtonText: '#f3f5f7',
  secondaryButtonHover: '#454c57',
  hover: '#383d45',
  active: '#34415a',
  disabledBackground: '#383d45',
  disabledText: '#818b99',
  selectedBackground: '#3a4964',
  focusRing: 'rgba(138,180,255,.30)',
  inputBorder: '#464c55',
  inputFocus: '#8ab4ff',
  inputError: '#ff8b8b',
  inputSuccess: '#6ee7b7',
  success: '#6ee7b7',
  successSoft: '#2d453c',
  successLine: '#4f8f76',
  warning: '#f5c56b',
  warningSoft: '#4a3e2e',
  warningLine: '#8f7242',
  danger: '#ff8b8b',
  dangerSoft: '#4b3435',
  dangerLine: '#925758',
  info: '#93c5fd',
  infoSoft: '#334357',
  infoLine: '#6686ad',
  orange: '#f5a45b',
  orangeSoft: '#4b3c30',
  orangeLine: '#946844',
  white: COLOR_TOKENS.surface[50],
  black: '#23272e'
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
  primary: '#2557d6',
  success: '#047857',
  warning: '#b45309',
  warningStrong: '#92400e',
  danger: '#b42318',
  secondary: '#475569',
  muted: '#687382',
  empty: '#d5cec2',
  teal: '#0f766e',
  cyan: '#2563eb',
  purple: '#7c3aed',
  orange: '#b45309'
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
