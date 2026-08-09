import { createLayoutSpacingCssVariables } from './LayoutSpacing'
import { createSpacingTokenCssVariables } from './SpacingTokens'

const SPACING_STYLE_ELEMENT_ID = 'miyop-spacing-system'

const createCompatibilitySpacingVariables = () => [
  '--space-grid-unit:var(--space-8);',
  '--touch-gap:var(--layout-button-gap);',
  '--card-spacing:var(--layout-card-padding);',
  '--section-spacing:var(--layout-section-gap);',
  '--form-spacing:var(--layout-form-gap);',
  '--table-cell-spacing:var(--layout-table-cell-padding);'
].join('')

export const createSpacingSystemCss = () => `
:root{${createSpacingTokenCssVariables()}${createLayoutSpacingCssVariables('desktop')}${createCompatibilitySpacingVariables()}}
@media (max-width:1024px){:root{${createLayoutSpacingCssVariables('tablet')}${createCompatibilitySpacingVariables()}}}
@media (max-width:720px){:root{${createLayoutSpacingCssVariables('mobile')}${createCompatibilitySpacingVariables()}}}
`.trim()

export const applySpacingSystem = (targetDocument: Document = document) => {
  const existingStyle = targetDocument.getElementById(SPACING_STYLE_ELEMENT_ID)
  const cssText = createSpacingSystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = SPACING_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
