import { getContrastRatio } from './ColorPalette'
import {
  DEFAULT_THEME_ACCENT,
  PREMIUM_ACCENT_NAMES,
  PREMIUM_ACCENT_PALETTES,
  PREMIUM_THEME_TOKENS,
  type PremiumAccentName,
  type ThemeMode
} from './PremiumThemeTokens'

const PREMIUM_THEME_STYLE_ELEMENT_ID = 'miyop-premium-theme-engine'

type TokenLeaf = string | number
type TokenBranch = TokenLeaf | TokenTree

interface TokenTree {
  [key: string]: TokenBranch
}

const toCssVariableName = (name: string) => (
  name
    .replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('en-US')
)

const isTokenBranch = (value: TokenBranch): value is Record<string, TokenBranch> => (
  typeof value === 'object' && value !== null
)

const flattenCssVariables = (
  tokens: TokenTree,
  path: string[] = []
): string[] => (
  Object.entries(tokens).flatMap(([key, value]) => {
    const nextPath = [...path, toCssVariableName(key)]
    if(isTokenBranch(value)) return flattenCssVariables(value, nextPath)
    return `--${nextPath.join('-')}:${value};`
  })
)

const createThemeVariableTree = (
  themeMode: ThemeMode,
  accentName: PremiumAccentName = DEFAULT_THEME_ACCENT
) => {
  const theme = PREMIUM_THEME_TOKENS[themeMode]
  const accent = PREMIUM_ACCENT_PALETTES[themeMode][accentName]

  return {
    theme: {
      mode: theme.mode,
      app: theme.app,
      color: theme.color,
      text: theme.text,
      icon: theme.icon,
      surface: theme.surface,
      card: theme.card,
      border: theme.border,
      semantic: {
        ...theme.semantic,
        primary: accent
      },
      state: {
        ...theme.state,
        active: accent.soft,
        selected: accent.soft
      },
      shadow: theme.shadow,
      blur: theme.blur,
      radius: theme.radius,
      typography: theme.typography,
      motion: theme.motion,
      glass: theme.glass,
      elevation: theme.elevation
    }
  }
}

const createCompatibilityThemeVariables = () => [
  '--bg:var(--theme-app-bg);',
  '--surface:var(--theme-surface-1);',
  '--surface-muted:var(--theme-surface-2);',
  '--surface-subtle:var(--theme-surface-3);',
  '--surface-raised:var(--theme-card-raised);',
  '--card:var(--theme-card-background);',
  '--text:var(--theme-text-primary);',
  '--text-soft:var(--theme-text-secondary);',
  '--muted:var(--theme-text-muted);',
  '--muted-strong:var(--theme-text-muted-strong);',
  '--accent:var(--theme-semantic-primary-base);',
  '--accent-hover:var(--theme-semantic-primary-hover);',
  '--accent-soft:var(--theme-semantic-primary-soft);',
  '--accent-subtle:var(--theme-semantic-primary-subtle);',
  '--accent-line:var(--theme-semantic-primary-line);',
  '--line:var(--theme-border-default);',
  '--line-soft:var(--theme-border-subtle);',
  '--line-strong:var(--theme-border-strong);',
  '--success:var(--theme-semantic-success-base);',
  '--success-soft:var(--theme-semantic-success-soft);',
  '--success-line:var(--theme-semantic-success-line);',
  '--secondary:var(--theme-semantic-secondary-base);',
  '--secondary-soft:var(--theme-semantic-secondary-soft);',
  '--secondary-line:var(--theme-semantic-secondary-line);',
  '--info:var(--theme-semantic-info-base);',
  '--info-soft:var(--theme-semantic-info-soft);',
  '--info-line:var(--theme-semantic-info-line);',
  '--warning:var(--theme-semantic-warning-base);',
  '--warning-soft:var(--theme-semantic-warning-soft);',
  '--warning-line:var(--theme-semantic-warning-line);',
  '--danger:var(--theme-semantic-danger-base);',
  '--danger-soft:var(--theme-semantic-danger-soft);',
  '--danger-line:var(--theme-semantic-danger-line);',
  '--error:var(--theme-semantic-error-base);',
  '--error-soft:var(--theme-semantic-error-soft);',
  '--error-line:var(--theme-semantic-error-line);',
  '--neutral:var(--theme-semantic-neutral-base);',
  '--neutral-soft:var(--theme-semantic-neutral-soft);',
  '--neutral-line:var(--theme-semantic-neutral-line);',
  '--orange:var(--theme-semantic-warning-base);',
  '--orange-soft:var(--theme-semantic-warning-soft);',
  '--orange-line:var(--theme-semantic-warning-line);',
  '--color-app-background:var(--theme-app-bg);',
  '--color-background-subtle:var(--theme-app-muted);',
  '--color-surface:var(--theme-surface-1);',
  '--color-surface-muted:var(--theme-surface-2);',
  '--color-surface-subtle:var(--theme-surface-3);',
  '--color-surface-raised:var(--theme-card-raised);',
  '--color-card-background:var(--theme-card-background);',
  '--color-border:var(--theme-border-default);',
  '--color-border-soft:var(--theme-border-subtle);',
  '--color-border-strong:var(--theme-border-strong);',
  '--color-text:var(--theme-text-primary);',
  '--color-text-soft:var(--theme-text-secondary);',
  '--color-text-muted:var(--theme-text-muted);',
  '--color-text-muted-strong:var(--theme-text-muted-strong);',
  '--color-icon:var(--theme-icon-default);',
  '--color-icon-muted:var(--theme-icon-muted);',
  '--color-primary:var(--theme-semantic-primary-base);',
  '--color-primary-hover:var(--theme-semantic-primary-hover);',
  '--color-primary-soft:var(--theme-semantic-primary-soft);',
  '--color-primary-subtle:var(--theme-semantic-primary-subtle);',
  '--color-primary-line:var(--theme-semantic-primary-line);',
  '--color-primary-button-background:var(--theme-semantic-primary-base);',
  '--color-primary-button-text:var(--theme-semantic-primary-contrast);',
  '--color-primary-button-hover:var(--theme-semantic-primary-hover);',
  '--color-secondary:var(--theme-semantic-secondary-base);',
  '--color-secondary-soft:var(--theme-semantic-secondary-soft);',
  '--color-secondary-line:var(--theme-semantic-secondary-line);',
  '--color-secondary-button-background:var(--theme-surface-1);',
  '--color-secondary-button-text:var(--theme-text-secondary);',
  '--color-secondary-button-hover:var(--theme-surface-2);',
  '--color-success:var(--theme-semantic-success-base);',
  '--color-success-soft:var(--theme-semantic-success-soft);',
  '--color-success-line:var(--theme-semantic-success-line);',
  '--color-warning:var(--theme-semantic-warning-base);',
  '--color-warning-soft:var(--theme-semantic-warning-soft);',
  '--color-warning-line:var(--theme-semantic-warning-line);',
  '--color-danger:var(--theme-semantic-danger-base);',
  '--color-danger-soft:var(--theme-semantic-danger-soft);',
  '--color-danger-line:var(--theme-semantic-danger-line);',
  '--color-error:var(--theme-semantic-error-base);',
  '--color-error-soft:var(--theme-semantic-error-soft);',
  '--color-error-line:var(--theme-semantic-error-line);',
  '--color-info:var(--theme-semantic-info-base);',
  '--color-info-soft:var(--theme-semantic-info-soft);',
  '--color-info-line:var(--theme-semantic-info-line);',
  '--color-neutral:var(--theme-semantic-neutral-base);',
  '--color-neutral-soft:var(--theme-semantic-neutral-soft);',
  '--color-neutral-line:var(--theme-semantic-neutral-line);',
  '--color-hover:var(--theme-state-hover);',
  '--color-active:var(--theme-state-active);',
  '--color-selected-background:var(--theme-state-selected);',
  '--color-disabled-background:var(--theme-state-disabled-background);',
  '--color-disabled-text:var(--theme-state-disabled-text);',
  '--color-focus-ring:var(--theme-state-focus-ring);',
  '--shadow-none:var(--theme-shadow-none);',
  '--shadow-xs:var(--theme-shadow-xs);',
  '--shadow-sm:var(--theme-shadow-sm);',
  '--shadow-md:var(--theme-shadow-md);',
  '--shadow-lg:var(--theme-shadow-lg);',
  '--shadow-xl:var(--theme-shadow-xl);',
  '--shadow-card:var(--theme-elevation-1-shadow);',
  '--shadow-widget:var(--theme-elevation-1-shadow);',
  '--shadow-dashboard:var(--theme-elevation-1-shadow);',
  '--shadow-sidebar:var(--theme-glass-sidebar-shadow);',
  '--shadow-navbar:var(--theme-glass-topbar-shadow);',
  '--shadow-dialog:var(--theme-glass-modal-shadow);',
  '--shadow-modal:var(--theme-glass-modal-shadow);',
  '--shadow-floating:var(--theme-shadow-floating);',
  '--shadow-dropdown:var(--theme-glass-dropdown-shadow);',
  '--shadow-overlay:var(--theme-shadow-overlay);',
  '--shadow-popover:var(--theme-shadow-floating);',
  '--shadow-menu:var(--theme-glass-dropdown-shadow);',
  '--shadow-input-focus:var(--theme-state-focus-ring);',
  '--shadow-focus:var(--theme-state-focus-ring);',
  '--shadow-card-shadow:var(--theme-elevation-1-shadow);',
  '--card-shadow:var(--theme-elevation-1-shadow);',
  '--glass-sidebar-bg:var(--theme-glass-sidebar-background);',
  '--glass-topbar-bg:var(--theme-glass-topbar-background);',
  '--glass-card-bg:var(--theme-glass-card-background);',
  '--glass-modal-bg:var(--theme-glass-modal-background);',
  '--glass-drawer-bg:var(--theme-glass-drawer-background);',
  '--glass-dropdown-bg:var(--theme-glass-dropdown-background);'
].join('')

export const createPremiumThemeCssVariables = (
  themeMode: ThemeMode = 'light',
  accentName: PremiumAccentName = DEFAULT_THEME_ACCENT
) => [
  ...flattenCssVariables(createThemeVariableTree(themeMode, accentName)),
  createCompatibilityThemeVariables()
].join('')

export const createPremiumThemeEngineCss = () => {
  const lightDefault = createPremiumThemeCssVariables('light')
  const darkDefault = createPremiumThemeCssVariables('dark')
  const accentSelectors = PREMIUM_ACCENT_NAMES.flatMap(accentName => [
    `[data-theme="light"][data-theme-accent="${accentName}"]{${createPremiumThemeCssVariables('light', accentName)}}`,
    `[data-theme="dark"][data-theme-accent="${accentName}"]{${createPremiumThemeCssVariables('dark', accentName)}}`
  ])

  return [
    `:root{${lightDefault}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme]){${darkDefault}}}`,
    `[data-theme="light"]{${lightDefault}}`,
    `[data-theme="dark"]{${darkDefault}}`,
    ...accentSelectors
  ].join('\n')
}

export const applyPremiumThemeEngine = (targetDocument: Document = document) => {
  const cssText = createPremiumThemeEngineCss()
  const existingStyle = targetDocument.getElementById(PREMIUM_THEME_STYLE_ELEMENT_ID)

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = PREMIUM_THEME_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}

export const getPremiumThemeTokens = (themeMode: ThemeMode = 'light') => (
  PREMIUM_THEME_TOKENS[themeMode]
)

export const getPremiumAccentTokens = (
  themeMode: ThemeMode = 'light',
  accentName: PremiumAccentName = DEFAULT_THEME_ACCENT
) => (
  PREMIUM_ACCENT_PALETTES[themeMode][accentName]
)

export const getPremiumThemeAccessibilityReport = (
  themeMode: ThemeMode = 'light',
  accentName: PremiumAccentName = DEFAULT_THEME_ACCENT
) => {
  const theme = getPremiumThemeTokens(themeMode)
  const accent = getPremiumAccentTokens(themeMode, accentName)
  const pairs = [
    {
      name: 'Body Text',
      foreground: theme.text.primary,
      background: theme.app.bg,
      minimum: 4.5
    },
    {
      name: 'Muted Text',
      foreground: theme.text.mutedStrong,
      background: theme.surface[1],
      minimum: 4.5
    },
    {
      name: 'Primary Action',
      foreground: accent.contrast,
      background: accent.base,
      minimum: 4.5
    },
    {
      name: 'Success Text',
      foreground: theme.semantic.success.base,
      background: theme.surface[1],
      minimum: 4.5
    },
    {
      name: 'Warning Text',
      foreground: theme.semantic.warning.base,
      background: theme.surface[1],
      minimum: 4.5
    },
    {
      name: 'Danger Text',
      foreground: theme.semantic.danger.base,
      background: theme.surface[1],
      minimum: 4.5
    }
  ]

  return pairs.map(pair => {
    const ratio = getContrastRatio(pair.foreground, pair.background)
    return {
      ...pair,
      ratio,
      passes: ratio >= pair.minimum
    }
  })
}
