import {
  RESPONSIVE_BREAKPOINTS,
  createResponsiveTokenCssVariables
} from './ResponsiveTokens'

const RESPONSIVE_STYLE_ELEMENT_ID = 'miyop-responsive-system'

export const createResponsiveSystemCss = () => `
:root{${createResponsiveTokenCssVariables()}}
@media (min-width:${RESPONSIVE_BREAKPOINTS.wide1920}px){:root{--shell-content-max:var(--responsive-container-wide);--responsive-container-current:var(--responsive-container-wide);--layout-page-padding:var(--space-32);--responsive-card-min:280px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.desktop1600}px){:root{--shell-content-max:var(--responsive-container-desktop);--responsive-container-current:var(--responsive-container-desktop);--responsive-card-min:260px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.laptop1440}px){:root{--shell-content-max:1360px;--responsive-container-current:1360px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.laptop1366}px){:root{--shell-content-max:1280px;--responsive-container-current:1280px;--responsive-card-min:248px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.desktop1280}px){:root{--shell-content-max:var(--responsive-container-laptop);--responsive-container-current:var(--responsive-container-laptop);--responsive-card-min:236px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.tablet1024}px){:root{--responsive-container-current:var(--responsive-container-tablet);--responsive-card-min:220px;--responsive-table-min-width:720px;--responsive-sidebar-drawer-width:372px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.tablet768}px){:root{--responsive-card-min:196px;--responsive-table-min-width:640px;--topbar-height:70px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.mobile576}px){:root{--responsive-container-current:var(--responsive-container-mobile);--responsive-card-min:100%;--responsive-table-min-width:0;--responsive-touch-target:48px;--touch-target:48px;--touch-target-sm:44px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.mobile480}px){:root{--responsive-card-padding:var(--space-12);--responsive-section-gap:var(--space-12);--responsive-grid-gap:var(--space-8);}}
`.trim()

export const applyResponsiveSystem = (targetDocument: Document = document) => {
  const existingStyle = targetDocument.getElementById(RESPONSIVE_STYLE_ELEMENT_ID)
  const cssText = createResponsiveSystemCss()

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = RESPONSIVE_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}

