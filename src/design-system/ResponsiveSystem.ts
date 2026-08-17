import {
  RESPONSIVE_BREAKPOINTS,
  createResponsiveTokenCssVariables
} from './ResponsiveTokens'

const RESPONSIVE_STYLE_ELEMENT_ID = 'miyop-responsive-system'

export const createResponsiveSystemCss = () => `
:root{${createResponsiveTokenCssVariables()}}
@media (min-width:${RESPONSIVE_BREAKPOINTS.wide1920}px){:root{--shell-content-max:var(--responsive-container-wide);--responsive-container-current:var(--responsive-container-wide);--layout-page-padding:var(--space-32);--responsive-card-min:288px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.desktop1600}px){:root{--shell-content-max:var(--responsive-container-desktop);--responsive-container-current:var(--responsive-container-desktop);--responsive-card-min:256px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.laptop1440}px){:root{--shell-content-max:var(--responsive-container-laptop);--responsive-container-current:var(--responsive-container-laptop);}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.laptop1366}px){:root{--shell-content-max:1200px;--responsive-container-current:1200px;--responsive-card-min:240px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.desktop1280}px){:root{--shell-content-max:1120px;--responsive-container-current:1120px;--responsive-card-min:224px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.tablet1024}px){:root{--responsive-container-current:var(--responsive-container-tablet);--responsive-card-min:224px;--responsive-table-min-width:704px;--responsive-sidebar-drawer-width:360px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.tablet768}px){:root{--responsive-card-min:192px;--responsive-table-min-width:640px;--topbar-height:64px;}}
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
