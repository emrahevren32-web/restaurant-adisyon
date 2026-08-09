import {
  COLOR_SHADES,
  COLOR_TOKENS,
  LEGACY_COLOR_ALIAS_VALUES,
  createColorVariableName
} from './ColorTokens'
import {
  LEGACY_THEME_VARIABLES,
  THEME_COLORS,
  type SemanticColorName,
  type ThemeMode
} from './ThemeColors'

const COLOR_STYLE_ELEMENT_ID = 'miyop-color-palette-system'

const toCssVariableName = (name: string) => (
  name.replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
)

const createPaletteVariables = () => (
  Object.entries(COLOR_TOKENS).flatMap(([group, scale]) => (
    COLOR_SHADES.map(shade => `--color-${group}-${shade}:${scale[shade]};`)
  )).join('')
)

const createSemanticVariables = (themeMode: ThemeMode) => {
  const colors = THEME_COLORS[themeMode]
  const semanticVariables = Object.entries(colors).map(([name, value]) => (
    `--color-${toCssVariableName(name)}:${value};`
  ))
  const compatibilityVariables = Object.entries(LEGACY_THEME_VARIABLES).map(([legacyName, semanticName]) => (
    `--${legacyName}:var(--color-${toCssVariableName(semanticName)});`
  ))

  return [...semanticVariables, ...compatibilityVariables].join('')
}

const createLegacyAliasVariables = () => (
  LEGACY_COLOR_ALIAS_VALUES.map(value => (
    `--color-${createColorVariableName(value)}:${value};`
  )).join('')
)

export const createColorPaletteCssVariables = (themeMode: ThemeMode = 'light') => [
  createPaletteVariables(),
  createSemanticVariables(themeMode),
  createLegacyAliasVariables()
].join('')

export const createColorPaletteSystemCss = () => `
:root{${createColorPaletteCssVariables('light')}}
@media (prefers-color-scheme:dark){:root{${createSemanticVariables('dark')}}}
[data-theme="light"]{${createSemanticVariables('light')}}
[data-theme="dark"]{${createSemanticVariables('dark')}}
`.trim()

const normalizeHex = (value: string) => {
  const color = value.trim()
  if(!color.startsWith('#')) return ''
  if(color.length === 4){
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return color.length >= 7 ? color.slice(0, 7) : ''
}

const hexToRgb = (value: string) => {
  const hex = normalizeHex(value)
  if(!hex) return null
  const numberValue = Number.parseInt(hex.slice(1), 16)
  if(!Number.isFinite(numberValue)) return null
  return {
    red: (numberValue >> 16) & 255,
    green: (numberValue >> 8) & 255,
    blue: numberValue & 255
  }
}

const getRelativeChannelLuminance = (channel: number) => {
  const normalized = channel / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

export const getRelativeLuminance = (color: string) => {
  const rgb = hexToRgb(color)
  if(!rgb) return 0

  return 0.2126 * getRelativeChannelLuminance(rgb.red)
    + 0.7152 * getRelativeChannelLuminance(rgb.green)
    + 0.0722 * getRelativeChannelLuminance(rgb.blue)
}

export const getContrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = getRelativeLuminance(foreground)
  const backgroundLuminance = getRelativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100
}

export const getAccessibilityContrastReport = (
  themeMode: ThemeMode = 'light'
) => {
  const colors = THEME_COLORS[themeMode]
  const pairs: Array<{
    name: string
    foreground: SemanticColorName
    background: SemanticColorName
    minimum: number
  }> = [
    { name: 'Body Text', foreground: 'text', background: 'appBackground', minimum: 4.5 },
    { name: 'Muted Text', foreground: 'textMutedStrong', background: 'surface', minimum: 4.5 },
    { name: 'Primary Button', foreground: 'primaryButtonText', background: 'primaryButtonBackground', minimum: 4.5 },
    { name: 'Danger Text', foreground: 'danger', background: 'dangerSoft', minimum: 4.5 },
    { name: 'Success Text', foreground: 'success', background: 'successSoft', minimum: 4.5 },
    { name: 'Warning Text', foreground: 'warning', background: 'warningSoft', minimum: 4.5 }
  ]

  return pairs.map(pair => {
    const ratio = getContrastRatio(colors[pair.foreground], colors[pair.background])
    return {
      ...pair,
      ratio,
      passes: ratio >= pair.minimum
    }
  })
}

export const applyColorPaletteSystem = (targetDocument: Document = document) => {
  const existingStyle = targetDocument.getElementById(COLOR_STYLE_ELEMENT_ID)
  const cssText = createColorPaletteSystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = COLOR_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
