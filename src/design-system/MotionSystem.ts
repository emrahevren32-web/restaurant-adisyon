import { createMotionTokenCssVariables } from './MotionTokens'

const MOTION_STYLE_ELEMENT_ID = 'miyop-motion-system'

const createReducedMotionCss = () => `
html[data-motion-preference="standard"]{scroll-behavior:smooth}
html[data-motion-preference="reduced"]{scroll-behavior:auto}
html[data-motion-preference="reduced"] *,
html[data-motion-preference="reduced"] *::before,
html[data-motion-preference="reduced"] *::after{animation-duration:var(--motion-instant) !important;animation-iteration-count:1 !important;scroll-behavior:auto !important;transition-duration:var(--motion-instant) !important}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  *,
  *::before,
  *::after{animation-duration:var(--motion-instant) !important;animation-iteration-count:1 !important;scroll-behavior:auto !important;transition-duration:var(--motion-instant) !important}
}
`.trim()

export const createMotionSystemCss = () => `
:root{${createMotionTokenCssVariables()}}
${createReducedMotionCss()}
`.trim()

export const applyMotionSystem = (targetDocument: Document = document) => {
  const existingStyle = targetDocument.getElementById(MOTION_STYLE_ELEMENT_ID)
  const cssText = createMotionSystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = MOTION_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
