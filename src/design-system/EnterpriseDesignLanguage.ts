const ENTERPRISE_DESIGN_LANGUAGE_STYLE_ELEMENT_ID = 'miyop-enterprise-design-language'

const ENTERPRISE_DESIGN_LANGUAGE_TOKENS = {
  grid: '4px',
  density: {
    shellSidebar: '232px',
    shellSidebarWide: '244px',
    shellSidebarCollapsed: '64px',
    topbar: '60px',
    topbarWide: '64px',
    control: '36px',
    controlCompact: '32px',
    iconButton: '34px',
    touch: '44px'
  },
  space: {
    pageX: 'clamp(16px, 1.6vw, 24px)',
    pageY: '18px',
    section: '20px',
    cluster: '12px',
    item: '8px'
  },
  type: {
    display: '28px',
    heading: '22px',
    title: '18px',
    subtitle: '15px',
    body: '13px',
    caption: '11px',
    label: '10px',
    button: '12px'
  },
  surface: {
    canvas: 'var(--theme-app-canvas)',
    base: 'var(--theme-surface-0)',
    raised: 'var(--theme-surface-1)',
    muted: 'var(--theme-surface-2)',
    chrome: 'linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-1) 94%, var(--theme-app-muted)), var(--theme-surface-1))',
    card: 'linear-gradient(180deg, var(--theme-surface-0), color-mix(in srgb, var(--theme-surface-1) 92%, var(--theme-app-muted)))',
    cardHover: 'linear-gradient(180deg, var(--theme-surface-0), color-mix(in srgb, var(--theme-surface-1) 84%, var(--theme-semantic-primary-soft)))',
    control: 'linear-gradient(180deg, color-mix(in srgb, var(--theme-surface-0) 92%, var(--theme-surface-1)), var(--theme-surface-1))',
    selected: 'linear-gradient(90deg, var(--theme-semantic-primary-soft), color-mix(in srgb, var(--theme-surface-1) 76%, transparent))'
  },
  border: {
    subtle: 'color-mix(in srgb, var(--theme-border-subtle) 28%, transparent)',
    default: 'color-mix(in srgb, var(--theme-border-default) 42%, transparent)',
    strong: 'color-mix(in srgb, var(--theme-border-default) 58%, transparent)',
    accent: 'color-mix(in srgb, var(--theme-semantic-primary-line) 48%, transparent)'
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
    fast: '150ms',
    standard: '170ms',
    slow: '180ms',
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
--shell-sidebar:var(--edl-density-shell-sidebar);
--shell-sidebar-collapsed:var(--edl-density-shell-sidebar-collapsed);
--topbar-height:var(--edl-density-topbar);
--layout-page-padding:var(--edl-space-page-x);
--layout-section-gap:var(--edl-space-section);
--layout-widget-gap:var(--edl-space-section);
--layout-card-padding:var(--space-20);
--layout-card-gap:var(--space-12);
--motion-fast:var(--edl-motion-fast);
--motion-normal:var(--edl-motion-standard);
--motion-medium:var(--edl-motion-standard);
--motion-slow:var(--edl-motion-slow);
}
@media (min-width:1920px){
:root{
--shell-sidebar:var(--edl-density-shell-sidebar-wide);
--topbar-height:var(--edl-density-topbar-wide);
--layout-page-padding:var(--space-24);
--layout-card-padding:var(--space-24);
}
}
@media (max-width:1024px){
:root{
--shell-sidebar:min(var(--responsive-sidebar-drawer-width), calc(100vw - var(--space-48)));
--shell-sidebar-collapsed:0px;
--topbar-height:64px;
--layout-page-padding:var(--space-16);
--layout-card-padding:var(--space-16);
}
}
@media (max-width:576px){
:root{
--shell-sidebar:calc(100vw - var(--space-24));
--topbar-height:64px;
--layout-page-padding:var(--space-12);
--layout-card-padding:var(--space-12);
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
