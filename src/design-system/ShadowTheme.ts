import {
  type ShadowTokenMap
} from './ShadowTokens'
import type { ThemeMode } from './ThemeColors'

export type SemanticShadowName =
  | 'card'
  | 'widget'
  | 'dashboard'
  | 'sidebar'
  | 'navbar'
  | 'dialog'
  | 'popover'
  | 'menu'
  | 'inputFocus'
  | 'buttonHover'
  | 'buttonActive'

export type ShadowUtilityName =
  | 'primaryButton'
  | 'primaryButtonSoft'
  | 'primaryButtonHover'
  | 'primaryButtonHoverSoft'
  | 'warningButton'
  | 'dangerButton'
  | 'brandButtonHover'
  | 'notificationBadge'
  | 'highlightRing'
  | 'rowDivider'
  | 'insetBorder'
  | 'innerDivider'
  | 'selectedAccent'
  | 'selectedAccentSoft'
  | 'selectedAccentHover'
  | 'selectedAccentRaised'
  | 'selectedAccentRaisedSoft'
  | 'selectedAccentStrong'
  | 'selectedInfo'
  | 'selectedSuccess'
  | 'selectedSuccessSoft'
  | 'selectedGreen'
  | 'selectedDanger'
  | 'selectedDangerSoft'
  | 'selectedWarning'
  | 'selectedOrange'
  | 'selectedCyan'
  | 'selectedAmber'
  | 'selectedMuted'
  | 'selectedTeal'
  | 'selectedSky'
  | 'successGlow'
  | 'successIcon'
  | 'loginLogo'
  | 'loginPanel'
  | 'loginAnnouncement'
  | 'dialogSoft'
  | 'softRaised'
  | 'softRaisedMuted'

export type ShadowAliasName =
  | 'focus'
  | 'cardShadow'

export const SHADOW_THEMES: Record<ThemeMode, ShadowTokenMap> = {
  light: {
    none: 'none',
    xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
    sm: '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)',
    md: '0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
    lg: '0 10px 15px -3px rgba(15, 23, 42, 0.07), 0 4px 6px -4px rgba(15, 23, 42, 0.03)',
    xl: '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03)',
    xxl: '0 25px 50px -12px rgba(15, 23, 42, 0.16)',
    floating: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
    overlay: '0 20px 40px -15px rgba(15, 23, 42, 0.25)',
    modal: '0 25px 50px -12px rgba(15, 23, 42, 0.22)',
    dropdown: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
    tooltip: '0 4px 6px -1px rgba(15, 23, 42, 0.12)',
    toast: '0 10px 25px -5px rgba(15, 23, 42, 0.1)'
  },
  dark: {
    none: 'none',
    xs: '0 1px 2px rgba(0, 0, 0, .26)',
    sm: '0 1px 3px rgba(0, 0, 0, .30), 0 1px 2px rgba(0, 0, 0, .20)',
    md: '0 4px 8px rgba(0, 0, 0, .36)',
    lg: '0 10px 18px rgba(0, 0, 0, .40)',
    xl: '0 16px 28px rgba(0, 0, 0, .46)',
    xxl: '0 24px 48px rgba(0, 0, 0, .52)',
    floating: '0 14px 32px rgba(0, 0, 0, .50)',
    overlay: '0 24px 56px rgba(0, 0, 0, .58)',
    modal: '0 25px 50px -12px rgba(0, 0, 0, .62)',
    dropdown: '0 12px 28px rgba(0, 0, 0, .54)',
    tooltip: '0 6px 16px rgba(0, 0, 0, .46)',
    toast: '0 10px 24px rgba(0, 0, 0, .44)'
  }
}

export const SEMANTIC_SHADOWS: Record<SemanticShadowName, string> = {
  card: 'var(--shadow-xs)',
  widget: 'var(--shadow-xs)',
  dashboard: 'var(--shadow-xs)',
  sidebar: 'none',
  navbar: 'var(--shadow-xs)',
  dialog: 'var(--shadow-modal)',
  popover: 'var(--shadow-floating)',
  menu: 'var(--shadow-dropdown)',
  inputFocus: '0 0 0 3px rgba(15, 118, 110, 0.20)',
  buttonHover: 'var(--shadow-xs)',
  buttonActive: 'none'
}

export const SHADOW_ALIAS_TOKENS: Record<ShadowAliasName, string> = {
  focus: 'var(--shadow-input-focus)',
  cardShadow: 'var(--shadow-card)'
}

export const SHADOW_UTILITIES: Record<ShadowUtilityName, string> = {
  primaryButton: '0 1px 2px rgba(15, 118, 110, 0.18)',
  primaryButtonSoft: '0 1px 2px rgba(15, 118, 110, 0.10)',
  primaryButtonHover: '0 2px 4px rgba(15, 118, 110, 0.22)',
  primaryButtonHoverSoft: '0 2px 4px rgba(15, 118, 110, 0.16)',
  warningButton: '0 1px 2px rgba(217, 119, 6, 0.12)',
  dangerButton: '0 1px 2px rgba(220, 38, 38, 0.12)',
  brandButtonHover: '0 2px 6px rgba(15, 118, 110, 0.20)',
  notificationBadge: '0 1px 2px rgba(220, 38, 38, 0.25)',
  highlightRing: '0 0 0 3px rgba(15, 118, 110, 0.20)',
  rowDivider: '0 1px 0 var(--line)',
  insetBorder: 'inset 0 0 0 1px var(--line)',
  innerDivider: 'inset 0 -1px 0 var(--line-soft)',
  selectedAccent: 'inset 3px 0 0 var(--accent)',
  selectedAccentSoft: 'inset 3px 0 0 var(--accent)',
  selectedAccentHover: 'inset 3px 0 0 var(--accent)',
  selectedAccentRaised: 'inset 3px 0 0 var(--accent), var(--shadow-xs)',
  selectedAccentRaisedSoft: 'inset 3px 0 0 var(--accent)',
  selectedAccentStrong: 'inset 3px 0 0 var(--accent)',
  selectedInfo: 'inset 3px 0 0 var(--color-hex-0284c7)',
  selectedSuccess: 'inset 3px 0 0 var(--color-hex-059669)',
  selectedSuccessSoft: 'inset 3px 0 0 var(--success)',
  selectedGreen: 'inset 3px 0 0 var(--color-hex-059669)',
  selectedDanger: 'inset 3px 0 0 var(--color-hex-dc2626)',
  selectedDangerSoft: 'inset 3px 0 0 var(--danger)',
  selectedWarning: 'inset 3px 0 0 var(--warning)',
  selectedOrange: 'inset 3px 0 0 var(--color-hex-ea580c)',
  selectedCyan: 'inset 3px 0 0 var(--color-hex-0284c7)',
  selectedAmber: 'inset 3px 0 0 var(--color-hex-d97706)',
  selectedMuted: 'inset 3px 0 0 var(--muted)',
  selectedTeal: 'inset 3px 0 0 var(--color-hex-0f766e)',
  selectedSky: 'inset 3px 0 0 var(--color-hex-0284c7)',
  successGlow: '0 2px 6px rgba(5, 150, 105, 0.15)',
  successIcon: '0 1px 2px rgba(5, 150, 105, 0.15)',
  loginLogo: '0 4px 8px rgba(15, 23, 42, 0.12)',
  loginPanel: '0 20px 40px -15px rgba(15, 23, 42, 0.25)',
  loginAnnouncement: '0 4px 12px rgba(15, 23, 42, 0.08)',
  dialogSoft: '0 20px 40px -15px rgba(15, 23, 42, 0.20)',
  softRaised: '0 1px 3px rgba(15, 23, 42, 0.06)',
  softRaisedMuted: '0 1px 2px rgba(15, 23, 42, 0.04)'
}
