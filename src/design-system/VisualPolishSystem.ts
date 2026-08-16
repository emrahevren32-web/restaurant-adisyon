import {
  RESPONSIVE_BREAKPOINTS
} from './ResponsiveTokens'
import {
  createVisualPolishTokenCssVariables
} from './VisualPolishTokens'

const VISUAL_POLISH_STYLE_ELEMENT_ID = 'miyop-visual-polish-system'

export const createVisualPolishSystemCss = () => `
:root{${createVisualPolishTokenCssVariables()}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.tablet1024}px){:root{--polish-section-gap:var(--space-16);--polish-grid-gap:var(--space-12);--polish-card-padding:var(--space-16);}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.mobile576}px){:root{--polish-section-gap:var(--space-12);--polish-grid-gap:var(--space-8);--polish-card-padding:var(--space-12);--polish-control-height:var(--responsive-touch-target);}}
`.trim()

export const applyVisualPolishSystem = (targetDocument: Document = document) => {
  const existingStyle = targetDocument.getElementById(VISUAL_POLISH_STYLE_ELEMENT_ID)
  const cssText = createVisualPolishSystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = VISUAL_POLISH_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
