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
    xs: '0 1px 2px var(--color-rgba-15-23-42-0-04)',
    sm: '0 1px 2px var(--color-rgba-15-23-42-0-05), 0 8px 22px var(--color-rgba-15-23-42-0-04)',
    md: '0 10px 30px var(--color-rgba-15-23-42-0-08)',
    lg: '0 14px 32px var(--color-rgba-17-24-39-16)',
    xl: '0 22px 60px var(--color-rgba-15-23-42-24)',
    xxl: '0 24px 70px var(--color-rgba-15-23-42-28)',
    floating: '0 24px 64px var(--color-rgba-15-23-42-22)',
    overlay: '0 24px 70px var(--color-rgba-15-23-42-24)',
    modal: '0 24px 70px var(--color-rgba-15-23-42-28)',
    dropdown: '0 24px 54px var(--color-rgba-15-23-42-18)',
    tooltip: '0 12px 28px var(--color-rgba-0-0-0-18)',
    toast: '0 10px 30px var(--color-rgba-15-23-42-0-08)'
  },
  dark: {
    none: 'none',
    xs: '0 1px 2px rgba(0, 0, 0, .26)',
    sm: '0 1px 2px rgba(0, 0, 0, .30), 0 8px 22px rgba(0, 0, 0, .24)',
    md: '0 12px 32px rgba(0, 0, 0, .36)',
    lg: '0 16px 36px rgba(0, 0, 0, .40)',
    xl: '0 24px 62px rgba(0, 0, 0, .46)',
    xxl: '0 28px 76px rgba(0, 0, 0, .52)',
    floating: '0 26px 66px rgba(0, 0, 0, .50)',
    overlay: '0 30px 82px rgba(0, 0, 0, .58)',
    modal: '0 30px 82px rgba(0, 0, 0, .62)',
    dropdown: '0 24px 58px rgba(0, 0, 0, .54)',
    tooltip: '0 14px 30px rgba(0, 0, 0, .46)',
    toast: '0 14px 34px rgba(0, 0, 0, .44)'
  }
}

export const SEMANTIC_SHADOWS: Record<SemanticShadowName, string> = {
  card: 'var(--shadow-sm)',
  widget: 'var(--shadow-xs)',
  dashboard: 'var(--shadow-sm)',
  sidebar: 'var(--shadow-xs)',
  navbar: 'var(--shadow-xs)',
  dialog: 'var(--shadow-modal)',
  popover: 'var(--shadow-floating)',
  menu: 'var(--shadow-dropdown)',
  inputFocus: '0 0 0 3px var(--color-rgba-37-99-235-0-14)',
  buttonHover: 'var(--shadow-sm)',
  buttonActive: 'var(--shadow-xs)'
}

export const SHADOW_ALIAS_TOKENS: Record<ShadowAliasName, string> = {
  focus: 'var(--shadow-input-focus)',
  cardShadow: 'var(--shadow-card)'
}

export const SHADOW_UTILITIES: Record<ShadowUtilityName, string> = {
  primaryButton: '0 7px 16px var(--color-rgba-37-99-235-18)',
  primaryButtonSoft: '0 7px 16px var(--color-rgba-37-99-235-12)',
  primaryButtonHover: '0 9px 20px var(--color-rgba-37-99-235-22)',
  primaryButtonHoverSoft: '0 9px 20px var(--color-rgba-37-99-235-18)',
  warningButton: '0 7px 16px var(--color-rgba-146-64-14-08)',
  dangerButton: '0 7px 16px var(--color-rgba-180-35-24-08)',
  brandButtonHover: '0 14px 32px var(--color-rgba-217-249-157-22)',
  notificationBadge: '0 6px 12px var(--color-rgba-180-35-24-18)',
  highlightRing: '0 0 0 9px var(--color-rgba-37-99-235-14)',
  rowDivider: '0 1px 0 var(--line)',
  insetBorder: 'inset 0 0 0 1px var(--line)',
  innerDivider: 'inset 0 -1px 0 var(--color-rgba-0-0-0-08)',
  selectedAccent: 'inset 3px 0 0 var(--accent)',
  selectedAccentSoft: 'inset 4px 0 0 var(--accent)',
  selectedAccentHover: 'inset 3px 0 0 var(--accent), 0 5px 14px var(--color-rgba-37-99-235-10)',
  selectedAccentRaised: 'inset 3px 0 0 var(--accent), var(--shadow-sm)',
  selectedAccentRaisedSoft: 'inset 4px 0 0 var(--accent), var(--shadow-xs)',
  selectedAccentStrong: 'inset 5px 0 0 var(--accent)',
  selectedInfo: 'inset 5px 0 0 var(--color-hex-2563eb)',
  selectedSuccess: 'inset 5px 0 0 var(--color-hex-059669)',
  selectedSuccessSoft: 'inset 4px 0 0 var(--success)',
  selectedGreen: 'inset 5px 0 0 var(--color-hex-16a34a)',
  selectedDanger: 'inset 5px 0 0 var(--color-hex-dc2626)',
  selectedDangerSoft: 'inset 4px 0 0 var(--danger)',
  selectedWarning: 'inset 4px 0 0 var(--warning)',
  selectedOrange: 'inset 5px 0 0 var(--color-hex-f97316)',
  selectedCyan: 'inset 3px 0 0 var(--evren-cyan)',
  selectedAmber: 'inset 4px 0 0 var(--evren-amber)',
  selectedMuted: 'inset 4px 0 0 var(--muted)',
  selectedTeal: 'inset 5px 0 0 var(--color-hex-0f766e)',
  selectedSky: 'inset 5px 0 0 var(--color-hex-0284c7)',
  successGlow: '0 18px 34px var(--color-rgba-22-163-74-16)',
  successIcon: '0 14px 28px var(--color-rgba-21-128-61-13)',
  loginLogo: '0 12px 28px var(--color-rgba-0-0-0-18)',
  loginPanel: '0 24px 70px var(--color-rgba-0-0-0-26)',
  loginAnnouncement: '0 14px 34px var(--color-rgba-0-0-0-16)',
  dialogSoft: '0 24px 70px var(--color-rgba-15-23-42-22)',
  softRaised: '0 5px 14px var(--color-rgba-15-23-42-08)',
  softRaisedMuted: '0 5px 14px var(--color-rgba-15-23-42-07)'
}
