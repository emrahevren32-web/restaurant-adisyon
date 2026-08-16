import {
  RESPONSIVE_BREAKPOINTS
} from './ResponsiveTokens'
import {
  createVisualPolishTokenCssVariables
} from './VisualPolishTokens'

const VISUAL_POLISH_STYLE_ELEMENT_ID = 'miyop-visual-polish-system'

export const createVisualPolishSystemCss = () => `
:root{${createVisualPolishTokenCssVariables()}}
@media (min-width:${RESPONSIVE_BREAKPOINTS.wide1920}px){:root{--polish-sidebar-width:252px;--polish-topbar-height:66px;--polish-section-gap:var(--space-24);--polish-grid-gap:var(--space-16);}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.desktop1280}px){:root{--polish-sidebar-width:236px;--polish-sidebar-collapsed-width:68px;--polish-topbar-gap:var(--space-8);}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.tablet1024}px){:root{--polish-sidebar-width:min(var(--responsive-sidebar-drawer-width), calc(100vw - var(--space-48)));--polish-sidebar-collapsed-width:0px;--polish-section-gap:var(--space-16);--polish-grid-gap:var(--space-12);--polish-card-padding:var(--space-16);}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.mobile576}px){:root{--polish-sidebar-width:calc(100vw - var(--space-24));--polish-section-gap:var(--space-12);--polish-grid-gap:var(--space-8);--polish-card-padding:var(--space-12);--polish-control-height:var(--responsive-touch-target);--polish-topbar-height:64px;}}
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
