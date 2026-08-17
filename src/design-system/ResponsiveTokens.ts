export type ResponsiveBreakpointName =
  | 'wide1920'
  | 'desktop1600'
  | 'laptop1440'
  | 'laptop1366'
  | 'desktop1280'
  | 'tablet1024'
  | 'tablet768'
  | 'mobile576'
  | 'mobile480'

export type ResponsiveViewport =
  | 'wide'
  | 'desktop'
  | 'laptop'
  | 'tablet'
  | 'mobile'
  | 'compact'

export const RESPONSIVE_BREAKPOINTS: Record<ResponsiveBreakpointName, number> = {
  wide1920: 1920,
  desktop1600: 1600,
  laptop1440: 1440,
  laptop1366: 1366,
  desktop1280: 1280,
  tablet1024: 1024,
  tablet768: 768,
  mobile576: 576,
  mobile480: 480
}

export const RESPONSIVE_CONTAINER_WIDTHS = {
  wide: '1680px',
  desktop: '1440px',
  laptop: '1280px',
  tablet: '100%',
  mobile: '100%'
} as const

export const RESPONSIVE_GRID_COLUMNS: Record<ResponsiveViewport, number> = {
  wide: 12,
  desktop: 12,
  laptop: 8,
  tablet: 4,
  mobile: 2,
  compact: 1
}

const toCssVariableName = (name: string) => (
  name.replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
)

export const getResponsiveBreakpoint = (breakpoint: ResponsiveBreakpointName) => (
  RESPONSIVE_BREAKPOINTS[breakpoint]
)

export const getResponsiveBreakpointVariable = (breakpoint: ResponsiveBreakpointName) => (
  `var(--responsive-breakpoint-${toCssVariableName(breakpoint)})`
)

export const createResponsiveTokenCssVariables = () => [
  ...Object.entries(RESPONSIVE_BREAKPOINTS).map(([name, value]) => (
    `--responsive-breakpoint-${toCssVariableName(name)}:${value}px;`
  )),
  `--responsive-container-wide:${RESPONSIVE_CONTAINER_WIDTHS.wide};`,
  `--responsive-container-desktop:${RESPONSIVE_CONTAINER_WIDTHS.desktop};`,
  `--responsive-container-laptop:${RESPONSIVE_CONTAINER_WIDTHS.laptop};`,
  `--responsive-container-tablet:${RESPONSIVE_CONTAINER_WIDTHS.tablet};`,
  `--responsive-container-mobile:${RESPONSIVE_CONTAINER_WIDTHS.mobile};`,
  '--responsive-container-current:var(--responsive-container-desktop);',
  '--responsive-page-padding:var(--layout-page-padding);',
  '--responsive-section-gap:var(--layout-section-gap);',
  '--responsive-grid-gap:var(--layout-widget-gap);',
  '--responsive-card-min:256px;',
  '--responsive-card-padding:var(--layout-card-padding);',
  '--responsive-table-min-width:760px;',
  '--responsive-sidebar-drawer-width:360px;',
  '--responsive-touch-target:var(--touch-target);'
].join('')
