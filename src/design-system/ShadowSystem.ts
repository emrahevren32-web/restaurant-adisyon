import { createShadowTokenCssVariables } from './ShadowTokens'
import {
  SEMANTIC_SHADOWS,
  SHADOW_ALIAS_TOKENS,
  SHADOW_THEMES,
  SHADOW_UTILITIES,
  type ShadowUtilityName
} from './ShadowTheme'
import type { ThemeMode } from './ThemeColors'

const SHADOW_STYLE_ELEMENT_ID = 'miyop-shadow-system'

const toCssVariableName = (name: string) => (
  name.replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
)

const createSemanticShadowCssVariables = () => (
  Object.entries(SEMANTIC_SHADOWS)
    .map(([name, value]) => `--shadow-${toCssVariableName(name)}:${value};`)
    .join('')
)

const createUtilityShadowCssVariables = () => (
  Object.entries(SHADOW_UTILITIES)
    .map(([name, value]) => `--shadow-${toCssVariableName(name)}:${value};`)
    .join('')
)

const createCompatibilityShadowCssVariables = () => (
  Object.entries(SHADOW_ALIAS_TOKENS)
    .map(([name, value]) => {
      const variableName = name === 'cardShadow' ? 'card-shadow' : `shadow-${toCssVariableName(name)}`
      return `--${variableName}:${value};`
    })
    .join('')
)

export const getShadowVariable = (name: ShadowUtilityName | string) => (
  `var(--shadow-${toCssVariableName(name)})`
)

export const createShadowThemeCssVariables = (themeMode: ThemeMode = 'light') => [
  createShadowTokenCssVariables(SHADOW_THEMES[themeMode]),
  createSemanticShadowCssVariables(),
  createUtilityShadowCssVariables(),
  createCompatibilityShadowCssVariables()
].join('')

export const createShadowSystemCss = () => `
:root{${createShadowThemeCssVariables('light')}}
@media (prefers-color-scheme:dark){:root{${createShadowThemeCssVariables('dark')}}}
[data-theme="light"]{${createShadowThemeCssVariables('light')}}
[data-theme="dark"]{${createShadowThemeCssVariables('dark')}}
`.trim()

export const applyShadowSystem = (targetDocument: Document = document) => {
  const existingStyle = targetDocument.getElementById(SHADOW_STYLE_ELEMENT_ID)
  const cssText = createShadowSystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = SHADOW_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
