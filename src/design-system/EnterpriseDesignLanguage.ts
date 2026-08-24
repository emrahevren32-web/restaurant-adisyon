const ENTERPRISE_DESIGN_LANGUAGE_STYLE_ELEMENT_ID = 'miyop-enterprise-design-language'

const ENTERPRISE_DESIGN_LANGUAGE_TOKENS = {
  grid: '8px',
  density: {
    shellSidebar: '260px',
    shellSidebarWide: '260px',
    shellSidebarCollapsed: '68px',
    topbar: '64px',
    topbarWide: '64px',
    control: '36px',
    controlCompact: '30px',
    iconButton: '36px',
    touch: '40px'
  },
  space: {
    pageX: 'var(--space-24)',
    pageY: 'var(--space-16)',
    section: 'var(--space-16)',
    cluster: 'var(--space-12)',
    item: '6px'
  },
  layout: {
    contentMax: '1440px',
    contentWide: '1680px',
    contentLaptop: '1280px',
    contentCompact: '1120px',
    readableMax: '960px',
    headerMinHeight: 'auto',
    headerPaddingY: 'var(--space-12)',
    headerPaddingX: 'var(--space-20)',
    toolbarMinHeight: '48px',
    toolbarGap: 'var(--space-8)',
    contentGap: 'var(--space-16)',
    cardGap: 'var(--space-12)',
    cardPadding: 'var(--space-16)'
  },
  type: {
    display: 'var(--type-h1-size)',
    heading: 'var(--type-h2-size)',
    title: 'var(--type-title-size)',
    subtitle: 'var(--type-subtitle-size)',
    body: 'var(--type-body-size)',
    caption: 'var(--type-caption-size)',
    label: 'var(--type-label-size)',
    button: 'var(--type-button-size)'
  },
  surface: {
    canvas: 'var(--theme-app-canvas)',
    base: 'var(--theme-surface-0)',
    raised: 'var(--theme-surface-1)',
    muted: 'var(--theme-surface-2)',
    chrome: 'var(--theme-surface-0)',
    card: 'var(--theme-surface-0)',
    cardHover: 'var(--theme-surface-0)',
    control: 'var(--theme-surface-0)',
    selected: 'var(--theme-semantic-primary-soft)'
  },
  border: {
    subtle: 'var(--line-soft)',
    default: 'var(--line)',
    strong: 'var(--line-strong)',
    accent: 'var(--accent-line)'
  },
  shadow: {
    rest: '0 1px 2px color-mix(in srgb, var(--theme-text-primary) 4%, transparent), 0 12px 28px color-mix(in srgb, var(--theme-text-primary) 5%, transparent)',
    hover: '0 1px 2px color-mix(in srgb, var(--theme-text-primary) 5%, transparent), 0 16px 36px color-mix(in srgb, var(--theme-text-primary) 7%, transparent)',
    floating: '0 24px 64px color-mix(in srgb, var(--theme-text-primary) 16%, transparent)'
  },
  radius: {
    panel: '10px',
    control: '8px',
    item: '7px',
    pill: '999px'
  },
  motion: {
    micro: '100ms',
    fast: '150ms',
    standard: '200ms',
    slow: '250ms',
    deliberate: '300ms',
    ease: 'cubic-bezier(.2, 0, 0, 1)'
  },
  icon: {
    xs: '14px',
    sm: '16px',
    md: '18px',
    frame: '28px'
  },
  zIndex: {
    sidebar: '70',
    topbar: '80',
    overlay: '1400',
    tour: '2200',
    tourTarget: '2210',
    tourCard: '2220',
    toast: '2300'
  }
} as const

type TokenLeaf = string
type TokenBranch = TokenLeaf | { readonly [key: string]: TokenBranch }

const toCssVariableName = (value: string) => (
  value
    .replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase('en-US')}`)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('en-US')
)

const flattenTokens = (
  tokens: { readonly [key: string]: TokenBranch },
  path: string[] = []
): string[] => (
  Object.entries(tokens).flatMap(([key, value]) => {
    const nextPath = [...path, toCssVariableName(key)]
    if(typeof value === 'string') return `--edl-${nextPath.join('-')}:${value};`
    return flattenTokens(value, nextPath)
  })
)

export const createEnterpriseDesignLanguageCss = () => `
:root{
${flattenTokens(ENTERPRISE_DESIGN_LANGUAGE_TOKENS).join('')}
--enterprise-layout-grid:var(--edl-grid);
--enterprise-content-max:var(--edl-layout-content-max);
--enterprise-content-readable:var(--edl-layout-readable-max);
--enterprise-page-gutter:var(--edl-space-page-x);
--enterprise-section-gap:var(--edl-layout-content-gap);
--enterprise-card-gap:var(--edl-layout-card-gap);
--enterprise-card-padding:var(--edl-layout-card-padding);
--enterprise-header-min-height:var(--edl-layout-header-min-height);
--enterprise-header-padding-y:var(--edl-layout-header-padding-y);
--enterprise-header-padding-x:var(--edl-layout-header-padding-x);
--enterprise-toolbar-min-height:var(--edl-layout-toolbar-min-height);
--enterprise-toolbar-gap:var(--edl-layout-toolbar-gap);
--shell-sidebar:var(--edl-density-shell-sidebar);
--shell-sidebar-collapsed:var(--edl-density-shell-sidebar-collapsed);
--topbar-height:var(--edl-density-topbar);
--layout-page-padding:var(--enterprise-page-gutter);
--layout-section-gap:var(--enterprise-section-gap);
--layout-widget-gap:var(--enterprise-section-gap);
--layout-card-padding:var(--enterprise-card-padding);
--layout-card-gap:var(--enterprise-card-gap);
--motion-fast:var(--edl-motion-fast);
--motion-normal:var(--edl-motion-standard);
--motion-medium:var(--edl-motion-standard);
--motion-slow:var(--edl-motion-slow);
--motion-micro:var(--edl-motion-micro);
--motion-slower:var(--edl-motion-deliberate);
}
@media (min-width:1920px){
:root{
--shell-sidebar:var(--edl-density-shell-sidebar-wide);
--topbar-height:var(--edl-density-topbar-wide);
--enterprise-content-max:var(--edl-layout-content-wide);
--enterprise-page-gutter:var(--space-32);
--layout-page-padding:var(--enterprise-page-gutter);
--layout-card-padding:var(--space-24);
}
}
@media (max-width:1440px){
:root{
--enterprise-content-max:var(--edl-layout-content-laptop);
}
}
@media (max-width:1280px){
:root{
--enterprise-content-max:var(--edl-layout-content-compact);
--enterprise-page-gutter:var(--space-24);
--layout-page-padding:var(--enterprise-page-gutter);
}
}
@media (max-width:1024px){
:root{
--shell-sidebar:min(var(--responsive-sidebar-drawer-width), calc(100vw - var(--space-48)));
--shell-sidebar-collapsed:0px;
--topbar-height:64px;
--enterprise-content-max:100%;
--enterprise-page-gutter:var(--space-16);
--enterprise-section-gap:var(--space-16);
--enterprise-card-padding:var(--space-16);
--enterprise-header-min-height:96px;
--enterprise-header-padding-y:var(--space-16);
--enterprise-header-padding-x:var(--space-16);
--layout-page-padding:var(--enterprise-page-gutter);
--layout-section-gap:var(--enterprise-section-gap);
--layout-card-padding:var(--enterprise-card-padding);
}
}
@media (max-width:576px){
:root{
--shell-sidebar:calc(100vw - var(--space-24));
--topbar-height:64px;
--enterprise-page-gutter:var(--space-12);
--enterprise-section-gap:var(--space-12);
--enterprise-card-gap:var(--space-12);
--enterprise-card-padding:var(--space-12);
--enterprise-header-min-height:auto;
--enterprise-header-padding-y:var(--space-12);
--enterprise-header-padding-x:var(--space-12);
--layout-page-padding:var(--enterprise-page-gutter);
--layout-section-gap:var(--enterprise-section-gap);
--layout-card-gap:var(--enterprise-card-gap);
--layout-card-padding:var(--enterprise-card-padding);
}
}
`.trim()

export const applyEnterpriseDesignLanguage = (targetDocument: Document = document) => {
  const cssText = createEnterpriseDesignLanguageCss()
  const existingStyle = targetDocument.getElementById(ENTERPRISE_DESIGN_LANGUAGE_STYLE_ELEMENT_ID)

  if(existingStyle){
    existingStyle.textContent = cssText
    return
  }

  const styleElement = targetDocument.createElement('style')
  styleElement.id = ENTERPRISE_DESIGN_LANGUAGE_STYLE_ELEMENT_ID
  styleElement.textContent = cssText
  targetDocument.head.appendChild(styleElement)
}
