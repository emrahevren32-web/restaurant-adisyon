import { createBorderRadiusTokenCssVariables } from './BorderRadiusTokens'
import { SEMANTIC_BORDER_RADIUS } from './BorderRadiusTheme'

const BORDER_RADIUS_STYLE_ELEMENT_ID = 'miyop-border-radius-system'

const toCssVariableName = (name: string) => (
  name.replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
)

const createSemanticBorderRadiusCssVariables = () => (
  Object.entries(SEMANTIC_BORDER_RADIUS)
    .map(([name, token]) => `--radius-${toCssVariableName(name)}:var(--radius-${token});`)
    .join('')
)

const createCompatibilityBorderRadiusCssVariables = () => [
  '--radius-inherit:inherit;',
  '--radius-pill:var(--radius-full);'
].join('')

export const getBorderRadiusSemanticVariable = (name: string) => (
  `var(--radius-${toCssVariableName(name)})`
)

export const createBorderRadiusSystemCss = () => `
:root{${createBorderRadiusTokenCssVariables()}${createSemanticBorderRadiusCssVariables()}${createCompatibilityBorderRadiusCssVariables()}}
@media (prefers-color-scheme:dark){:root{${createSemanticBorderRadiusCssVariables()}${createCompatibilityBorderRadiusCssVariables()}}}
[data-theme="light"]{${createSemanticBorderRadiusCssVariables()}${createCompatibilityBorderRadiusCssVariables()}}
[data-theme="dark"]{${createSemanticBorderRadiusCssVariables()}${createCompatibilityBorderRadiusCssVariables()}}
`.trim()

export const applyBorderRadiusSystem = (targetDocument: Document = document) => {
  const existingStyle = targetDocument.getElementById(BORDER_RADIUS_STYLE_ELEMENT_ID)
  const cssText = createBorderRadiusSystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = BORDER_RADIUS_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
