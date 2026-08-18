import {
  RESPONSIVE_BREAKPOINTS,
  createResponsiveTokenCssVariables
} from './ResponsiveTokens'

const RESPONSIVE_STYLE_ELEMENT_ID = 'miyop-responsive-system'

export const createResponsiveSystemCss = () => `
:root{${createResponsiveTokenCssVariables()}}
@media (min-width:${RESPONSIVE_BREAKPOINTS.xl}px){:root{--responsive-breakpoint-current:xl;--responsive-shell-mode:wide;--shell-content-max:var(--responsive-container-wide);--responsive-container-current:var(--responsive-container-wide);--layout-page-padding:var(--space-32);--responsive-card-min:288px;--responsive-form-columns:3;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.desktop1600}px){:root{--responsive-breakpoint-current:desktop;--responsive-shell-mode:desktop;--shell-content-max:var(--responsive-container-desktop);--responsive-container-current:var(--responsive-container-desktop);--responsive-card-min:256px;--responsive-form-columns:3;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.laptop1440}px){:root{--responsive-breakpoint-current:laptop;--responsive-shell-mode:desktop;--shell-content-max:var(--responsive-container-laptop);--responsive-container-current:var(--responsive-container-laptop);--responsive-form-columns:2;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.laptop1366}px){:root{--responsive-breakpoint-current:laptop-compact;--shell-content-max:1200px;--responsive-container-current:1200px;--responsive-card-min:240px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.lg}px){:root{--responsive-breakpoint-current:lg;--shell-content-max:1120px;--responsive-container-current:1120px;--responsive-card-min:224px;--responsive-density:compact;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.md}px){:root{--responsive-breakpoint-current:md;--responsive-shell-mode:tablet;--responsive-container-current:var(--responsive-container-tablet);--responsive-card-min:224px;--responsive-table-min-width:704px;--responsive-sidebar-drawer-width:360px;--responsive-topbar-rows:2;--responsive-form-columns:2;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.sm}px){:root{--responsive-breakpoint-current:sm;--responsive-shell-mode:mobile;--responsive-card-min:192px;--responsive-table-min-width:640px;--topbar-height:64px;--responsive-topbar-rows:2;--responsive-form-columns:1;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.mobile576}px){:root{--responsive-breakpoint-current:mobile;--responsive-container-current:var(--responsive-container-mobile);--responsive-card-min:100%;--responsive-table-min-width:0;--responsive-sidebar-drawer-width:calc(100vw - var(--space-24));--responsive-touch-target:48px;--touch-target:48px;--touch-target-sm:44px;}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.xs}px){:root{--responsive-breakpoint-current:xs;--responsive-card-padding:var(--space-12);--responsive-section-gap:var(--space-12);--responsive-grid-gap:var(--space-8);}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.mobile390}px){:root{--responsive-breakpoint-current:compact;--responsive-sidebar-drawer-width:calc(100vw - var(--space-16));--responsive-card-padding:var(--space-10, var(--space-8));--responsive-grid-gap:var(--space-8);}}
@media (max-width:${RESPONSIVE_BREAKPOINTS.mobile360}px){:root{--responsive-breakpoint-current:micro;--responsive-sidebar-drawer-width:100vw;--responsive-section-gap:var(--space-8);--responsive-grid-gap:var(--space-8);}}
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
