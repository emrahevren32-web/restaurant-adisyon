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
  appBackground: COLOR_TOKENS.background[100],
  backgroundSubtle: COLOR_TOKENS.background[50],
  surface: COLOR_TOKENS.surface[50],
  surfaceMuted: COLOR_TOKENS.surface[100],
  surfaceSubtle: COLOR_TOKENS.surface[200],
  surfaceRaised: COLOR_TOKENS.surface[50],
  cardBackground: COLOR_TOKENS.surface[50],
  sidebarBackground: COLOR_TOKENS.surface[50],
  navbarBackground: COLOR_TOKENS.surface[50],
  modalBackground: COLOR_TOKENS.surface[50],
  drawerBackground: COLOR_TOKENS.surface[50],
  tooltipBackground: COLOR_TOKENS.neutral[900],
  toastBackground: COLOR_TOKENS.surface[50],
  tableHeaderBackground: COLOR_TOKENS.surface[100],
  tableRowHover: COLOR_TOKENS.primary[50],
  border: COLOR_TOKENS.border[200],
  borderSoft: '#edf2f7',
  borderStrong: COLOR_TOKENS.border[300],
  text: COLOR_TOKENS.text[900],
  textSoft: COLOR_TOKENS.text[700],
  textMuted: COLOR_TOKENS.text[500],
  textMutedStrong: COLOR_TOKENS.text[600],
  icon: COLOR_TOKENS.icon[700],
  iconMuted: COLOR_TOKENS.icon[500],
  primary: COLOR_TOKENS.primary[600],
  primaryHover: COLOR_TOKENS.primary[700],
  primarySoft: COLOR_TOKENS.primary[50],
  primarySubtle: COLOR_TOKENS.primary[100],
  primaryLine: COLOR_TOKENS.primary[200],
  primaryButtonBackground: COLOR_TOKENS.primary[600],
  primaryButtonText: COLOR_TOKENS.surface[50],
  primaryButtonHover: COLOR_TOKENS.primary[700],
  secondaryButtonBackground: COLOR_TOKENS.surface[50],
  secondaryButtonText: COLOR_TOKENS.text[700],
  secondaryButtonHover: COLOR_TOKENS.surface[100],
  hover: COLOR_TOKENS.surface[100],
  active: COLOR_TOKENS.primary[50],
  disabledBackground: COLOR_TOKENS.surface[200],
  disabledText: COLOR_TOKENS.text[500],
  selectedBackground: COLOR_TOKENS.primary[50],
  focusRing: 'rgba(37,99,235,0.14)',
  inputBorder: COLOR_TOKENS.border[200],
  inputFocus: COLOR_TOKENS.primary[600],
  inputError: COLOR_TOKENS.danger[600],
  inputSuccess: COLOR_TOKENS.success[600],
  success: COLOR_TOKENS.success[700],
  successSoft: '#ecfdf3',
  successLine: COLOR_TOKENS.success[200],
  warning: COLOR_TOKENS.warning[800],
  warningSoft: COLOR_TOKENS.warning[50],
  warningLine: COLOR_TOKENS.warning[200],
  danger: '#b42318',
  dangerSoft: COLOR_TOKENS.danger[50],
  dangerLine: COLOR_TOKENS.danger[200],
  info: COLOR_TOKENS.info[600],
  infoSoft: COLOR_TOKENS.info[50],
  infoLine: COLOR_TOKENS.info[200],
  orange: '#ea580c',
  orangeSoft: COLOR_TOKENS.warning[50],
  orangeLine: '#fed7aa',
  white: COLOR_TOKENS.surface[50],
  black: COLOR_TOKENS.text[900]
}

export const DARK_THEME_COLORS: ThemeColorMap = {
  appBackground: '#0f172a',
  backgroundSubtle: '#111827',
  surface: '#15171c',
  surfaceMuted: '#20242d',
  surfaceSubtle: '#272b33',
  surfaceRaised: '#1f2937',
  cardBackground: '#15171c',
  sidebarBackground: '#111827',
  navbarBackground: '#15171c',
  modalBackground: '#15171c',
  drawerBackground: '#15171c',
  tooltipBackground: COLOR_TOKENS.surface[50],
  toastBackground: '#15171c',
  tableHeaderBackground: '#20242d',
  tableRowHover: '#1e3a8a',
  border: '#334155',
  borderSoft: '#272b33',
  borderStrong: '#475569',
  text: '#f8fafc',
  textSoft: '#e5e7eb',
  textMuted: '#cbd5e1',
  textMutedStrong: '#e2e8f0',
  icon: '#e5e7eb',
  iconMuted: '#cbd5e1',
  primary: COLOR_TOKENS.primary[400],
  primaryHover: COLOR_TOKENS.primary[300],
  primarySoft: '#172554',
  primarySubtle: '#1e3a8a',
  primaryLine: COLOR_TOKENS.primary[700],
  primaryButtonBackground: COLOR_TOKENS.primary[500],
  primaryButtonText: COLOR_TOKENS.surface[50],
  primaryButtonHover: COLOR_TOKENS.primary[400],
  secondaryButtonBackground: '#20242d',
  secondaryButtonText: '#f8fafc',
  secondaryButtonHover: '#272b33',
  hover: '#20242d',
  active: '#1e3a8a',
  disabledBackground: '#272b33',
  disabledText: '#64748b',
  selectedBackground: '#1e3a8a',
  focusRing: 'rgba(96,165,250,.28)',
  inputBorder: '#475569',
  inputFocus: COLOR_TOKENS.primary[400],
  inputError: COLOR_TOKENS.danger[400],
  inputSuccess: COLOR_TOKENS.success[400],
  success: COLOR_TOKENS.success[400],
  successSoft: '#14532d',
  successLine: COLOR_TOKENS.success[700],
  warning: COLOR_TOKENS.warning[300],
  warningSoft: '#78350f',
  warningLine: COLOR_TOKENS.warning[700],
  danger: COLOR_TOKENS.danger[300],
  dangerSoft: '#7f1d1d',
  dangerLine: COLOR_TOKENS.danger[700],
  info: COLOR_TOKENS.info[300],
  infoSoft: '#0c4a6e',
  infoLine: COLOR_TOKENS.info[700],
  orange: COLOR_TOKENS.warning[300],
  orangeSoft: '#78350f',
  orangeLine: COLOR_TOKENS.warning[700],
  white: COLOR_TOKENS.surface[50],
  black: COLOR_TOKENS.text[900]
}

export const THEME_COLORS: Record<ThemeMode, ThemeColorMap> = {
  light: LIGHT_THEME_COLORS,
  dark: DARK_THEME_COLORS
}

export const CHART_THEME_COLORS = {
  primary: COLOR_TOKENS.primary[600],
  success: COLOR_TOKENS.success[600],
  warning: COLOR_TOKENS.warning[600],
  warningStrong: COLOR_TOKENS.warning[700],
  danger: COLOR_TOKENS.danger[600],
  secondary: COLOR_TOKENS.secondary[600],
  muted: COLOR_TOKENS.neutral[600],
  empty: COLOR_TOKENS.text[200],
  teal: '#0f766e',
  cyan: '#0891b2',
  purple: '#9333ea',
  orange: '#f97316'
} as const

export const DISTRIBUTION_CHART_COLORS = [
  CHART_THEME_COLORS.cyan,
  CHART_THEME_COLORS.success,
  CHART_THEME_COLORS.warning,
  CHART_THEME_COLORS.danger,
  CHART_THEME_COLORS.secondary,
  CHART_THEME_COLORS.muted
] as const

export const AI_ANALYSIS_CHART_COLORS = [
  CHART_THEME_COLORS.teal,
  CHART_THEME_COLORS.primary,
  CHART_THEME_COLORS.warningStrong,
  CHART_THEME_COLORS.danger,
  CHART_THEME_COLORS.secondary,
  CHART_THEME_COLORS.cyan
] as const

export const KPI_CHART_COLORS = [
  CHART_THEME_COLORS.primary,
  '#059669',
  CHART_THEME_COLORS.orange,
  CHART_THEME_COLORS.purple,
  CHART_THEME_COLORS.danger,
  CHART_THEME_COLORS.teal,
  '#ca8a04',
  CHART_THEME_COLORS.muted
] as const

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
  borderAccent: '#a8c7fa',
  tableHeader: '#f3f4f6',
  tableHeaderSoft: COLOR_TOKENS.surface[100],
  tableHeaderMarketplace: '#f3f6fb',
  tableHeaderRecipe: '#eef4fb',
  accent: '#0f766e',
  pillText: '#2458c5'
} as const
